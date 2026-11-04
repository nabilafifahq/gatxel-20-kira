import 'server-only'
import { and, asc, eq, lte, ne, sql } from 'drizzle-orm'
import {
  DAY_TEMPLATES,
  dropTaperEntries,
  LATIHAN_COUNT,
  TES_COUNT,
  TES_SECONDS_PER_QUESTION,
  assembleQuest,
  assembleSession,
  chooseSkill,
  composeDay,
  createRng,
  defaultTemplate,
  pickItems,
  tesTimeLimitSec,
  weekStart,
  type DayEntry,
  type DayTemplate,
  type IsoDate,
  type PaperKind,
  type PlannedSlot,
  type QuestSlot,
  type SessionType,
} from '@kira/core'
import { tables } from '@kira/db'
import { genRef, instanceSignature, newSeed } from '@kira/content/math'
import { isFeatureOn } from './learner-features'
import type { Subject } from '@/lib/dto'
import { dictFor, type Dict, type UiLang } from '@/lib/i18n'
import { getLang } from '@/lib/i18n/server'
import type { OrgContext, Tx } from '../db'
import { conflict, notFound } from '../errors'
import { poolForSkill, preset, resolveItems, skill, skillsFor, type PoolCandidate } from './content'
import { guardAttemptItems } from './session-guard'
import { pickDailyPaper, taperSubjects } from './daily-paper'
import { paperPresetFor } from './daily-paper-scoring'
import { isRestDay, loadLearner, markerFor, recentGeneratedContent, recentSeen, refreshDayRecord, skillStates, type LearnerRow } from './learner-core'
import { dayRulesFor } from './learner-rules'
import { featureMapFor } from './learner-features'
import { sessionAllowed } from '@kira/core/features'
import { placementStartGrade } from './placement-grade'

const { quest, attempt, planSlot, planWeek, reviewCard, paper, response } = tables

export const SUBJECT_ORDER: Subject[] = ['math', 'english', 'science']
export const SUBJECT_LABEL: Record<Subject, string> = { math: 'Math', english: 'English', science: 'Science' }

export type QuestRow = typeof quest.$inferSelect
export type AttemptRow = typeof attempt.$inferSelect
export type SlotRow = typeof planSlot.$inferSelect
export type AttemptItem = {
  ref: string
  section: QuestSlot['section']
  position: number
  difficulty: number
  /** Nomor soal pada aturan skor preset. Kosong berarti sama dengan position (paper yang diulang diacak). */
  scorePos?: number
  /** Soal saudara dari putaran perbaikan: nomor soal yang salah. Tidak ikut skor sesi. */
  remedialOf?: number
}

const MANUAL_STRANDS = new Set(['Wc', 'SL', 'Wp'])
/** Sesi yang dikerjakan di runner Kira. */
const RUNNER_SESSIONS: ReadonlySet<SessionType> = new Set(['latihan', 'tes', 'paper', 'reading'])

/** Tujuan sesi tautan. Halaman arena dan keterampilan English dibuat fase lain; alamatnya ada di sini saja. */
const LINK_HREF = { review: '/review', 'quick-maths': '/quick-maths', knowledge: '/quiz-arena', esmo: '/esmo' } as const

export function isLinkQuest(q: Pick<QuestRow, 'session'>): boolean {
  return !RUNNER_SESSIONS.has(q.session)
}

/** Tujuan tombol untuk sesi tautan; null untuk sesi yang dikerjakan di runner. */
export function linkHref(q: Pick<QuestRow, 'session' | 'skillId' | 'config'>): string | null {
  const cfg = (q.config as { presetId?: string; task?: string } | null) ?? {}
  switch (q.session) {
    case 'lesson':
      return q.skillId ? `/lesson/${q.skillId}` : '/map'
    case 'simulation':
      return cfg.presetId && /^[a-z0-9-]+$/.test(cfg.presetId) ? `/competitions/${cfg.presetId}` : '/competitions'
    case 'english-skill':
      return cfg.task && /^[a-z]+$/.test(cfg.task) ? `/english?task=${cfg.task}` : '/english'
    case 'review':
    case 'quick-maths':
    case 'knowledge':
    case 'esmo':
      return LINK_HREF[q.session]
    default:
      return null
  }
}

/** Ubah kandidat generator tanpa seed menjadi ref lengkap dengan seed baru. */
function materialise(ref: string, rng: ReturnType<typeof createRng>, taken: Set<string> = new Set(), seenRefs: ReadonlyMap<string, number> = new Map()): string {
  const m = /^gen:([mes][1-6]\.[a-z0-9-]+):([1-5])$/.exec(ref)
  if (!m) return ref
  const make = () => genRef(m[1]!, Number(m[2]) as 1 | 2 | 3 | 4 | 5, newSeed(rng))
  // Seed baru dicoba ulang sampai instansnya (soal dan jawaban) belum ada di sesi ini dan belum pernah dijawab learner.
  let out = make()
  for (let i = 0; i < 40; i++) {
    const sig = instanceSignature(out)
    if (!taken.has(sig) && !seenRefs.has(out)) {
      taken.add(sig)
      return out
    }
    out = make()
  }
  taken.add(instanceSignature(out))
  return out
}


// ---------------------------------------------------------------------------
// Soal sesi

export type BuildInput = {
  skillId: string
  subject: Subject
  mode: 'belajar' | 'latihan'
  date: IsoDate
  seedKey: string
  length?: number
  /** easy: Latihan harian (soal mudah). test: Tes harian (soal sedang sampai sulit). Kosong: perilaku quest lama. */
  style?: 'easy' | 'test'
  /** Soal yang dihindari bila masih ada pilihan lain (sesi lain hari itu, percobaan sebelumnya). */
  avoid?: ReadonlySet<string>
  allowManual?: boolean
  /**
   * Soal foto jawaban (science dan math) boleh masuk Latihan. Hanya untuk sesi yang dipilihkan tutor: pemilih
   * otomatis harian tidak memakainya karena MANUAL_STRANDS hanya memuat strand menulis dan bicara.
   */
  allowPhoto?: boolean
  /** Latihan Bebas: skill tambahan yang ikut dalam satu kumpulan soal (satu topik punya beberapa skill). */
  extraSkills?: readonly string[]
  /** Latihan Bebas: saring kandidat (gaya soal, gaya lomba). Dengan saringan ini soal tidak diisi dari skill lain. */
  accept?: (c: PoolCandidate) => boolean
}

function questLength(learner: LearnerRow, mode: string): number {
  if (mode === 'belajar') return 6
  return learner.grade <= 1 ? 8 : 10
}

/** Isi sisa soal dari skill lain di mapel dan grade yang sama saat bank soal skill ini habis. */
async function topUp(
  tx: Tx,
  ctx: OrgContext,
  input: { skillId: string; subject: Subject; slots: QuestSlot[]; count: number; theta: number; style: 'easy' | 'test'; avoid: ReadonlySet<string>; seen: Map<string, number>; rng: ReturnType<typeof createRng>; manipulatives: boolean },
): Promise<QuestSlot[]> {
  const need = input.count - input.slots.length
  if (need <= 0) return input.slots
  const sk = skill(input.skillId)
  const near = skillsFor(input.subject, sk?.grade ?? 2).filter((s) => s.id !== input.skillId && s.strand !== 'Oly' && !MANUAL_STRANDS.has(s.strand))
  const ordered = [...near.filter((s) => s.strand === sk?.strand), ...near.filter((s) => s.strand !== sk?.strand)]
  const cands: PoolCandidate[] = []
  let fresh = 0
  for (const [i, s] of ordered.entries()) {
    // Enam skill terdekat dulu; skill lain mapel dan kelas ini hanya bila soal yang belum dilihat masih kurang.
    if (i >= 6 && fresh >= need) break
    const pool = await poolForSkill(tx, ctx.orgId, s.id, { allowManual: false, manipulatives: input.manipulatives, playableOnly: input.style === 'test' })
    cands.push(...pool)
    fresh += pool.filter((c) => c.unlimited || (!input.seen.has(c.ref) && !input.avoid.has(c.ref))).length
  }
  const picked = pickItems({
    candidates: cands.map((c) => ({ ...c, ...(input.seen.has(c.ref) && !c.unlimited ? { seenDaysAgo: input.seen.get(c.ref)! } : {}) })),
    theta: input.theta,
    count: need,
    band: input.style === 'test' ? [0.55, 0.75] : [0.85, 0.95],
    rng: input.rng,
    exclude: new Set([...input.slots.map((s) => s.ref), ...input.avoid]),
  })
  return [...input.slots, ...picked.map((p) => ({ ref: p.candidate.ref, section: 'core' as const, difficulty: p.candidate.difficulty }))]
}

export async function buildQuestItems(tx: Tx, ctx: OrgContext, learner: LearnerRow, input: BuildInput): Promise<AttemptItem[]> {
  const rng = createRng(input.seedKey)
  const sk = skill(input.skillId)
  const allowManual = input.allowManual ?? (input.style === 'test' ? false : sk ? MANUAL_STRANDS.has(sk.strand) : false)
  const manipulatives = await isFeatureOn(learner.userId, 'manipulatives')
  const playableOnly = input.style === 'test'
  let pool = await poolForSkill(tx, ctx.orgId, input.skillId, { allowManual, manipulatives, playableOnly, ...(input.allowPhoto ? { allowPhoto: true } : {}) })
  for (const sid of input.extraSkills ?? []) pool = [...pool, ...(await poolForSkill(tx, ctx.orgId, sid, { allowManual: false, manipulatives, playableOnly }))]
  if (input.accept) pool = pool.filter(input.accept)
  const seen = await recentSeen(tx, learner.userId)
  const states = await skillStates(tx, learner.userId)
  const theta = states.get(input.skillId)?.theta ?? 0
  const due =
    learner.reviewEnabled && input.style !== 'test'
      ? await tx
          .select({ ref: reviewCard.itemRef })
          .from(reviewCard)
          .where(and(eq(reviewCard.learnerId, learner.userId), eq(reviewCard.subject, input.subject), eq(reviewCard.retired, false), lte(reviewCard.dueAt, new Date(Date.parse(`${input.date}T23:59:59+07:00`)))))
          .orderBy(asc(reviewCard.dueAt))
          .limit(3)
      : []
  const dueItems = await resolveItems(tx, due.map((d) => d.ref))
  const withSeen = (list: PoolCandidate[]) => list.map((c) => ({ ...c, ...(seen.has(c.ref) && !c.unlimited ? { seenDaysAgo: seen.get(c.ref)! } : {}) }))
  const dueRefs = [...dueItems.entries()].map(([ref, item]) => ({ ref, difficulty: item.difficulty }))
  const manual = pool.filter((p) => p.manual)
  let slots: QuestSlot[]
  if (allowManual && manual.length > 0) {
    // Skill menulis atau berbicara: satu tugas yang dinilai tutor ditambah soal otomatis.
    const auto = pool.filter((p) => !p.manual)
    const fresh = manual.filter((m) => !seen.has(m.ref) && !(input.avoid?.has(m.ref) ?? false))
    const pickManual = rng.pick(fresh.length ? fresh : manual)
    const rest = assembleQuest({ mode: input.mode, theta, dueRefs: [], candidates: withSeen(auto), length: Math.max(0, Math.min(4, auto.length)), rng })
    slots = [...rest, { ref: pickManual.ref, section: 'core', difficulty: pickManual.difficulty }]
  } else if (input.style) {
    const count = input.length ?? (input.style === 'test' ? TES_COUNT : LATIHAN_COUNT)
    const avoid = input.avoid ?? new Set<string>()
    slots = assembleSession({ kind: input.style === 'test' ? 'tes' : 'latihan', theta, dueRefs, candidates: withSeen(pool), count, avoid, reuse: false, rng })
    // Bank soal skill ini kurang: isi dari skill lain mapel yang sama, dan baru terakhir dengan soal yang dihindari.
    if (!input.accept) slots = await topUp(tx, ctx, { skillId: input.skillId, subject: input.subject, slots, count, theta, style: input.style, avoid, seen, rng, manipulatives })
    if (slots.length < count) {
      const used = new Set(slots.map((s) => s.ref))
      const band: [number, number] = input.style === 'test' ? [0.55, 0.75] : [0.85, 0.95]
      const more = pickItems({ candidates: withSeen(pool), theta, count: count - slots.length, band, rng, exclude: used })
      slots = [...slots, ...more.map((p) => ({ ref: p.candidate.ref, section: 'core' as const, difficulty: p.candidate.difficulty }))]
    }
  } else {
    slots = assembleQuest({ mode: input.mode, theta, dueRefs, candidates: withSeen(pool), length: input.length ?? questLength(learner, input.mode), rng })
  }
  const taken = recentGeneratedContent(seen)
  const built = slots.map((s, i) => ({ ref: materialise(s.ref, rng, taken, seen), section: s.section, position: i + 1, difficulty: s.difficulty }))
  // Pengganti dari penjaga juga menghindari soal yang sudah pernah dijawab, selama bank masih punya pilihan.
  return guardAttemptItems(tx, built, { seed: `${input.seedKey}:guard`, mode: input.mode, avoid: new Set([...(input.avoid ?? []), ...seen.keys()]) })
}

/** Pilih skill otomatis untuk satu mapel bila tutor belum merencanakan. */
/** `grade`: kelas titik awal dari tes penempatan; kosong berarti kelas anak. */
export function autoSkill(learner: LearnerRow, subject: Subject, states: Awaited<ReturnType<typeof skillStates>>, seedKey: string, grade: number = learner.grade) {
  const list = skillsFor(subject, grade).filter((s) => s.strand !== 'Oly')
  const progress = list.map((s) => ({
    id: s.id,
    order: s.order,
    gate: states.get(s.id)?.gate ?? ('new' as const),
    prerequisites: s.prerequisites,
    lastPracticed: states.get(s.id)?.lastPracticed ?? null,
  }))
  return chooseSkill(progress, createRng(seedKey))
}

// ---------------------------------------------------------------------------
// Rencana satu sesi: soal, waktu, dan judul

type Plan = { title: string; mode: 'belajar' | 'latihan' | 'tes'; items: AttemptItem[]; timeLimitS: number | null; presetId: string | null }

type PlanSpec = {
  session: SessionType
  subject: Subject
  /** Skill sesi. Paper memakainya hanya sebagai cadangan bila belum ada paper bergaya lomba. */
  skillId: string | null
  paperId: string | null
  /** Mode slot rencana: menentukan apakah paper dari Penyusun paper berwaktu. */
  mode: string
  paper: PaperKind | null
  count: number | null
  perQuestionSec: number | null
  date: IsoDate
  seedKey: string
  /** Sesi berasal dari slot rencana tutor (bukan pilihan otomatis): soal foto jawaban boleh ikut Latihan. */
  assigned: boolean
  /** Sesi wajib (dihitung streak). Keluarga tanpa tutor: soal tulis, bicara, gambar, dan foto tidak masuk sesi wajib. */
  required: boolean
}

function paperItems(refs: readonly string[], resolved: Map<string, { difficulty: number }>): AttemptItem[] {
  return refs.map((ref, i) => ({ ref, section: 'core' as const, position: i + 1, difficulty: resolved.get(ref)?.difficulty ?? 3 }))
}

async function itemRefsOf(tx: Tx, attemptId: string | null): Promise<string[]> {
  if (!attemptId) return []
  const [a] = await tx.select({ items: attempt.items }).from(attempt).where(eq(attempt.id, attemptId)).limit(1)
  return ((a?.items as AttemptItem[] | undefined) ?? []).map((i) => i.ref)
}

async function planAttempt(tx: Tx, ctx: OrgContext, learner: LearnerRow, spec: PlanSpec, avoid: ReadonlySet<string>): Promise<Plan | null> {
  const { session, subject } = spec
  if (spec.paperId) {
    const [p] = await tx.select().from(paper).where(eq(paper.id, spec.paperId)).limit(1)
    if (p) {
      const resolved = await resolveItems(tx, p.itemRefs)
      // Paper dari Penyusun paper: mode paper menentukan berwaktu atau tidak (Latihan tanpa waktu, Tes dengan waktu).
      const timed = spec.mode === 'tes'
      return { title: p.title, mode: timed ? 'tes' : 'latihan', items: paperItems(p.itemRefs, resolved), timeLimitS: timed ? p.minutes * 60 : null, presetId: null }
    }
  }
  if (session === 'latihan' || session === 'reading') {
    if (!spec.skillId) return null
    const legacy = spec.mode === 'belajar'
    const noManual = spec.required && (await markerFor(tx)) === 'grownup'
    const items = await buildQuestItems(tx, ctx, learner, {
      skillId: spec.skillId,
      subject,
      mode: legacy ? 'belajar' : 'latihan',
      date: spec.date,
      seedKey: spec.seedKey,
      ...(legacy ? { length: spec.count ?? 6 } : { style: 'easy' as const, length: spec.count ?? LATIHAN_COUNT }),
      avoid,
      ...(noManual ? { allowManual: false } : spec.assigned ? { allowPhoto: true } : {}),
    })
    return { title: skill(spec.skillId)?.title ?? SUBJECT_LABEL[subject], mode: legacy ? 'belajar' : 'latihan', items, timeLimitS: null, presetId: null }
  }
  if (session === 'tes') {
    if (!spec.skillId) return null
    const items = await buildQuestItems(tx, ctx, learner, {
      skillId: spec.skillId,
      subject,
      mode: 'latihan',
      date: spec.date,
      seedKey: spec.seedKey,
      style: 'test',
      length: spec.count ?? TES_COUNT,
      avoid,
    })
    const timeLimitS = tesTimeLimitSec(items.length, spec.perQuestionSec ?? TES_SECONDS_PER_QUESTION)
    return { title: skill(spec.skillId)?.title ?? SUBJECT_LABEL[subject], mode: 'tes', items, timeLimitS, presetId: null }
  }
  if (session === 'paper') {
    const kind: PaperKind = spec.paper ?? 'mini'
    const picked = await pickDailyPaper(tx, { orgId: ctx.orgId, learnerId: learner.userId, grade: learner.grade }, subject, spec.date, kind)
    if (picked && picked.itemRefs.length > 0) {
      const resolved = await resolveItems(tx, picked.itemRefs)
      return {
        title: picked.title,
        mode: 'tes',
        items: paperItems(picked.itemRefs, resolved),
        timeLimitS: picked.minutes * 60,
        presetId: paperPresetFor(subject, learner.grade, spec.date)?.id ?? null,
      }
    }
    // Belum ada soal bergaya lomba untuk mapel ini: paper latihan dari skill hari ini, supaya hari tetap lengkap.
    if (!spec.skillId) return null
    const items = await buildQuestItems(tx, ctx, learner, { skillId: spec.skillId, subject, mode: 'latihan', date: spec.date, seedKey: spec.seedKey, style: 'test', length: kind === 'mini' ? 8 : 20, avoid })
    return { title: `${SUBJECT_LABEL[subject]} practice paper`, mode: 'tes', items, timeLimitS: (kind === 'mini' ? 15 : 45) * 60, presetId: null }
  }
  return null
}

async function insertAttempt(tx: Tx, ctx: OrgContext, learnerId: string, q: Pick<QuestRow, 'id' | 'subject'>, plan: Plan): Promise<string> {
  const guarded = await guardAttemptItems(tx, plan.items, { seed: `${q.id}:guard`, mode: plan.mode })
  const [row] = await tx
    .insert(attempt)
    .values({
      orgId: ctx.orgId,
      learnerId,
      kind: 'quest',
      refId: q.id,
      mode: plan.mode,
      subject: q.subject,
      title: plan.title,
      items: guarded,
      timeLimitS: plan.timeLimitS,
      presetId: plan.presetId,
    })
    .returning({ id: attempt.id })
  await tx.update(quest).set({ attemptId: row!.id }).where(eq(quest.id, q.id))
  return row!.id
}

function seedKeyOf(q: Pick<QuestRow, 'learnerId' | 'date' | 'subject' | 'kind' | 'session' | 'seq'>): string {
  return `${q.learnerId}:${q.date}:${q.subject}:${q.kind}:${q.session}:${q.seq}`
}

/** Buat attempt untuk quest yang belum punya (quest lama, atau attempt gagal dibuat). Sesi tautan tidak punya attempt. */
export async function createAttemptFor(tx: Tx, ctx: OrgContext, learner: LearnerRow, q: QuestRow): Promise<string | null> {
  if (isLinkQuest(q)) return null
  const cfg = (q.config as { paper?: PaperKind; perQuestionSec?: number } | null) ?? {}
  const avoid = new Set<string>()
  if (q.session === 'tes') {
    const lat = await tx
      .select({ attemptId: quest.attemptId })
      .from(quest)
      .where(and(eq(quest.learnerId, q.learnerId), eq(quest.date, q.date), eq(quest.subject, q.subject), eq(quest.session, 'latihan')))
    for (const l of lat) for (const ref of await itemRefsOf(tx, l.attemptId)) avoid.add(ref)
  }
  let skillId = q.skillId
  if (!skillId && (q.session === 'paper' || q.session === 'tes' || q.session === 'latihan')) {
    skillId = autoSkill(learner, q.subject as Subject, await skillStates(tx, learner.userId), `${learner.userId}:${q.date}:${q.subject}`, await placementStartGrade(tx, learner, q.subject as Subject))?.id ?? null
  }
  const plan = await planAttempt(
    tx,
    ctx,
    learner,
    {
      session: q.session as SessionType,
      subject: q.subject as Subject,
      skillId,
      paperId: q.paperId,
      mode: q.mode,
      paper: cfg.paper ?? null,
      count: null,
      perQuestionSec: cfg.perQuestionSec ?? null,
      date: q.date,
      seedKey: seedKeyOf(q),
      assigned: q.planSlotId !== null,
      required: q.kind === 'daily',
    },
    avoid,
  )
  return plan ? insertAttempt(tx, ctx, learner.userId, q, plan) : null
}

// ---------------------------------------------------------------------------
// Sesi hari ini

const EXTRA_TITLE: Partial<Record<SessionType, string>> = {
  review: 'Review cards',
  'quick-maths': 'Quick Maths challenge',
  knowledge: 'Knowledge quiz',
  esmo: 'ESMO practice',
}

function extraTitle(session: SessionType, row: SlotRow | undefined): string {
  const cfg = (row?.config as { presetId?: string; task?: string } | null) ?? {}
  if (session === 'simulation') return (cfg.presetId ? preset(cfg.presetId)?.title : undefined) ?? 'Competition practice'
  if (session === 'english-skill') return cfg.task ? `English ${cfg.task}` : 'English task'
  if (session === 'lesson') return row?.skillId ? (skill(row.skillId)?.title ?? 'Lesson') : 'Lesson'
  return EXTRA_TITLE[session] ?? 'Extra session'
}

function templateOf(templates: unknown, date: IsoDate): DayTemplate {
  const v = (templates as Record<string, unknown> | null)?.[date]
  return typeof v === 'string' && (DAY_TEMPLATES as readonly string[]).includes(v) ? (v as DayTemplate) : defaultTemplate(date)
}

/** Slot rencana yang sudah terbit untuk satu hari, lengkap dengan templatenya. */
export async function publishedDay(tx: Tx, learnerId: string, date: IsoDate): Promise<{ template: DayTemplate; rows: SlotRow[] }> {
  const [week] = await tx
    .select({ id: planWeek.id, templates: planWeek.dayTemplates })
    .from(planWeek)
    .where(and(eq(planWeek.learnerId, learnerId), eq(planWeek.weekStart, weekStart(date)), eq(planWeek.status, 'published')))
    .limit(1)
  if (!week) return { template: defaultTemplate(date), rows: [] }
  const rows = await tx
    .select()
    .from(planSlot)
    .where(and(eq(planSlot.planWeekId, week.id), eq(planSlot.learnerId, learnerId), eq(planSlot.date, date)))
    .orderBy(asc(planSlot.createdAt), asc(planSlot.id))
  return { template: templateOf(week.templates, date), rows }
}

export function plannedSlots(rows: readonly SlotRow[]): PlannedSlot[] {
  return rows.map((r, i) => ({
    id: r.id,
    subject: r.subject,
    session: r.session,
    required: r.kind === 'bonus' ? false : r.required,
    paperKind: r.paperKind,
    order: i,
    base: r.base,
    off: r.off,
  }))
}

// ---------------------------------------------------------------------------
// Isi sesi yang diminta sebuah entri hari, dan perbandingannya dengan sesi yang sudah dibuat

/** Isi yang diminta rencana untuk satu sesi. Nilai null berarti "terserah Kira" dan tidak dibandingkan. */
type Want = { s: string | null; m: string; n: number | null; p: PaperKind | null; q: number | null; d: string | null; r: string | null; t: string | null }
const WANT_KEYS = ['s', 'm', 'n', 'p', 'q', 'd', 'r', 't'] as const

const COUNTED: ReadonlySet<SessionType> = new Set(['latihan', 'tes', 'reading'])

function wantOf(entry: DayEntry, row: SlotRow | undefined): Want {
  const cfg = (row?.config as Record<string, unknown> | null) ?? {}
  const counted = COUNTED.has(entry.session)
  return {
    s: row?.skillId ?? null,
    m: row?.mode === 'belajar' ? 'belajar' : entry.session === 'tes' ? 'tes' : 'latihan',
    n: counted ? (row ? row.questionCount : entry.session === 'tes' ? TES_COUNT : LATIHAN_COUNT) : null,
    p: entry.session === 'paper' ? (entry.paper ?? 'mini') : null,
    q: entry.session === 'tes' ? (typeof cfg.perQuestionSec === 'number' ? cfg.perQuestionSec : TES_SECONDS_PER_QUESTION) : null,
    d: row?.paperId ?? null,
    r: typeof cfg.presetId === 'string' ? cfg.presetId : null,
    t: typeof cfg.task === 'string' ? cfg.task : null,
  }
}

/** Isi yang tercatat di quest: catatan `w` dari saat dibuat, atau turunan dari kolom quest lama (jumlah soal tidak diketahui). */
function haveOf(q: Pick<QuestRow, 'config' | 'skillId' | 'mode' | 'paperId' | 'session'>): Partial<Want> {
  const cfg = (q.config as { w?: Partial<Want>; paper?: PaperKind; perQuestionSec?: number; presetId?: string; task?: string } | null) ?? {}
  if (cfg.w && typeof cfg.w === 'object') return cfg.w
  return {
    s: q.skillId,
    m: q.mode,
    p: cfg.paper ?? null,
    q: q.session === 'tes' ? (cfg.perQuestionSec ?? TES_SECONDS_PER_QUESTION) : null,
    d: q.paperId,
    r: cfg.presetId ?? null,
    t: cfg.task ?? null,
  }
}

function contentDiffers(q: QuestRow, want: Want): boolean {
  const have = haveOf(q)
  return WANT_KEYS.some((k) => want[k] !== null && have[k] !== undefined && want[k] !== have[k])
}

/** Apakah isi yang diminta sebuah slot berbeda dari sesi hari ini yang sudah ada (jenis, mapel, skill, jumlah soal, mode, paper, atau detik per soal). */
export function questContentDiffers(
  q: QuestRow,
  input: { session: SessionType; subject: Subject; skillId: string | null; mode: string; questionCount: number; paperKind: PaperKind | null; paperId: string | null; config: Record<string, unknown> | null },
): boolean {
  if (q.session !== input.session || q.subject !== input.subject) return true
  const cfg = input.config ?? {}
  const counted = COUNTED.has(input.session)
  return contentDiffers(q, {
    s: input.skillId,
    m: input.mode === 'belajar' ? 'belajar' : input.session === 'tes' ? 'tes' : 'latihan',
    n: counted ? input.questionCount : null,
    p: input.session === 'paper' ? (input.paperKind ?? 'mini') : null,
    q: input.session === 'tes' ? (typeof cfg.perQuestionSec === 'number' ? cfg.perQuestionSec : TES_SECONDS_PER_QUESTION) : null,
    d: input.paperId,
    r: typeof cfg.presetId === 'string' ? cfg.presetId : null,
    t: typeof cfg.task === 'string' ? cfg.task : null,
  })
}

/** Isi slot yang setara dengan sesi hari ini yang sudah ada, supaya mengubah Wajib atau Opsional tidak mengubah isinya. */
export function questSlotValues(q: QuestRow): { mode: 'latihan' | 'tes' | 'belajar'; questionCount: number; paperKind: PaperKind | null; config: Record<string, string | number> | null } {
  const have = haveOf(q)
  const cfg = (q.config as { perQuestionSec?: number; presetId?: string; task?: string } | null) ?? {}
  const config: Record<string, string | number> = {}
  if (q.session === 'tes' && typeof have.q === 'number' && have.q !== TES_SECONDS_PER_QUESTION) config.perQuestionSec = have.q
  if (typeof cfg.presetId === 'string') config.presetId = cfg.presetId
  if (typeof cfg.task === 'string') config.task = cfg.task
  return {
    mode: have.m === 'belajar' ? 'belajar' : q.session === 'tes' ? 'tes' : 'latihan',
    questionCount: typeof have.n === 'number' ? have.n : q.session === 'tes' ? TES_COUNT : LATIHAN_COUNT,
    paperKind: q.session === 'paper' ? (have.p ?? 'mini') : null,
    config: Object.keys(config).length > 0 ? config : null,
  }
}

/** Isi yang dicatat di quest baru: pilihan nyata (skill yang terpilih), bukan "terserah Kira". */
function recordOf(want: Want, skillId: string | null): Want {
  return { ...want, s: skillId }
}

/** Sesi sudah dimulai bila statusnya bukan siap atau sudah ada jawaban. Isinya tidak boleh diganti lagi. */
export async function questStarted(tx: Tx, q: Pick<QuestRow, 'status' | 'attemptId'>): Promise<boolean> {
  if (q.status !== 'ready') return true
  if (!q.attemptId) return false
  const [r] = await tx.select({ n: sql<number>`count(*)::int` }).from(response).where(eq(response.attemptId, q.attemptId))
  return (r?.n ?? 0) > 0
}

export type SyncReport = { created: number; removed: number; regenerated: number; kept: number; flagged: number }

async function deleteQuest(tx: Tx, q: Pick<QuestRow, 'id' | 'attemptId'>): Promise<void> {
  await tx.delete(quest).where(eq(quest.id, q.id))
  if (q.attemptId) await tx.delete(attempt).where(eq(attempt.id, q.attemptId))
}

/**
 * Samakan sesi sebuah hari dengan rencana: aturan hari learner, template, dan slot tutor yang sudah terbit.
 * Aman dipanggil berulang (tablet membuka Today, tutor mengubah hari ini).
 * - Entri yang belum punya sesi dibuat.
 * - Sesi yang belum dimulai dibuat ulang bila isinya berubah, dan dihapus bila entrinya hilang (Mati).
 * - Sesi yang sedang berjalan atau selesai tidak disentuh isinya; hanya Wajib atau Opsional yang bisa berubah
 *   (sesi yang entrinya hilang menjadi opsional).
 * - day_record (sesi wajib dan selesai) dihitung ulang di transaksi yang sama.
 */
export async function syncDay(tx: Tx, ctx: OrgContext, learner: LearnerRow, date: IsoDate): Promise<SyncReport> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`kira-day:${learner.userId}:${date}`}))`)
  const report: SyncReport = { created: 0, removed: 0, regenerated: 0, kept: 0, flagged: 0 }
  const load = () => tx.select().from(quest).where(and(eq(quest.learnerId, learner.userId), eq(quest.date, date)))

  const day = await publishedDay(tx, learner.userId, date)
  const { rules } = await dayRulesFor(tx, learner.userId)
  const rowById = new Map(day.rows.map((r) => [r.id, r]))
  const features = await featureMapFor(tx, learner.userId)
  const entries = dropTaperEntries(composeDay({ template: day.template, date, slots: plannedSlots(day.rows), rules }), await taperSubjects(tx, learner.userId, date)).filter((e) => sessionAllowed(features, e.subject, e.session))
  // Paper Kertas dikerjakan di kertas dan dinilai lewat Input LJK, jadi tidak ada sesi tablet untuk slot itu.
  const live = entries.filter((e) => !(e.slotId && rowById.get(e.slotId)?.mode === 'kertas'))

  const quests = (await load()).filter((q) => q.kind !== 'bonus')
  const started = new Map<string, boolean>()
  for (const q of quests) started.set(q.id, await questStarted(tx, q))

  // Cocokkan entri dengan sesi yang sudah ada: lewat slot dulu, lalu lewat mapel dan jenis sesi.
  const pairOf = new Map<string, QuestRow>()
  const taken = new Set<string>()
  for (const e of live) {
    if (!e.slotId) continue
    const q = quests.find((x) => x.planSlotId === e.slotId)
    if (q) {
      pairOf.set(e.key, q)
      taken.add(q.id)
    }
  }
  for (const e of live) {
    if (pairOf.has(e.key)) continue
    const q = quests
      .filter((x) => !taken.has(x.id) && x.subject === e.subject && x.session === e.session)
      .sort(
        (a, b) =>
          Number(started.get(b.id)) - Number(started.get(a.id)) ||
          Number((b.kind === 'daily') === e.required) - Number((a.kind === 'daily') === e.required) ||
          a.seq - b.seq ||
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      )[0]
    if (q) {
      pairOf.set(e.key, q)
      taken.add(q.id)
    }
  }

  // Sesi tanpa entri: yang belum dimulai dihapus, yang sudah dimulai tetap ada sebagai sesi opsional.
  type Move = { q: QuestRow; kind: 'daily' | 'extra'; seq: number; planSlotId: string | null }
  const moves: Move[] = []
  let orphanSeq = 200
  for (const q of quests) {
    if (taken.has(q.id)) continue
    if (!started.get(q.id)) {
      await deleteQuest(tx, q)
      report.removed++
    } else {
      moves.push({ q, kind: 'extra', seq: orphanSeq++, planSlotId: null })
      if (q.kind === 'daily') report.flagged++
    }
  }

  const regen: { q: QuestRow; entry: DayEntry; row: SlotRow | undefined; want: Want }[] = []
  for (const e of live) {
    const q = pairOf.get(e.key)
    if (!q) continue
    const row = e.slotId ? rowById.get(e.slotId) : undefined
    const kind = e.required ? 'daily' : 'extra'
    if (q.kind !== kind || q.seq !== e.seq || q.planSlotId !== e.slotId) moves.push({ q, kind, seq: e.seq, planSlotId: e.slotId })
    if (q.kind !== kind) report.flagged++
    const want = wantOf(e, row)
    if (!contentDiffers(q, want)) continue
    if (started.get(q.id)) report.kept++
    else regen.push({ q, entry: e, row, want })
  }

  // Ubah jenis, nomor urut, dan slot dalam dua tahap supaya indeks unik quest tidak bertabrakan.
  if (moves.length > 0) {
    let tmp = 1000
    for (const m of moves) await tx.update(quest).set({ seq: tmp++, planSlotId: null }).where(eq(quest.id, m.q.id))
    for (const m of moves) await tx.update(quest).set({ kind: m.kind, seq: m.seq, planSlotId: m.planSlotId }).where(eq(quest.id, m.q.id))
  }

  // Keadaan setelah penyesuaian, untuk memilih skill dan menghindari soal yang sama.
  const current = (await load()).filter((q) => q.kind !== 'bonus')
  const skillBySubject = new Map<Subject, string>()
  for (const q of current.filter((x) => x.session === 'latihan' && x.skillId).sort((a, b) => Number(b.kind === 'daily') - Number(a.kind === 'daily'))) {
    if (!skillBySubject.has(q.subject as Subject)) skillBySubject.set(q.subject as Subject, q.skillId!)
  }
  let states: Awaited<ReturnType<typeof skillStates>> | null = null
  const pickSkill = async (subject: Subject) =>
    skillBySubject.get(subject) ?? autoSkill(learner, subject, (states ??= await skillStates(tx, learner.userId)), `${learner.userId}:${date}:${subject}`, await placementStartGrade(tx, learner, subject))?.id ?? null
  const latihanRefs = new Map<Subject, Set<string>>()
  const refsFor = async (subject: Subject) => {
    let s = latihanRefs.get(subject)
    if (!s) {
      s = new Set()
      for (const q of current) if (q.subject === subject && q.session === 'latihan') for (const ref of await itemRefsOf(tx, q.attemptId)) s.add(ref)
      latihanRefs.set(subject, s)
    }
    return s
  }

  /** Rencanakan soal sebuah entri. null bila tidak ada soal atau skill yang cocok. */
  const planEntry = async (entry: DayEntry, row: SlotRow | undefined, want: Want, seedKey: string, existingSkill: string | null) => {
    const session = entry.session
    const subject = entry.subject
    let skillId = row?.skillId ?? existingSkill
    const needsSkill = session === 'latihan' || session === 'tes' || session === 'reading' || session === 'lesson'
    if (!skillId && (session === 'latihan' || session === 'tes')) skillId = await pickSkill(subject)
    if (needsSkill && !skillId) return null
    // Paper tanpa soal bergaya lomba memakai skill hari ini sebagai cadangan, tetapi tidak menyimpannya di quest.
    const fallbackSkill = session === 'paper' && !row?.paperId ? await pickSkill(subject) : skillId
    if (!RUNNER_SESSIONS.has(session)) return { skillId, plan: null as Plan | null }
    const cfgIn = (row?.config as Record<string, unknown> | null) ?? {}
    const plan = await planAttempt(
      tx,
      ctx,
      learner,
      {
        session,
        subject,
        skillId: fallbackSkill,
        paperId: row?.paperId ?? null,
        mode: row?.mode ?? want.m,
        paper: entry.paper,
        count: row && COUNTED.has(session) ? row.questionCount : null,
        perQuestionSec: typeof cfgIn.perQuestionSec === 'number' ? cfgIn.perQuestionSec : null,
        date,
        seedKey,
        assigned: Boolean(row?.skillId),
        required: entry.required,
      },
      session === 'tes' ? await refsFor(subject) : new Set(),
    )
    if (!plan) return null
    return { skillId, plan }
  }

  const configOf = (entry: DayEntry, row: SlotRow | undefined, want: Want, skillId: string | null) => {
    const cfgIn = (row?.config as Record<string, unknown> | null) ?? {}
    return { ...cfgIn, ...(entry.session === 'paper' ? { paper: entry.paper ?? 'mini' } : {}), w: recordOf(want, entry.session === 'paper' ? null : skillId) }
  }

  // Sesi belum dimulai yang isinya berubah: buat ulang soalnya. Yang gagal direncanakan tetap seperti semula.
  for (const r of regen) {
    const seedKey = `${seedKeyOf({ learnerId: learner.userId, date, subject: r.entry.subject, kind: r.entry.required ? 'daily' : 'extra', session: r.entry.session, seq: r.entry.seq })}:${JSON.stringify(r.want)}`
    const planned = await planEntry(r.entry, r.row, r.want, seedKey, null)
    if (!planned) continue
    const skillId = planned.skillId
    const fields = {
      skillId: r.entry.session === 'paper' ? null : (skillId ?? r.row?.skillId ?? null),
      paperId: r.row?.paperId ?? null,
      mode: r.want.m as QuestRow['mode'],
      config: configOf(r.entry, r.row, r.want, skillId),
      title: planned.plan?.title ?? extraTitle(r.entry.session, r.row),
    }
    if (planned.plan) {
      const oldAttempt = r.q.attemptId
      await tx.update(quest).set({ ...fields, attemptId: null }).where(eq(quest.id, r.q.id))
      if (oldAttempt) await tx.delete(attempt).where(eq(attempt.id, oldAttempt))
      await insertAttempt(tx, ctx, learner.userId, { id: r.q.id, subject: r.q.subject }, planned.plan)
    } else {
      await tx.update(quest).set(fields).where(eq(quest.id, r.q.id))
    }
    if (r.entry.session === 'latihan') latihanRefs.delete(r.entry.subject)
    report.regenerated++
  }

  // Entri baru.
  for (const entry of live) {
    if (pairOf.has(entry.key)) continue
    const row = entry.slotId ? rowById.get(entry.slotId) : undefined
    const kind = entry.required ? 'daily' : 'extra'
    const want = wantOf(entry, row)
    const seedKey = seedKeyOf({ learnerId: learner.userId, date, subject: entry.subject, kind, session: entry.session, seq: entry.seq })
    const planned = await planEntry(entry, row, want, seedKey, null)
    if (!planned) continue
    const [q] = await tx
      .insert(quest)
      .values({
        orgId: ctx.orgId,
        learnerId: learner.userId,
        date,
        subject: entry.subject,
        kind,
        session: entry.session,
        seq: entry.seq,
        planSlotId: entry.slotId,
        config: configOf(entry, row, want, planned.skillId),
        skillId: entry.session === 'paper' ? null : (planned.skillId ?? row?.skillId ?? null),
        paperId: row?.paperId ?? null,
        mode: want.m as QuestRow['mode'],
        title: planned.plan?.title ?? extraTitle(entry.session, row),
      })
      .onConflictDoNothing()
      .returning()
    if (!q) continue
    report.created++
    if (!planned.plan) continue
    await insertAttempt(tx, ctx, learner.userId, q, planned.plan)
    if (entry.session === 'latihan') {
      if (planned.skillId && !skillBySubject.has(entry.subject)) skillBySubject.set(entry.subject, planned.skillId)
      const set = await refsFor(entry.subject)
      for (const it of planned.plan.items) set.add(it.ref)
    }
  }

  // Quest lama yang belum punya attempt (dibuat sebelum attempt-nya sempat terbentuk).
  for (const q of await load()) if (!q.attemptId && q.kind !== 'bonus') await createAttemptFor(tx, ctx, learner, q)
  await refreshDayRecord(tx, ctx, learner.userId, date)
  return report
}

/**
 * Sesi hari ini untuk tablet: samakan dengan rencana (lihat syncDay) lalu kembalikan semuanya. Hari istirahat
 * tidak mendapat sesi baru.
 */
export async function ensureTodayQuests(tx: Tx, ctx: OrgContext, learner: LearnerRow, date: IsoDate): Promise<QuestRow[]> {
  const load = () => tx.select().from(quest).where(and(eq(quest.learnerId, learner.userId), eq(quest.date, date)))
  if (await isRestDay(tx, learner, date)) return load()
  await syncDay(tx, ctx, learner, date)
  return load()
}

/**
 * Samakan sesi hari ini dengan rencana bila tablet sudah membuat sesi hari ini (dipakai saat tutor mengubah rencana
 * atau aturan hari). Hari yang belum dibuat dibiarkan: tablet membuatnya dari rencana saat Today dibuka.
 */
export async function syncTodayIfCreated(tx: Tx, ctx: OrgContext, learnerId: string, date: IsoDate): Promise<SyncReport | null> {
  const learner = await loadLearner(tx, learnerId)
  if (await isRestDay(tx, learner, date)) return null
  const rows = await tx.select({ id: quest.id }).from(quest).where(and(eq(quest.learnerId, learnerId), eq(quest.date, date), ne(quest.kind, 'bonus'))).limit(1)
  if (rows.length === 0) return null
  return syncDay(tx, ctx, learner, date)
}

/** Tes terbuka setelah semua Latihan wajib mapel itu selesai. */
export async function isTesLocked(tx: Tx, q: Pick<QuestRow, 'learnerId' | 'date' | 'subject' | 'session'>): Promise<boolean> {
  if (q.session !== 'tes') return false
  const lat = await tx
    .select({ status: quest.status })
    .from(quest)
    .where(and(eq(quest.learnerId, q.learnerId), eq(quest.date, q.date), eq(quest.subject, q.subject), eq(quest.session, 'latihan'), eq(quest.kind, 'daily')))
  return lat.some((l) => l.status !== 'done')
}

/** Quest sebuah attempt (attempt ulang memakai quest dari percobaan pertama). */
export async function questOfAttempt(tx: Tx, a: Pick<AttemptRow, 'id' | 'retryOf'>): Promise<QuestRow | undefined> {
  const [q] = await tx.select().from(quest).where(eq(quest.attemptId, a.retryOf ?? a.id)).limit(1)
  return q
}

/**
 * Tandai sesi opsional bertipe tautan selesai setelah kegiatannya selesai di halaman lain:
 * review (kartu), simulation dan esmo (attempt-nya), lesson (skill-nya), dan sesi arena atau English dari fase lain.
 * Hanya sesi opsional yang belum selesai di hari itu; sesi pertama yang cocok yang ditandai.
 */
export async function completeLinkedSession(
  tx: Tx,
  learnerId: string,
  date: IsoDate,
  input: { session: SessionType; subject?: Subject; skillId?: string; presetId?: string; task?: string },
): Promise<boolean> {
  const rows = await tx
    .select()
    .from(quest)
    .where(and(eq(quest.learnerId, learnerId), eq(quest.date, date), eq(quest.kind, 'extra'), eq(quest.session, input.session)))
    .orderBy(asc(quest.createdAt))
  const open = rows.filter((q) => q.status !== 'done')
  const match = (q: QuestRow) => {
    const cfg = (q.config as { presetId?: string; task?: string } | null) ?? {}
    if (input.subject && q.subject !== input.subject && input.session !== 'review' && input.session !== 'quick-maths' && input.session !== 'knowledge') return false
    if (input.skillId && q.skillId && q.skillId !== input.skillId) return false
    if (input.presetId && cfg.presetId && cfg.presetId !== input.presetId) return false
    if (input.task && cfg.task && cfg.task !== input.task) return false
    return true
  }
  const target = open.find(match)
  if (!target) return false
  await tx.update(quest).set({ status: 'done', completedAt: new Date() }).where(eq(quest.id, target.id))
  return true
}

// ---------------------------------------------------------------------------
// Ulang sesi

const RETRY_SESSIONS: ReadonlySet<SessionType> = new Set(['latihan', 'tes', 'paper', 'reading'])

export type RetryInfo = {
  /** Percobaan pertama, yang resmi untuk laporan dan streak. */
  rootId: string
  session: SessionType
  quest: QuestRow
}

/** Percobaan ini boleh diulang bila sesinya Latihan, Tes, atau Paper dan percobaan itu sudah dikumpulkan. */
export async function retryInfo(tx: Tx, a: AttemptRow): Promise<RetryInfo | null> {
  if (a.kind !== 'quest' || a.status === 'in_progress') return null
  const q = await questOfAttempt(tx, a)
  if (!q || !RETRY_SESSIONS.has(q.session as SessionType)) return null
  return { rootId: a.retryOf ?? a.id, session: q.session as SessionType, quest: q }
}

/** Semua percobaan sebuah sesi: yang pertama lalu ulangannya, urut waktu. */
export async function familyOf(tx: Tx, rootId: string): Promise<AttemptRow[]> {
  const rows = await tx.select().from(attempt).where(eq(attempt.id, rootId))
  const retries = await tx.select().from(attempt).where(eq(attempt.retryOf, rootId)).orderBy(asc(attempt.retryNo))
  return [...rows, ...retries]
}

/**
 * Mulai percobaan ulang seluruh sesi. Latihan dan Tes mendapat soal baru dari skill yang sama (soal yang
 * sudah dipakai sesi itu dan Latihan hari itu dihindari), Paper memakai soal yang sama dengan urutan
 * diacak. Percobaan pertama tetap resmi. Bila masih ada ulangan yang belum selesai, itu yang dipakai.
 */
export async function createRetryAttempt(tx: Tx, ctx: OrgContext, learner: LearnerRow, attemptId: string): Promise<string> {
  const [a] = await tx.select().from(attempt).where(and(eq(attempt.id, attemptId), eq(attempt.learnerId, learner.userId))).limit(1)
  if (!a) throw notFound(dictFor(await learnerLang()).runner.dal.errors.sessionNotFound)
  const info = await retryInfo(tx, a)
  if (!info) throw conflict(dictFor(await learnerLang()).runner.dal.errors.cannotRetry)
  const family = await familyOf(tx, info.rootId)
  const root = family[0]!
  const open = family.find((f) => f.status === 'in_progress' && f.retryNo > 0)
  if (open) return open.id

  const rootItems = (root.items as AttemptItem[]) ?? []
  const retryNo = family.length
  const date = info.quest.date
  const seedKey = `${learner.userId}:retry:${root.id}:${retryNo}`
  let items: AttemptItem[]
  if (info.session === 'paper') {
    // Paper yang sama dengan urutan diacak. Nomor skor asli ikut terbawa supaya poin per soal tetap benar.
    const rng = createRng(seedKey)
    items = rng
      .shuffle(rootItems)
      .map((it, i) => ({ ref: it.ref, section: it.section, position: i + 1, difficulty: it.difficulty, scorePos: it.scorePos ?? it.position }))
  } else {
    const resolved = await resolveItems(tx, rootItems.map((i) => i.ref))
    const counts = new Map<string, number>()
    for (const it of rootItems) {
      const s = resolved.get(it.ref)?.skill
      if (s) counts.set(s, (counts.get(s) ?? 0) + 1)
    }
    const main = info.quest.skillId ?? [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0]
    if (!main) throw conflict(dictFor(await learnerLang()).runner.dal.errors.noRetryItems)
    const avoid = new Set<string>()
    for (const f of family) for (const it of (f.items as AttemptItem[]) ?? []) avoid.add(it.ref)
    // Sesi lain mapel yang sama hari itu juga dihindari (Latihan dan Tes memakai skill yang sama).
    const siblings = await tx.select({ attemptId: quest.attemptId }).from(quest).where(and(eq(quest.learnerId, learner.userId), eq(quest.date, date), eq(quest.subject, root.subject)))
    for (const s of siblings) for (const ref of await itemRefsOf(tx, s.attemptId)) avoid.add(ref)
    items = await buildQuestItems(tx, ctx, learner, {
      skillId: main,
      subject: root.subject,
      mode: 'latihan',
      date,
      seedKey,
      style: info.session === 'tes' ? 'test' : 'easy',
      length: rootItems.length,
      avoid,
      allowManual: false,
    })
  }
  items = await guardAttemptItems(tx, items, { seed: `${root.id}:retry:${retryNo}`, mode: root.mode })
  const [row] = await tx
    .insert(attempt)
    .values({
      orgId: ctx.orgId,
      learnerId: learner.userId,
      kind: 'quest',
      refId: info.quest.id,
      mode: root.mode,
      subject: root.subject,
      title: root.title,
      items,
      timeLimitS: root.timeLimitS,
      presetId: root.presetId,
      retryOf: root.id,
      retryNo,
    })
    .returning({ id: attempt.id })
  return row!.id
}

export type ScoreText = { text: string; raw: number | null; max: number | null; scaled: number | null }

/**
 * Bahasa tampilan anak untuk teks yang disusun di DAL. Layar learner selalu punya sesi. Di luar request
 * (tes, skrip) sesi tidak terbaca, jadi teksnya bahasa Inggris seperti sebelumnya.
 */
export async function learnerLang(): Promise<UiLang> {
  try {
    return await getLang()
  } catch {
    return 'en'
  }
}

/** Skor sebuah percobaan sebagai teks untuk learner, misalnya "8 of 10" atau "72 out of 100". */
export function scoreText(a: { scoreRaw: number | null; scoreMax: number | null; scoreScaled: number | null }, total: number, t: Dict['runner'] = dictFor('en').runner): ScoreText | null {
  if (a.scoreRaw === null && a.scoreScaled === null) return null
  const text = a.scoreScaled !== null ? t.dal.outOf(Math.round(a.scoreScaled), 100) : t.dal.scoreOf(Math.round(a.scoreRaw ?? 0), Math.round(a.scoreMax ?? total))
  return { text, raw: a.scoreRaw, max: a.scoreMax, scaled: a.scoreScaled }
}

/** Ringkasan skor sebuah percobaan untuk dibandingkan. */
export function scoreOf(a: Pick<AttemptRow, 'scoreRaw' | 'scoreMax' | 'scoreScaled'>) {
  return { raw: a.scoreRaw, max: a.scoreMax, scaled: a.scoreScaled }
}

/** Percobaan yang sudah dikumpulkan dari sebuah sesi, percobaan pertama dulu. */
export async function submittedFamily(tx: Tx, rootId: string): Promise<AttemptRow[]> {
  return (await familyOf(tx, rootId)).filter((f) => f.status !== 'in_progress')
}


