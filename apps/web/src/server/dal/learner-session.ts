import 'server-only'
import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm'
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
  type DayTemplate,
  type IsoDate,
  type PaperKind,
  type PlannedSlot,
  type QuestSlot,
  type SessionType,
} from '@kira/core'
import { tables } from '@kira/db'
import { genRef, newSeed } from '@kira/content/math'
import type { Subject } from '@/lib/dto'
import type { OrgContext, Tx } from '../db'
import { conflict, notFound } from '../errors'
import { poolForSkill, preset, resolveItems, skill, skillsFor, type PoolCandidate } from './content'
import { pickDailyPaper, taperSubjects } from './daily-paper'
import { paperPresetFor } from './daily-paper-scoring'
import { isRestDay, recentSeen, refreshDayRecord, skillStates, type LearnerRow } from './learner-core'

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
function materialise(ref: string, rng: ReturnType<typeof createRng>): string {
  const m = /^gen:([mes][1-6]\.[a-z0-9-]+):([1-5])$/.exec(ref)
  return m ? genRef(m[1]!, Number(m[2]) as 1 | 2 | 3 | 4 | 5, newSeed(rng)) : ref
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
}

function questLength(learner: LearnerRow, mode: string): number {
  if (mode === 'belajar') return 6
  return learner.grade <= 1 ? 8 : 10
}

/** Isi sisa soal dari skill lain di mapel dan grade yang sama saat bank soal skill ini habis. */
async function topUp(
  tx: Tx,
  ctx: OrgContext,
  input: { skillId: string; subject: Subject; slots: QuestSlot[]; count: number; theta: number; style: 'easy' | 'test'; avoid: ReadonlySet<string>; seen: Map<string, number>; rng: ReturnType<typeof createRng> },
): Promise<QuestSlot[]> {
  const need = input.count - input.slots.length
  if (need <= 0) return input.slots
  const sk = skill(input.skillId)
  const near = skillsFor(input.subject, sk?.grade ?? 2).filter((s) => s.id !== input.skillId && s.strand !== 'Oly' && !MANUAL_STRANDS.has(s.strand))
  const ordered = [...near.filter((s) => s.strand === sk?.strand), ...near.filter((s) => s.strand !== sk?.strand)].slice(0, 6)
  const cands: PoolCandidate[] = []
  for (const s of ordered) cands.push(...(await poolForSkill(tx, ctx.orgId, s.id, { allowManual: false })))
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
  const pool = await poolForSkill(tx, ctx.orgId, input.skillId, { allowManual, ...(input.allowPhoto ? { allowPhoto: true } : {}) })
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
    slots = await topUp(tx, ctx, { skillId: input.skillId, subject: input.subject, slots, count, theta, style: input.style, avoid, seen, rng })
    if (slots.length < count) {
      const used = new Set(slots.map((s) => s.ref))
      const band: [number, number] = input.style === 'test' ? [0.55, 0.75] : [0.85, 0.95]
      const more = pickItems({ candidates: withSeen(pool), theta, count: count - slots.length, band, rng, exclude: used })
      slots = [...slots, ...more.map((p) => ({ ref: p.candidate.ref, section: 'core' as const, difficulty: p.candidate.difficulty }))]
    }
  } else {
    slots = assembleQuest({ mode: input.mode, theta, dueRefs, candidates: withSeen(pool), length: input.length ?? questLength(learner, input.mode), rng })
  }
  return slots.map((s, i) => ({ ref: materialise(s.ref, rng), section: s.section, position: i + 1, difficulty: s.difficulty }))
}

/** Pilih skill otomatis untuk satu mapel bila tutor belum merencanakan. */
export function autoSkill(learner: LearnerRow, subject: Subject, states: Awaited<ReturnType<typeof skillStates>>, seedKey: string) {
  const list = skillsFor(subject, learner.grade).filter((s) => s.strand !== 'Oly')
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
    const items = await buildQuestItems(tx, ctx, learner, {
      skillId: spec.skillId,
      subject,
      mode: legacy ? 'belajar' : 'latihan',
      date: spec.date,
      seedKey: spec.seedKey,
      ...(legacy ? { length: spec.count ?? 6 } : { style: 'easy' as const, length: spec.count ?? LATIHAN_COUNT }),
      avoid,
      ...(spec.assigned ? { allowPhoto: true } : {}),
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
    const picked = await pickDailyPaper({ orgId: ctx.orgId, learnerId: learner.userId, grade: learner.grade }, subject, spec.date, kind)
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
      items: plan.items,
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
    skillId = autoSkill(learner, q.subject as Subject, await skillStates(tx, learner.userId), `${learner.userId}:${q.date}:${q.subject}`)?.id ?? null
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
  }))
}

/**
 * Buat sesi hari ini yang belum ada: sesi wajib dari template hari dan rencana tutor yang sudah terbit
 * (Latihan, Tes, Paper per mapel), ditambah sesi opsional dari tutor. Aman dipanggil berulang:
 * sesi yang sudah ada dilewati, dan sesi opsional yang ditambah tutor belakangan ikut dibuat.
 */
export async function ensureTodayQuests(tx: Tx, ctx: OrgContext, learner: LearnerRow, date: IsoDate): Promise<QuestRow[]> {
  const load = () => tx.select().from(quest).where(and(eq(quest.learnerId, learner.userId), eq(quest.date, date)))
  const existing = await load()
  if (await isRestDay(tx, learner, date)) return existing

  const day = await publishedDay(tx, learner.userId, date)
  const rowById = new Map(day.rows.map((r) => [r.id, r]))
  const entries = dropTaperEntries(composeDay({ template: day.template, date, slots: plannedSlots(day.rows) }), await taperSubjects(tx, learner.userId, date))
  const haveKey = new Set(existing.filter((q) => q.kind !== 'bonus').map((q) => `${q.kind}:${q.subject}:${q.session}:${q.seq}`))
  const haveSlot = new Set(existing.map((q) => q.planSlotId).filter((x): x is string => Boolean(x)))

  const skillBySubject = new Map<Subject, string>()
  for (const q of existing) if (q.kind === 'daily' && q.session === 'latihan' && q.skillId) skillBySubject.set(q.subject as Subject, q.skillId)
  let states: Awaited<ReturnType<typeof skillStates>> | null = null
  const pickSkill = async (subject: Subject) =>
    skillBySubject.get(subject) ?? autoSkill(learner, subject, (states ??= await skillStates(tx, learner.userId)), `${learner.userId}:${date}:${subject}`)?.id ?? null
  // Soal Latihan hari ini per mapel, supaya Tes memakai soal lain dari skill yang sama.
  const latihanRefs = new Map<Subject, Set<string>>()
  const refsFor = async (subject: Subject) => {
    let s = latihanRefs.get(subject)
    if (!s) {
      s = new Set()
      for (const q of existing) if (q.subject === subject && q.session === 'latihan') for (const ref of await itemRefsOf(tx, q.attemptId)) s.add(ref)
      latihanRefs.set(subject, s)
    }
    return s
  }

  for (const entry of entries) {
    const kind = entry.required ? 'daily' : 'extra'
    if ((entry.slotId && haveSlot.has(entry.slotId)) || haveKey.has(`${kind}:${entry.subject}:${entry.session}:${entry.seq}`)) continue
    const row = entry.slotId ? rowById.get(entry.slotId) : undefined
    // Paper Kertas dikerjakan di kertas dan dinilai lewat Input LJK, jadi tidak ada sesi tablet untuk slot itu.
    if (row?.mode === 'kertas') continue

    const session = entry.session
    const subject = entry.subject
    let skillId = row?.skillId ?? null
    const needsSkill = session === 'latihan' || session === 'tes' || session === 'reading' || session === 'lesson'
    if (!skillId && (session === 'latihan' || session === 'tes')) skillId = await pickSkill(subject)
    if (needsSkill && !skillId) continue
    // Paper tanpa soal bergaya lomba memakai skill hari ini sebagai cadangan, tetapi tidak menyimpannya di quest.
    const fallbackSkill = session === 'paper' && !row?.paperId ? await pickSkill(subject) : skillId
    if (session === 'latihan' && entry.required && skillId) skillBySubject.set(subject, skillId)

    const cfgIn = (row?.config as Record<string, unknown> | null) ?? {}
    const config = session === 'paper' ? { ...cfgIn, paper: entry.paper ?? 'mini' } : Object.keys(cfgIn).length > 0 ? cfgIn : null
    const mode = row?.mode === 'belajar' ? 'belajar' : session === 'tes' ? 'tes' : 'latihan'
    const link = !RUNNER_SESSIONS.has(session)
    const seedKey = seedKeyOf({ learnerId: learner.userId, date, subject, kind, session, seq: entry.seq })

    let plan: Plan | null = null
    if (!link) {
      plan = await planAttempt(
        tx,
        ctx,
        learner,
        {
          session,
          subject,
          skillId: fallbackSkill,
          paperId: row?.paperId ?? null,
          mode: row?.mode ?? mode,
          paper: entry.paper,
          count: row && (session === 'latihan' || session === 'tes' || session === 'reading') ? row.questionCount : null,
          perQuestionSec: typeof cfgIn.perQuestionSec === 'number' ? cfgIn.perQuestionSec : null,
          date,
          seedKey,
          assigned: Boolean(row?.skillId),
        },
        session === 'tes' ? await refsFor(subject) : new Set(),
      )
      if (!plan) continue
    }
    const [q] = await tx
      .insert(quest)
      .values({
        orgId: ctx.orgId,
        learnerId: learner.userId,
        date,
        subject,
        kind,
        session,
        seq: entry.seq,
        planSlotId: entry.slotId,
        config,
        skillId: session === 'paper' ? null : (skillId ?? row?.skillId ?? null),
        paperId: row?.paperId ?? null,
        mode,
        title: plan?.title ?? extraTitle(session, row),
      })
      .onConflictDoNothing()
      .returning()
    if (!q || !plan) continue
    await insertAttempt(tx, ctx, learner.userId, q, plan)
    if (session === 'latihan') {
      const set = await refsFor(subject)
      for (const it of plan.items) set.add(it.ref)
    }
  }

  // Quest lama yang belum punya attempt (dibuat sebelum attempt-nya sempat terbentuk).
  for (const q of existing) if (!q.attemptId && q.kind !== 'bonus') await createAttemptFor(tx, ctx, learner, q)
  await refreshDayRecord(tx, ctx, learner.userId, date)
  return load()
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
  if (!a) throw notFound('Sesi ini tidak ditemukan.')
  const info = await retryInfo(tx, a)
  if (!info) throw conflict('Sesi ini belum selesai atau tidak bisa diulang.')
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
    if (!main) throw conflict('Soal untuk sesi ini tidak ditemukan.')
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

/** Skor sebuah percobaan sebagai teks untuk learner, misalnya "8 of 10" atau "72 out of 100". */
export function scoreText(a: { scoreRaw: number | null; scoreMax: number | null; scoreScaled: number | null }, total: number): ScoreText | null {
  if (a.scoreRaw === null && a.scoreScaled === null) return null
  const text = a.scoreScaled !== null ? `${Math.round(a.scoreScaled)} out of 100` : `${Math.round(a.scoreRaw ?? 0)} of ${Math.round(a.scoreMax ?? total)}`
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


/**
 * Hari ringan untuk hari ini yang sesinya sudah dibuat: Tes dan Paper wajib yang belum dikerjakan dibuang,
 * sehingga hari tetap lengkap dengan Latihan saja. Yang sudah dikerjakan atau sedang berjalan tetap ada.
 * Mengembalikan jumlah sesi yang dibuang.
 */
export async function dropUnstartedHeavySessions(tx: Tx, ctx: OrgContext, learnerId: string, date: IsoDate): Promise<number> {
  const rows = await tx
    .select({ id: quest.id, attemptId: quest.attemptId })
    .from(quest)
    .where(and(eq(quest.learnerId, learnerId), eq(quest.date, date), eq(quest.kind, 'daily'), inArray(quest.session, ['tes', 'paper']), eq(quest.status, 'ready')))
  let dropped = 0
  for (const q of rows) {
    if (q.attemptId) {
      const [r] = await tx.select({ n: sql<number>`count(*)::int` }).from(response).where(eq(response.attemptId, q.attemptId))
      if ((r?.n ?? 0) > 0) continue
      await tx.delete(quest).where(eq(quest.id, q.id))
      await tx.delete(attempt).where(eq(attempt.id, q.attemptId))
    } else {
      await tx.delete(quest).where(eq(quest.id, q.id))
    }
    dropped++
  }
  if (dropped > 0) await refreshDayRecord(tx, ctx, learnerId, date)
  return dropped
}
