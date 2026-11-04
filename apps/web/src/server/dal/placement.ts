import 'server-only'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { createRng } from '@kira/core'
import {
  PLACEMENT_AUTO_SINCE,
  isStable,
  itemB,
  nextTheta,
  pickNext,
  retakeAllowedAt,
  seedPlan,
  sessionStartGrade,
  startTheta,
  strandGroup,
  summarise,
  type PlacementAnswer,
  type PlacementCandidate,
  type PlacementResult,
} from '@kira/core/placement'
import { tables } from '@kira/db'
import { checkAnswer, clashKeys, keyOf, MANUAL_TYPES } from '@kira/content'
import { GENERATORS, genRef, instanceSignature, newSeed } from '@kira/content/math'
import type { AvatarName, Subject } from '@/lib/dto'
import type {
  ParentPlacementDTO,
  ParentPlacementSubjectDTO,
  PlacementAnswerResultDTO,
  PlacementCardDTO,
  PlacementEntryDTO,
  PlacementResultDTO,
  PlacementStepDTO,
} from '@/lib/dto-placement'
import type { OrgContext, Tx } from '../db'
import { conflict, invalid, notFound } from '../errors'
import { content, resolveItems, skill, skillsFor, toClient } from './content'
import { isFeatureOnTx } from './learner-features'
import { jenjangOf, loadLearner, recentSeen, type LearnerRow } from './learner-core'
import { validAnswer } from './learner-runner'
export { placementStartGrade } from './placement-grade'

/**
 * Tes penempatan (fitur `placement`). Satu baris placement_run per percobaan; soal dipilih satu per satu oleh
 * model Rasch (packages/core/src/placement.ts). Tes ini tidak membuat attempt, XP, streak, atau kartu ulasan:
 * ia hanya menyimpan jawaban di barisnya dan, saat selesai, mengisi skill_state di bawah tingkat anak.
 * Hanya soal otomatis, tidak ada soal yang sama dalam satu tes, dan soal yang pernah dilihat anak dipakai paling akhir.
 */

const { placementRun, skillState } = tables

type RunRow = typeof placementRun.$inferSelect
export const PLACEMENT_SUBJECTS: Subject[] = ['math', 'english', 'science']
const LABEL: Record<Subject, string> = { math: 'Math', english: 'English', science: 'Science' }
const MANUAL_STRANDS = new Set(['Wc', 'SL', 'Wp'])
/** Jenis soal yang tidak dipakai di tes ini: dinilai manusia, butuh suara, atau terlalu panjang untuk 5 menit. */
const SKIP_TYPES = new Set<string>([...MANUAL_TYPES, 'listen', 'spell', 'story'])
const ABOUT = 10

// ---------------------------------------------------------------------------
// Bank soal

const g = globalThis as unknown as { __kiraPlacementBank?: Map<Subject, PlacementCandidate[]> }

/** Soal otomatis dari repo (kelas 1 sampai 6, tanpa olimpiade) dan tingkat generator, dibangun sekali per proses. */
export function candidatesFor(subject: Subject): PlacementCandidate[] {
  const bank = (g.__kiraPlacementBank ??= new Map())
  const hit = bank.get(subject)
  if (hit) return hit
  const out: PlacementCandidate[] = []
  for (let grade = 1; grade <= 6; grade++) {
    for (const s of skillsFor(subject, grade)) {
      if (s.strand === 'Oly') continue
      for (const item of content().itemsBySkill.get(s.id) ?? []) {
        if (SKIP_TYPES.has(item.type)) continue
        if (item.lang === 'id') continue
        out.push({ ref: item.id, skillId: s.id, grade, strand: s.strand, difficulty: item.difficulty })
      }
      const gen = GENERATORS.get(s.id)
      if (gen && !MANUAL_STRANDS.has(s.strand)) for (const level of gen.levels) out.push({ ref: `gen:${s.id}:${level}`, skillId: s.id, grade, strand: s.strand, difficulty: level, unlimited: true })
    }
  }
  bank.set(subject, out)
  return out
}

/** Ubah kandidat generator menjadi ref dengan seed yang instansnya belum dipakai di tes ini. */
function materialise(ref: string, rng: ReturnType<typeof createRng>, usedSignatures: ReadonlySet<string>): string {
  const m = /^gen:([mes][1-6]\.[a-z0-9-]+):([1-5])$/.exec(ref)
  if (!m) return ref
  let out = genRef(m[1]!, Number(m[2]) as 1 | 2 | 3 | 4 | 5, newSeed(rng))
  for (let i = 0; i < 40 && usedSignatures.has(instanceSignature(out)); i++) out = genRef(m[1]!, Number(m[2]) as 1 | 2 | 3 | 4 | 5, newSeed(rng))
  return out
}

// ---------------------------------------------------------------------------
// Aturan akses

/** Selalu di transaksi pemanggil: meminta sambungan kedua dari pool saat transaksi terbuka membuat pool saling menunggu di bawah beban. */
async function placementOn(tx: Tx, learnerId: string): Promise<boolean> {
  return isFeatureOnTx(tx, learnerId, 'placement')
}

async function enabledSubjects(tx: Tx, learnerId: string): Promise<Subject[]> {
  const out: Subject[] = []
  for (const s of PLACEMENT_SUBJECTS) if (await isFeatureOnTx(tx, learnerId, s)) out.push(s)
  return out
}

const subjectSchema = z.enum(['math', 'english', 'science'])

async function openRuns(tx: Tx, learnerId: string): Promise<RunRow[]> {
  return tx
    .select()
    .from(placementRun)
    .where(and(eq(placementRun.learnerId, learnerId), inArray(placementRun.status, ['ready', 'in_progress'])))
}

/**
 * Anak baru (dibuat setelah PLACEMENT_AUTO_SINCE) yang belum punya jawaban dan belum pernah punya tes penempatan
 * mendapat satu tes siap per mapel yang aktif. Anak yang sudah ada tidak pernah ditanya otomatis.
 */
export async function ensureAutoPlacement(tx: Tx, ctx: OrgContext, learner: LearnerRow): Promise<void> {
  if (learner.createdAt.getTime() < Date.parse(PLACEMENT_AUTO_SINCE)) return
  if (!(await placementOn(tx, learner.userId))) return
  const any = await tx.select({ id: placementRun.id }).from(placementRun).where(eq(placementRun.learnerId, learner.userId)).limit(1)
  if (any[0]) return
  const answered = await tx.select({ n: sql<number>`count(*)::int` }).from(skillState).where(and(eq(skillState.learnerId, learner.userId), sql`${skillState.nAnswers} > 0`))
  if ((answered[0]?.n ?? 0) > 0) return
  const subjects = await enabledSubjects(tx, learner.userId)
  if (subjects.length === 0) return
  await tx
    .insert(placementRun)
    .values(subjects.map((subject) => ({ orgId: ctx.orgId, learnerId: learner.userId, subject, origin: 'auto' as const, startGrade: learner.grade, theta: startTheta(learner.grade) })))
    .onConflictDoNothing()
}

/** Kartu hari pertama di Today. Kosong bila tidak ada tes yang menunggu, atau fitur mati. */
export async function placementCard(tx: Tx, ctx: OrgContext, learnerId: string): Promise<PlacementCardDTO | null> {
  if (!(await placementOn(tx, learnerId))) return null
  const learner = await loadLearner(tx, learnerId)
  await ensureAutoPlacement(tx, ctx, learner)
  const rows = await openRuns(tx, learnerId)
  const subjects = PLACEMENT_SUBJECTS.flatMap((subject) => {
    const r = rows.find((x) => x.subject === subject)
    return r ? [{ subject, label: LABEL[subject], status: r.status as 'ready' | 'in_progress', answered: (r.answers as PlacementAnswer[]).length }] : []
  })
  return subjects.length > 0 ? { subjects } : null
}

// ---------------------------------------------------------------------------
// Jalannya tes

async function lockRun(tx: Tx, learnerId: string, runId: string): Promise<RunRow> {
  const rows = await tx
    .select()
    .from(placementRun)
    .where(and(eq(placementRun.id, runId), eq(placementRun.learnerId, learnerId)))
    .for('update')
    .limit(1)
  if (!rows[0]) throw notFound('Tes ini tidak ditemukan.')
  return rows[0]
}

async function pickAndStore(tx: Tx, learner: LearnerRow, run: RunRow): Promise<string | null> {
  const subject = run.subject as Subject
  const answers = run.answers as PlacementAnswer[]
  const seen = await recentSeen(tx, learner.userId)
  const candidates = candidatesFor(subject).map((c) => (!c.unlimited && seen.has(c.ref) ? { ...c, seenDaysAgo: seen.get(c.ref)! } : c))
  const rng = createRng(`${run.id}:${answers.length}`)
  // Penjaga soal kembar pusat: soal yang tampil sama, atau operan Math yang sama, dengan soal yang sudah ditanyakan dilewati.
  const askedItems = await resolveItems(tx, answers.map((a) => a.ref))
  const taken = new Set<string>()
  for (const it of askedItems.values()) for (const k of clashKeys(it)) taken.add(k)
  const used = new Set(answers.map((a) => instanceSignature(a.ref)))
  let pool = candidates
  let ref: string | null = null
  for (let tries = 0; tries < 8 && !ref; tries++) {
    const c = pickNext({ candidates: pool, theta: run.theta, asked: answers, rng })
    if (!c) break
    const r = materialise(c.ref, rng, used)
    const it = (await resolveItems(tx, [r])).get(r)
    if (it && clashKeys(it).some((k) => taken.has(k))) pool = pool.filter((x) => x.ref !== c.ref)
    else ref = r
  }
  if (!ref) return null
  await tx.update(placementRun).set({ current: { ref } }).where(eq(placementRun.id, run.id))
  return ref
}

async function stepOf(tx: Tx, learner: LearnerRow, run: RunRow, ref: string): Promise<PlacementStepDTO> {
  const item = (await resolveItems(tx, [ref])).get(ref)
  if (!item) throw notFound('Soal tidak ditemukan.')
  const subject = run.subject as Subject
  const others = (await openRuns(tx, learner.userId)).filter((r) => r.id !== run.id).length
  return {
    runId: run.id,
    subject,
    subjectLabel: LABEL[subject],
    jenjang: jenjangOf(learner.grade), avatar: learner.avatar as AvatarName,
    number: (run.answers as PlacementAnswer[]).length + 1,
    about: ABOUT,
    item: toClient(item, { ref, seed: run.id, includeKey: false, includeHints: false }),
    more: others,
  }
}

/** Halaman /placement: tampilkan soal yang sedang berjalan, atau pilihan mapel bila ada beberapa tes menunggu. */
export async function placementEntry(tx: Tx, ctx: OrgContext, learnerId: string, subjectParam: string | null): Promise<PlacementEntryDTO> {
  const learner = await loadLearner(tx, learnerId)
  const jenjang = jenjangOf(learner.grade)
  const avatar = learner.avatar as AvatarName
  if (!(await placementOn(tx, learnerId))) return { kind: 'nothing', jenjang, avatar }
  await ensureAutoPlacement(tx, ctx, learner)
  const rows = await openRuns(tx, learnerId)
  const parsed = subjectParam ? subjectSchema.safeParse(subjectParam) : null
  const pickSubject = parsed?.success ? parsed.data : null
  const subjects = PLACEMENT_SUBJECTS.flatMap((subject) => {
    const r = rows.find((x) => x.subject === subject)
    return r ? [{ subject, label: LABEL[subject], status: r.status as 'ready' | 'in_progress', answered: (r.answers as PlacementAnswer[]).length }] : []
  })
  if (subjects.length === 0) return { kind: 'nothing', jenjang, avatar }
  const chosen = pickSubject ? subjects.find((s) => s.subject === pickSubject) : subjects.length === 1 ? subjects[0] : undefined
  if (!chosen) return { kind: 'pick', jenjang, avatar, subjects }
  return startPlacement(tx, learner, rows.find((r) => r.subject === chosen.subject)!)
}

async function startPlacement(tx: Tx, learner: LearnerRow, row: RunRow): Promise<PlacementEntryDTO> {
  const run = await lockRun(tx, learner.userId, row.id)
  const first = run.status === 'ready'
  if (run.status !== 'ready' && run.status !== 'in_progress') return { kind: 'nothing', jenjang: jenjangOf(learner.grade), avatar: learner.avatar as AvatarName }
  if (first) {
    await tx.update(placementRun).set({ status: 'in_progress', startedAt: new Date() }).where(eq(placementRun.id, run.id))
    run.status = 'in_progress'
  }
  const cur = (run.current as { ref?: string } | null)?.ref ?? (await pickAndStore(tx, learner, run))
  if (!cur) {
    // Bank soal kosong untuk mapel ini: tutup tes tanpa hasil palsu.
    await tx.update(placementRun).set({ status: 'skipped', finishedAt: new Date() }).where(eq(placementRun.id, run.id))
    return { kind: 'nothing', jenjang: jenjangOf(learner.grade), avatar: learner.avatar as AvatarName }
  }
  return { kind: 'step', step: await stepOf(tx, learner, run, cur), first }
}

export const placementAnswerSchema = z
  .object({
    runId: z.string().uuid(),
    ref: z.string().min(3).max(80),
    answer: z.unknown().optional(),
    unsure: z.boolean(),
  })
  .strict()
export type PlacementAnswerInput = z.infer<typeof placementAnswerSchema>

export async function answerPlacement(tx: Tx, ctx: OrgContext, learnerId: string, input: PlacementAnswerInput): Promise<PlacementAnswerResultDTO> {
  const learner = await loadLearner(tx, learnerId)
  const run = await lockRun(tx, learnerId, input.runId)
  const subject = run.subject as Subject
  const answers = run.answers as PlacementAnswer[]
  if (run.status !== 'in_progress') {
    if (run.status === 'done') return { done: true, subject, subjectLabel: LABEL[subject], nextSubject: await nextOpenSubject(tx, learnerId, subject), jenjang: jenjangOf(learner.grade), avatar: learner.avatar as AvatarName }
    throw conflict('Tes ini sudah ditutup.')
  }
  const cur = (run.current as { ref?: string } | null)?.ref
  if (!cur || cur !== input.ref) {
    // Ketukan ganda atau layar usang: kembalikan soal yang sedang berjalan.
    if (cur) return { done: false, step: await stepOf(tx, learner, run, cur) }
    throw conflict('Soal ini sudah dijawab.')
  }
  const item = (await resolveItems(tx, [cur])).get(cur)
  if (!item) throw notFound('Soal tidak ditemukan.')
  let correct = false
  if (!input.unsure) {
    const answer = input.answer ?? null
    if (!validAnswer(item, answer)) throw invalid('Bentuk jawaban tidak sesuai soal.')
    correct = checkAnswer(keyOf(item), answer).status === 'correct'
  }
  const sk = skill(item.skill)
  const grade = sk?.grade ?? learner.grade
  const b = itemB(grade, item.difficulty)
  const theta = nextTheta(run.theta, answers.length, b, correct)
  const rec: PlacementAnswer = { ref: cur, skillId: item.skill, grade, group: strandGroup(sk?.strand ?? '').id, difficulty: item.difficulty, b, correct, unsure: input.unsure, thetaAfter: theta }
  const all = [...answers, rec]
  const stable = isStable(all.map((a) => a.thetaAfter))
  const next: RunRow = { ...run, answers: all, theta }
  await tx.update(placementRun).set({ answers: all, theta, current: null }).where(eq(placementRun.id, run.id))
  if (!stable) {
    const ref = await pickAndStore(tx, learner, next)
    if (ref) return { done: false, step: await stepOf(tx, learner, next, ref) }
  }
  await finishRun(tx, ctx, learner, next)
  return { done: true, subject, subjectLabel: LABEL[subject], nextSubject: await nextOpenSubject(tx, learnerId, subject), jenjang: jenjangOf(learner.grade), avatar: learner.avatar as AvatarName }
}

async function nextOpenSubject(tx: Tx, learnerId: string, except: Subject): Promise<Subject | null> {
  const rows = await openRuns(tx, learnerId)
  return PLACEMENT_SUBJECTS.find((s) => s !== except && rows.some((r) => r.subject === s)) ?? null
}

/** Tutup tes: ringkas, isi skill_state di bawah tingkat, simpan hasil. */
async function finishRun(tx: Tx, ctx: OrgContext, learner: LearnerRow, run: RunRow): Promise<PlacementResult> {
  const subject = run.subject as Subject
  const result = summarise(subject, run.startGrade, run.answers as PlacementAnswer[])
  await seedSkillState(tx, ctx, learner.userId, subject, result)
  await tx.update(placementRun).set({ status: 'done', result, finishedAt: new Date(), current: null }).where(eq(placementRun.id, run.id))
  return result
}

function seedableSkills(subject: Subject) {
  const out: { id: string; grade: number; strand: string }[] = []
  for (let grade = 1; grade <= 6; grade++) for (const s of skillsFor(subject, grade)) if (s.strand !== 'Oly' && !MANUAL_STRANDS.has(s.strand)) out.push({ id: s.id, grade, strand: s.strand })
  return out
}

/**
 * Isi skill_state: skill di bawah tingkat jadi "dikuasai" atau "perlu diulang", skill di tingkat itu dan di atasnya tetap
 * baru. Hanya baris tanpa jawaban asli (n_answers = 0) yang disentuh, jadi kemajuan nyata anak tidak pernah tertimpa.
 * Penandaan dari tes sebelumnya (gate review atau mastered dengan n_answers = 0) dibersihkan lebih dulu agar tes ulang tidak menumpuk.
 */
export async function seedSkillState(tx: Tx, ctx: OrgContext, learnerId: string, subject: Subject, result: Pick<PlacementResult, 'level' | 'groups'>): Promise<number> {
  const skills = seedableSkills(subject)
  const ids = skills.map((s) => s.id)
  if (ids.length > 0) {
    await tx
      .delete(skillState)
      .where(and(eq(skillState.learnerId, learnerId), inArray(skillState.skillId, ids), eq(skillState.nAnswers, 0), inArray(skillState.gate, ['review', 'mastered'])))
  }
  const plan = seedPlan(result, skills)
  if (plan.length === 0) return 0
  await tx
    .insert(skillState)
    .values(plan.map((p) => ({ orgId: ctx.orgId, learnerId, skillId: p.skillId, theta: p.theta, nAnswers: 0, recent: [], gate: p.gate, stars: p.stars })))
    .onConflictDoNothing()
  return plan.length
}

/** Lewati tes ini. Tidak ditanya lagi sampai orang tua menyiapkannya kembali. */
export async function skipPlacement(tx: Tx, learnerId: string, subjectRaw: string): Promise<void> {
  const subject = subjectSchema.parse(subjectRaw)
  await tx
    .update(placementRun)
    .set({ status: 'skipped', finishedAt: new Date(), current: null })
    .where(and(eq(placementRun.learnerId, learnerId), eq(placementRun.subject, subject), inArray(placementRun.status, ['ready', 'in_progress'])))
}

// ---------------------------------------------------------------------------
// Orang tua

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function dateId(d: Date): string {
  const j = new Date(d.getTime() + 7 * 3600000)
  return `${j.getUTCDate()} ${MONTHS[j.getUTCMonth()]} ${j.getUTCFullYear()}`
}

const STATUS_TEXT = { kuat: 'Kuat', cukup: 'Cukup baik', perlu: 'Perlu latihan', belum: 'Belum diuji' } as const

export const PLACEMENT_DISCLAIMER =
  'Ini perkiraan singkat dari 8 sampai 12 soal, bukan penilaian resmi dan bukan asesmen Cambridge. Kira memakainya untuk memilih soal pertama yang pas, lalu menyesuaikan terus saat anak belajar.'

function titleOf(skillId: string): string {
  return skill(skillId)?.titleId ?? skillId
}

export function resultDTO(run: Pick<RunRow, 'id' | 'subject' | 'result' | 'finishedAt'>, learnerName: string, parentGrade: number): PlacementResultDTO | null {
  const r = run.result as PlacementResult | null
  if (!r || !run.finishedAt) return null
  const subject = run.subject as Subject
  const diff = r.levelExact - parentGrade
  const vsGrade =
    diff >= 0.5
      ? `Sedikit di atas kelas ${parentGrade} yang Ibu atau Bapak sebutkan. Kira akan mulai dari materi yang lebih menantang.`
      : diff <= -0.5
        ? `Sedikit di bawah kelas ${parentGrade}. Itu hal yang wajar dan bisa dikejar: Kira mulai dari materi yang pas supaya ${learnerName} merasa mampu dulu.`
        : `Sejalan dengan kelas ${parentGrade} yang Ibu atau Bapak sebutkan.`
  const weak = r.groups.filter((x) => x.status === 'perlu')
  const focus = r.focus.map((t) => ({ title: titleOf(t.skillId), grade: t.grade }))
  // Lengkapi sampai tiga dari materi berikutnya di tingkat itu, supaya orang tua selalu melihat arah yang jelas.
  if (focus.length < 3) {
    const taken = new Set([...r.focus.map((t) => t.skillId), ...r.strengths.map((t) => t.skillId)])
    const pool = [...skillsFor(subject, r.level), ...skillsFor(subject, Math.min(6, r.level + 1))].filter((s) => s.strand !== 'Oly' && !MANUAL_STRANDS.has(s.strand) && !taken.has(s.id))
    for (const s of pool) {
      if (focus.length >= 3) break
      focus.push({ title: s.titleId, grade: s.grade })
    }
  }
  const next = [
    `Sesi harian ${LABEL[subject]} mulai dari materi kelas ${sessionStartGrade(r.level, parentGrade)}.`,
    r.level > 1 ? 'Topik di bawah tingkat ini ditandai untuk diulang ringan, jadi tidak diajarkan dari nol.' : 'Kira mulai dari dasar dengan langkah kecil.',
    weak.length > 0 ? `Kira terus memantau ${weak.map((w) => w.label.toLowerCase()).join(' dan ')} dan menyesuaikan tingkat soalnya.` : 'Kira menaikkan tingkat soal sedikit demi sedikit saat jawaban makin yakin.',
    'Tes ulang bisa disiapkan sebulan sekali dari halaman ini.',
  ]
  return {
    runId: run.id,
    subject,
    label: LABEL[subject],
    finishedAt: run.finishedAt.toISOString(),
    answered: r.answered,
    levelText: `sekitar kelas ${r.level}`,
    level: r.level,
    vsGrade,
    confidenceText: r.confidence === 'cukup' ? `Perkiraan cukup stabil setelah ${r.answered} soal.` : `Perkiraan masih kasar (${r.answered} soal). Tes ulang akan lebih tajam.`,
    groups: r.groups.map((x) => ({ id: x.id, label: x.label, status: x.status, statusText: STATUS_TEXT[x.status], asked: x.asked, correct: x.correct })),
    strengths: r.strengths.map((t) => ({ title: titleOf(t.skillId), grade: t.grade })),
    focus,
    next,
  }
}

/** Bagian "Tes penempatan" di halaman anak untuk orang tua. Dibaca sebagai guardian (RLS menjaga tautan). */
export async function parentPlacement(tx: Tx, learner: LearnerRow): Promise<ParentPlacementDTO> {
  const on = await placementOn(tx, learner.userId)
  if (!on) return { enabled: false, subjects: [], disclaimer: PLACEMENT_DISCLAIMER }
  const rows = await tx.select().from(placementRun).where(eq(placementRun.learnerId, learner.userId)).orderBy(desc(placementRun.createdAt))
  const subjects: ParentPlacementSubjectDTO[] = []
  for (const subject of await enabledSubjects(tx, learner.userId)) {
    const mine = rows.filter((r) => r.subject === subject)
    const open = mine.find((r) => r.status === 'ready' || r.status === 'in_progress')
    const done = mine.filter((r) => r.status === 'done').sort((a, b) => (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0))[0]
    const state: ParentPlacementSubjectDTO['state'] = open ? (open.status === 'ready' ? 'siap' : 'berjalan') : done ? 'selesai' : mine.length > 0 ? 'dilewati' : 'belum'
    const allowedAt = retakeAllowedAt(done?.finishedAt ?? null)
    const tooSoon = allowedAt !== null && allowedAt.getTime() > Date.now()
    subjects.push({
      subject,
      label: LABEL[subject],
      state,
      result: done ? resultDTO(done, learner.name, learner.grade) : null,
      canRequest: !open && !tooSoon,
      requestNote: open
        ? `${learner.name} akan melihatnya di layar Hari Ini.`
        : tooSoon
          ? `Tes ulang bisa disiapkan lagi mulai ${dateId(allowedAt)}. Satu kali sebulan supaya anak tidak merasa diuji terus.`
          : null,
    })
  }
  return { enabled: true, subjects, disclaimer: PLACEMENT_DISCLAIMER }
}

/** Orang tua menyiapkan tes (atau tes ulang). Satu kali sebulan setelah tes selesai. Pemanggil sudah memastikan tautan orang tua. */
export async function requestPlacement(tx: Tx, ctx: OrgContext, learnerId: string, subjectRaw: string, origin: 'parent' | 'tutor' = 'parent'): Promise<void> {
  const subject = subjectSchema.parse(subjectRaw)
  if (!(await placementOn(tx, learnerId)) || !(await isFeatureOnTx(tx, learnerId, subject))) throw conflict('Tes penempatan belum aktif untuk mapel ini.')
  const learner = await loadLearner(tx, learnerId)
  const rows = await tx.select().from(placementRun).where(and(eq(placementRun.learnerId, learnerId), eq(placementRun.subject, subject)))
  if (rows.some((r) => r.status === 'ready' || r.status === 'in_progress')) throw conflict('Tes ini sudah disiapkan. Anak akan melihatnya di layar Hari Ini.')
  const last = rows.filter((r) => r.status === 'done' && r.finishedAt).sort((a, b) => b.finishedAt!.getTime() - a.finishedAt!.getTime())[0]
  const allowedAt = retakeAllowedAt(last?.finishedAt ?? null)
  if (allowedAt && allowedAt.getTime() > Date.now()) throw conflict(`Tes ulang bisa disiapkan lagi mulai ${dateId(allowedAt)}.`)
  await tx.insert(placementRun).values({ orgId: ctx.orgId, learnerId, subject, origin, startGrade: learner.grade, theta: startTheta(learner.grade) })
}

