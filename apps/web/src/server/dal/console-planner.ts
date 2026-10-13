import 'server-only'
import { and, asc, eq, gte, inArray, isNull, lte, ne, notInArray, sql } from 'drizzle-orm'
import {
  DAY_TEMPLATES,
  MAX_EXTRA_PER_DAY,
  addDays,
  composeDay,
  defaultTemplate,
  jakartaDate,
  sessionMinutes,
  weekStart,
  type DayEntry,
  type DayTemplate,
  type IsoDate,
  type PlannedSlot,
  type SessionType,
} from '@kira/core'
import { tables } from '@kira/db'
import type { DayTemplateId, PlannerDTO, PlannerDay, PlanSlotConfig, PlanSlotDTO, Subject, UpsertSlotInput } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { auditTx } from '../audit'
import { conflict, invalid, notFound } from '../errors'
import { content, preset, presets, skill as skillById } from './content'
import { skillTitle, SUBJECT_ORDER } from './console-common'
import { shellIn } from './console-shell'
import { paperPresetFor } from './daily-paper-scoring'
import { dropUnstartedHeavySessions } from './learner-session'
import {
  SESSION_LABEL_ID,
  TEMPLATE_LABEL_ID,
  dayLabelId,
  firstPlannableDate,
  isRestDate,
  normaliseSlot,
  normaliseWeek,
  slotMinutes,
  suggestWeek,
  weekLabelLong,
  weekOf,
  type PlanMode,
  type SkillMeta,
  type SkillStateLite,
  type Suggestion,
  type UpcomingCompetition,
} from './planner-logic'

/**
 * T03 Perencana mingguan. Today di tablet memakai slot dari minggu yang sudah terbit (lihat
 * ensureTodayQuests di learner-session). Setiap hari punya template (Hari sekolah, Sabtu paper penuh,
 * Hari ringan) yang menentukan sesi wajib dasar; slot hanya menggantikan sesi dasar yang sama atau menambah
 * sesi wajib dan sesi opsional (paling banyak 10 per hari). Quest dibuat saat Today pertama dibuka di hari
 * itu, jadi perubahan sesi wajib hanya berlaku untuk hari ini (selama quest hari ini belum dibuat) dan hari
 * berikutnya. Sesi opsional boleh ditambah kapan saja. Minggu yang sudah terbit tetap terbit saat diubah.
 */

const { planWeek, planSlot, restDay, paper, learnerProfile, skillState, competitionEvent, quest } = tables

type PlanLearner = { id: string; name: string; grade: number; restWeekdays: number[]; screenLimitMin: number }

async function planLearner(tx: Tx, learnerId: string): Promise<PlanLearner> {
  const rows = await tx
    .select({
      id: learnerProfile.userId,
      name: learnerProfile.name,
      grade: learnerProfile.grade,
      restWeekdays: learnerProfile.restWeekdays,
      screenLimitMin: learnerProfile.screenLimitMin,
    })
    .from(learnerProfile)
    .where(and(eq(learnerProfile.userId, learnerId), isNull(learnerProfile.deletedAt)))
    .limit(1)
  if (!rows[0]) throw notFound('Learner tidak ditemukan. Muat ulang halaman rencana lalu pilih learner lagi.')
  return rows[0]
}

type SlotRow = {
  id: string
  learnerId: string
  date: IsoDate
  subject: Subject
  kind: 'quest' | 'bonus'
  session: SessionType
  required: boolean
  paperKind: 'mini' | 'full' | null
  config: unknown
  skillId: string | null
  paperId: string | null
  mode: PlanMode
  questionCount: number
  createdAt: Date
  paperTitle: string | null
  paperMinutes: number | null
  paperItems: number | null
  paperDeleted: boolean | null
}

function slotQuery(tx: Tx) {
  return tx
    .select({
      id: planSlot.id,
      learnerId: planSlot.learnerId,
      date: planSlot.date,
      subject: planSlot.subject,
      kind: planSlot.kind,
      session: planSlot.session,
      required: planSlot.required,
      paperKind: planSlot.paperKind,
      config: planSlot.config,
      skillId: planSlot.skillId,
      paperId: planSlot.paperId,
      mode: planSlot.mode,
      questionCount: planSlot.questionCount,
      createdAt: planSlot.createdAt,
      paperTitle: paper.title,
      paperMinutes: paper.minutes,
      paperItems: sql<number | null>`cardinality(${paper.itemRefs})`,
      paperDeleted: sql<boolean | null>`${paper.deletedAt} is not null`,
    })
    .from(planSlot)
    .leftJoin(paper, eq(paper.id, planSlot.paperId))
}

async function slotsBetween(tx: Tx, learnerId: string, from: IsoDate, to: IsoDate): Promise<SlotRow[]> {
  return slotQuery(tx)
    .where(and(eq(planSlot.learnerId, learnerId), gte(planSlot.date, from), lte(planSlot.date, to)))
    .orderBy(asc(planSlot.date), asc(planSlot.createdAt), asc(planSlot.id))
}

async function slotById(tx: Tx, slotId: string): Promise<SlotRow> {
  const rows = await slotQuery(tx).where(eq(planSlot.id, slotId)).limit(1)
  if (!rows[0]) throw notFound('Slot tidak ditemukan. Mungkin sudah dihapus; muat ulang halaman rencana.')
  return rows[0]
}

function cfgOf(r: { config: unknown }): PlanSlotConfig | null {
  const c = r.config as PlanSlotConfig | null
  return c && typeof c === 'object' && Object.keys(c).length > 0 ? c : null
}

/** Menit satu sesi untuk meteran waktu layar. */
function minutesOf(
  session: SessionType,
  input: { questionCount: number; paperKind?: 'mini' | 'full' | null; config?: PlanSlotConfig | null; fullMinutes?: number | null },
): number {
  const presetMin = input.config?.presetId ? preset(input.config.presetId)?.rules.timeLimitMin : null
  return sessionMinutes({
    session,
    questionCount: input.questionCount,
    paper: input.paperKind ?? null,
    fixedMinutes: session === 'paper' ? (input.paperKind === 'full' ? input.fullMinutes : null) : presetMin,
    ...(input.config?.perQuestionSec ? { perQuestionSec: input.config.perQuestionSec } : {}),
  })
}

function titleOf(r: SlotRow): string {
  if (r.paperId) return r.paperTitle ? (r.paperDeleted ? `${r.paperTitle}, paper dihapus` : r.paperTitle) : 'Paper tidak ditemukan'
  const cfg = cfgOf(r)
  switch (r.session) {
    case 'latihan':
    case 'tes':
    case 'reading':
    case 'lesson':
      return r.skillId ? skillTitle(r.skillId) : r.session === 'tes' ? 'Skill sama dengan Latihan' : SESSION_LABEL_ID[r.session]
    case 'paper':
      return r.paperKind === 'full' ? 'Paper penuh gaya lomba' : 'Paper mini gaya lomba'
    case 'simulation':
      return (cfg?.presetId ? preset(cfg.presetId)?.title : undefined) ?? 'Simulasi lomba'
    case 'english-skill':
      return cfg?.task ? `Tugas English: ${cfg.task}` : 'Tugas English'
    default:
      return SESSION_LABEL_ID[r.session]
  }
}

function toSlotDTO(r: SlotRow, fullMinutes: number | null): PlanSlotDTO {
  const count = r.paperId ? (r.paperItems ?? r.questionCount) : r.questionCount
  const cfg = cfgOf(r)
  return {
    id: r.id,
    auto: false,
    fromPaper: r.paperId !== null,
    date: r.date,
    subject: r.subject,
    kind: r.kind,
    session: r.session,
    required: r.kind === 'bonus' ? false : r.required,
    paperKind: r.paperKind,
    skillId: r.paperId ? null : r.skillId,
    title: titleOf(r),
    mode: r.mode,
    minutes: r.paperId ? slotMinutes({ questionCount: count, paperMinutes: r.paperMinutes }) : minutesOf(r.session, { questionCount: count, paperKind: r.paperKind, config: cfg, fullMinutes }),
    questionCount: count,
    config: cfg,
  }
}

/** Sesi dasar dari template yang belum punya slot: Kira memilih skill dan soalnya saat Today dibuka. */
function autoDTO(e: DayEntry, date: IsoDate, fullMinutes: number | null): PlanSlotDTO {
  const count = e.session === 'latihan' ? 10 : 8
  return {
    id: `auto:${date}:${e.key.slice('auto:'.length)}`,
    auto: true,
    fromPaper: false,
    date,
    subject: e.subject,
    kind: 'quest',
    session: e.session,
    required: true,
    paperKind: e.paper,
    skillId: null,
    title: e.session === 'paper' ? (e.paper === 'full' ? 'Paper penuh, dipilih Kira' : 'Paper mini, dipilih Kira') : 'Skill dipilih Kira',
    mode: e.session === 'tes' ? 'tes' : 'latihan',
    minutes: minutesOf(e.session, { questionCount: count, paperKind: e.paper, fullMinutes }),
    questionCount: count,
    config: null,
  }
}

async function restOverrides(tx: Tx, learnerId: string, from: IsoDate, to: IsoDate): Promise<Map<IsoDate, boolean>> {
  const rows = await tx
    .select({ date: restDay.date, rest: restDay.rest })
    .from(restDay)
    .where(and(eq(restDay.learnerId, learnerId), gte(restDay.date, from), lte(restDay.date, to)))
  return new Map(rows.map((r) => [r.date, r.rest]))
}

async function todayQuestsCreated(tx: Tx, learnerId: string, today: IsoDate): Promise<boolean> {
  const rows = await tx
    .select({ id: quest.id })
    .from(quest)
    .where(and(eq(quest.learnerId, learnerId), eq(quest.date, today), eq(quest.kind, 'daily')))
    .limit(1)
  return rows.length > 0
}

function toMeta(s: { id: string; subject: Subject; grade: number; title: string; order: number; strand: string; prerequisites: string[]; competitions: string[] }): SkillMeta {
  return {
    id: s.id,
    subject: s.subject,
    grade: s.grade,
    title: s.title,
    order: s.order,
    strand: s.strand,
    prerequisites: s.prerequisites,
    competitions: s.competitions,
    hasLesson: content().lessons.has(s.id),
  }
}

async function statesOf(tx: Tx, learnerId: string): Promise<Map<string, SkillStateLite>> {
  const rows = await tx
    .select({ skillId: skillState.skillId, gate: skillState.gate, stars: skillState.stars, recent: skillState.recent, nAnswers: skillState.nAnswers, lastPracticed: skillState.lastPracticed })
    .from(skillState)
    .where(eq(skillState.learnerId, learnerId))
  return new Map(rows.map((r) => [r.skillId, { gate: r.gate, stars: r.stars, recent: r.recent, nAnswers: r.nAnswers, lastPracticed: r.lastPracticed }]))
}

async function upcomingCompetitions(tx: Tx, learnerId: string, today: IsoDate): Promise<UpcomingCompetition[]> {
  const rows = await tx
    .select({ name: competitionEvent.name, date: competitionEvent.date, competitionId: competitionEvent.competitionId, subjects: competitionEvent.subjects, learnerIds: competitionEvent.learnerIds })
    .from(competitionEvent)
    .where(and(gte(competitionEvent.date, today), notInArray(competitionEvent.status, ['skip', 'done'])))
    .orderBy(asc(competitionEvent.date))
  return rows
    .filter((r) => r.date !== null && (r.learnerIds.length === 0 || r.learnerIds.includes(learnerId)))
    .map((r) => ({ name: r.name, date: r.date!, competitionId: r.competitionId, subjects: r.subjects }))
}

function templateAt(templates: unknown, date: IsoDate): DayTemplate {
  const v = (templates as Record<string, unknown> | null)?.[date]
  return typeof v === 'string' && (DAY_TEMPLATES as readonly string[]).includes(v) ? (v as DayTemplate) : defaultTemplate(date)
}

type WeekView = {
  learner: PlanLearner
  monday: IsoDate
  week: IsoDate[]
  rest: Set<IsoDate>
  slots: SlotRow[]
  status: 'draft' | 'published'
  templates: Record<string, string>
  states: Map<string, SkillStateLite>
  suggestions: Suggestion[]
  /** Semua sesi per hari (slot dan sesi dasar dari template), siap ditampilkan. */
  sessions: PlanSlotDTO[]
}

function plannedOf(rows: readonly SlotRow[]): PlannedSlot[] {
  return rows.map((r, i) => ({ id: r.id, subject: r.subject, session: r.session, required: r.kind === 'bonus' ? false : r.required, paperKind: r.paperKind, order: i }))
}

/** Semua yang dibutuhkan layar dan applySuggestions untuk satu learner dan satu minggu. */
async function weekView(tx: Tx, learnerId: string, monday: IsoDate, today: IsoDate): Promise<WeekView> {
  const learner = await planLearner(tx, learnerId)
  const week = weekOf(monday)
  const sunday = week[6]!
  const overrides = await restOverrides(tx, learner.id, monday, sunday)
  const rest = new Set(week.filter((d) => isRestDate(d, learner.restWeekdays, overrides)))
  const slots = await slotsBetween(tx, learner.id, monday, sunday)
  const [weekRow] = await tx
    .select({ status: planWeek.status, templates: planWeek.dayTemplates })
    .from(planWeek)
    .where(and(eq(planWeek.learnerId, learner.id), eq(planWeek.weekStart, monday)))
    .limit(1)
  const templates = (weekRow?.templates as Record<string, string> | undefined) ?? {}
  const states = await statesOf(tx, learner.id)

  const sessions: PlanSlotDTO[] = []
  for (const date of week) {
    if (rest.has(date)) continue
    const rows = slots.filter((s) => s.date === date)
    const byId = new Map(rows.map((r) => [r.id, r]))
    const fullMinutes = (subject: Subject) => paperPresetFor(subject, learner.grade, date)?.rules.timeLimitMin ?? null
    for (const e of composeDay({ template: templateAt(templates, date), date, slots: plannedOf(rows) })) {
      const row = e.slotId ? byId.get(e.slotId) : undefined
      sessions.push(row ? { ...toSlotDTO(row, fullMinutes(row.subject)), required: e.required, paperKind: e.paper ?? row.paperKind } : autoDTO(e, date, fullMinutes(e.subject)))
    }
    // Slot yang tidak masuk susunan hari (melebihi batas sesi opsional) tetap terlihat supaya bisa dihapus.
    for (const r of rows) if (!sessions.some((s) => s.id === r.id)) sessions.push(toSlotDTO(r, fullMinutes(r.subject)))
  }

  const c = content()
  const skills = new Map<string, SkillMeta>()
  for (const s of c.skills.values()) skills.set(s.id, toMeta(s))
  const curriculum = SUBJECT_ORDER.flatMap((subject) => (c.skillsByKey.get(`${subject}:${learner.grade}`) ?? []).map((s) => skills.get(s.id)!))
  const suggestions = suggestWeek({
    today,
    firstPlannable: firstPlannableDate(today, await todayQuestsCreated(tx, learner.id, today)),
    days: week.map((date) => ({ date, rest: rest.has(date) })),
    learnerGrade: learner.grade,
    screenLimitMin: learner.screenLimitMin,
    curriculum,
    skills,
    states,
    slots: sessions.map((s) => ({
      date: s.date,
      subject: s.subject,
      kind: s.kind === 'bonus' ? ('bonus' as const) : ('quest' as const),
      skillId: s.skillId,
      minutes: s.minutes,
      session: s.session,
      required: s.required,
      auto: s.auto,
    })),
    competitions: await upcomingCompetitions(tx, learner.id, today),
  })
  return { learner, monday, week, rest, slots, status: weekRow?.status ?? 'draft', templates, states, suggestions, sessions }
}

/** Skill untuk pemilih slot: grade learner dulu, lalu grade di bawah dan di atasnya, plus skill yang punya data. */
function pickerSkills(grade: number, states: Map<string, SkillStateLite>): PlannerDTO['skills'] {
  const rank = (g: number) => (g === grade ? 0 : g < grade ? 1 : 2)
  const lessons = content().lessons
  return [...content().skills.values()]
    .filter((s) => Math.abs(s.grade - grade) <= 1 || states.has(s.id))
    .sort((a, b) => SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject) || rank(a.grade) - rank(b.grade) || a.grade - b.grade || a.order - b.order)
    .map((s) => ({ id: s.id, subject: s.subject, grade: s.grade, title: s.title, stars: states.get(s.id)?.stars ?? 0, hasLesson: lessons.has(s.id) }))
}

function weekHref(learnerId: string, monday: IsoDate): string {
  return `/konsol/rencana?learner=${encodeURIComponent(learnerId)}&minggu=${monday}`
}

const ORDER_SESSION: Record<string, number> = { latihan: 0, tes: 1, paper: 2 }

/** T03: null bila belum ada learner sama sekali (halaman mengarahkan ke daftar learner). */
export async function plannerDTO(actor: Actor, learnerParam: string | null, weekParam: string | null): Promise<PlannerDTO | null> {
  const today = jakartaDate()
  return inOrg(orgCtx(actor), async (tx) => {
    const { shell, learner } = await shellIn(tx, actor, learnerParam)
    if (!learner) return null
    const monday = normaliseWeek(weekParam, today)
    const v = await weekView(tx, learner.id, monday, today)
    const slots = [...v.sessions].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject) ||
        Number(b.required) - Number(a.required) ||
        (ORDER_SESSION[a.session] ?? 9) - (ORDER_SESSION[b.session] ?? 9),
    )
    const days: PlannerDay[] = v.week.map((date) => {
      const isRest = v.rest.has(date)
      const mine = isRest ? [] : slots.filter((s) => s.date === date)
      const template = templateAt(v.templates, date)
      const total = mine.reduce((a, s) => a + s.minutes, 0)
      return {
        date,
        label: dayLabelId(date),
        rest: isRest,
        totalMinutes: total,
        requiredMinutes: mine.filter((s) => s.required).reduce((a, s) => a + s.minutes, 0),
        overLimit: !isRest && total > v.learner.screenLimitMin,
        template,
        templateLabel: TEMPLATE_LABEL_ID[template],
        requiredCount: mine.filter((s) => s.required).length,
        extraCount: mine.filter((s) => !s.required).length,
      }
    })
    return {
      shell,
      learnerId: v.learner.id,
      weekStart: monday,
      weekLabel: weekLabelLong(monday),
      status: v.status,
      days,
      slots,
      suggestions: v.suggestions.map((s) => ({ id: s.id, date: s.date, subject: s.subject, skillId: s.skillId, title: s.title, reason: s.reason })),
      skills: pickerSkills(v.learner.grade, v.states),
      presets: presets()
        .filter((p) => !p.id.startsWith('esmo-practice') && (p.grades.includes(v.learner.grade) || p.grades.some((g) => Math.abs(g - v.learner.grade) <= 1)))
        .map((p) => ({ id: p.id, subject: p.subject, title: p.title, minutes: p.rules.timeLimitMin })),
      screenLimitMin: v.learner.screenLimitMin,
      prevWeekHref: weekHref(v.learner.id, addDays(monday, -7)),
      nextWeekHref: weekHref(v.learner.id, addDays(monday, 7)),
    }
  })
}

// ---------------------------------------------------------------------------
// Perubahan

const MAX_AHEAD_DAYS = 366
const MAX_REQUIRED_PER_DAY = 15

/**
 * Tanggal masih berpengaruh: tidak lewat, tidak lebih dari setahun lagi, dan bukan hari ini yang quest-nya
 * sudah dibuat. Sesi opsional boleh ditambah di hari ini walau quest hari ini sudah dibuat.
 */
async function assertPlannable(tx: Tx, learner: PlanLearner, date: IsoDate, today: IsoDate, opts: { optionalOnly?: boolean } = {}): Promise<void> {
  if (date < today) throw invalid(`${dayLabelId(date)} sudah lewat. Rencana hanya bisa diubah untuk hari ini dan hari berikutnya.`)
  if (date > addDays(today, MAX_AHEAD_DAYS)) throw invalid('Rencana paling jauh satu tahun ke depan. Pilih tanggal yang lebih dekat.')
  if (date === today && !opts.optionalOnly && (await todayQuestsCreated(tx, learner.id, today))) {
    throw conflict(`Sesi wajib hari ini sudah dibuat di tablet ${learner.name}, jadi perubahan sesi wajib untuk hari ini tidak dipakai lagi. Pilih besok atau hari berikutnya, atau tambahkan sesi opsional.`)
  }
}

async function assertNotRest(tx: Tx, learner: PlanLearner, date: IsoDate): Promise<void> {
  const overrides = await restOverrides(tx, learner.id, date, date)
  if (isRestDate(date, learner.restWeekdays, overrides)) {
    throw conflict(`${dayLabelId(date)} hari istirahat. Matikan Istirahat di hari itu dulu, atau pilih hari lain.`)
  }
}

/** Buat minggu sebagai draf bila belum ada, lalu kunci barisnya supaya perubahan per minggu berurutan. */
async function ensureWeek(tx: Tx, ctx: OrgContext, learnerId: string, monday: IsoDate): Promise<string> {
  await tx.insert(planWeek).values({ orgId: ctx.orgId, learnerId, weekStart: monday, createdBy: ctx.userId }).onConflictDoNothing()
  const rows = await tx
    .select({ id: planWeek.id })
    .from(planWeek)
    .where(and(eq(planWeek.learnerId, learnerId), eq(planWeek.weekStart, monday)))
    .for('update')
  if (!rows[0]) throw notFound('Rencana minggu itu tidak bisa dibuat. Muat ulang halaman lalu coba lagi.')
  return rows[0].id
}

async function touchWeek(tx: Tx, weekId: string): Promise<void> {
  await tx.update(planWeek).set({ updatedAt: new Date() }).where(eq(planWeek.id, weekId))
}

/** Jumlah slot wajib dan opsional di sebuah hari, tanpa slot yang sedang diubah. */
async function slotCounts(tx: Tx, learnerId: string, date: IsoDate, exceptId: string | null): Promise<{ required: number; optional: number }> {
  const rows = await tx
    .select({ required: planSlot.required, kind: planSlot.kind })
    .from(planSlot)
    .where(and(eq(planSlot.learnerId, learnerId), eq(planSlot.date, date), exceptId ? ne(planSlot.id, exceptId) : undefined))
  const optional = rows.filter((r) => !r.required || r.kind === 'bonus').length
  return { required: rows.length - optional, optional }
}

async function assertRoom(tx: Tx, learnerId: string, date: IsoDate, required: boolean, exceptId: string | null): Promise<void> {
  const n = await slotCounts(tx, learnerId, date, exceptId)
  if (!required && n.optional >= MAX_EXTRA_PER_DAY) {
    throw conflict(`${dayLabelId(date)} sudah punya ${MAX_EXTRA_PER_DAY} sesi opsional, batas sehari. Hapus atau pindahkan satu dulu.`)
  }
  if (required && n.required >= MAX_REQUIRED_PER_DAY) {
    throw conflict(`${dayLabelId(date)} sudah punya ${MAX_REQUIRED_PER_DAY} slot sesi wajib. Hapus atau pindahkan satu dulu.`)
  }
}

export type { UpsertSlotInput }

/**
 * Tambah atau ubah slot. Slot wajib menggantikan sesi dasar template dengan mapel dan jenis yang sama; slot wajib
 * kedua dengan mapel dan jenis yang sama menjadi sesi wajib tambahan. Slot opsional menjadi sesi tambahan yang
 * tidak dihitung streak. Slot paper dari Penyusun paper diisi oleh Penyusun paper.
 */
export async function upsertSlot(actor: Actor, input: UpsertSlotInput): Promise<void> {
  const norm = normaliseSlot({
    session: input.session,
    subject: input.subject,
    required: input.required,
    skillId: input.skillId,
    mode: input.mode,
    questionCount: input.questionCount,
    paperKind: input.paperKind,
    config: input.config,
    skill: input.skillId ? (skillById(input.skillId) ?? null) : null,
    skillHasLesson: input.skillId ? content().lessons.has(input.skillId) : false,
    presetSubject: input.config?.presetId ? (preset(input.config.presetId)?.subject ?? null) : null,
  })
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  await inOrg(ctx, async (tx) => {
    const learner = await planLearner(tx, input.learnerId)
    const existing = input.slotId ? await slotById(tx, input.slotId) : null
    if (existing && existing.learnerId !== learner.id) throw notFound('Slot tidak ditemukan untuk learner ini. Muat ulang halaman rencana.')
    if (existing?.paperId) throw conflict('Slot ini berisi paper. Isi paper diubah di Penyusun paper; di rencana slot paper hanya bisa dipindah atau dihapus.')
    // Hanya perubahan yang menyentuh sesi wajib hari ini yang menunggu hari berikutnya.
    await assertPlannable(tx, learner, input.date, today, { optionalOnly: !norm.required && !(existing?.required ?? false) })
    await assertNotRest(tx, learner, input.date)
    await assertRoom(tx, learner.id, input.date, norm.required, existing?.id ?? null)
    const weekId = await ensureWeek(tx, ctx, learner.id, weekStart(input.date))
    const values = {
      planWeekId: weekId,
      date: input.date,
      subject: norm.subject,
      kind: 'quest' as const,
      session: norm.session,
      required: norm.required,
      paperKind: norm.paperKind,
      config: norm.config,
      skillId: norm.skillId,
      paperId: null,
      mode: norm.mode,
      questionCount: norm.questionCount,
    }
    let slotId: string
    if (existing) {
      await tx.update(planSlot).set(values).where(eq(planSlot.id, existing.id))
      slotId = existing.id
    } else {
      const [row] = await tx
        .insert(planSlot)
        .values({ orgId: ctx.orgId, learnerId: learner.id, ...values })
        .returning({ id: planSlot.id })
      slotId = row!.id
    }
    await touchWeek(tx, weekId)
    await auditTx(tx, ctx, existing ? 'plan.slot.updated' : 'plan.slot.added', slotId, {
      learnerId: learner.id,
      date: input.date,
      subject: norm.subject,
      session: norm.session,
      required: norm.required,
      skillId: norm.skillId,
    })
  })
}

export async function moveSlot(actor: Actor, input: { slotId: string; date: IsoDate }): Promise<void> {
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  await inOrg(ctx, async (tx) => {
    const slot = await slotById(tx, input.slotId)
    if (slot.date === input.date) return
    const learner = await planLearner(tx, slot.learnerId)
    const required = slot.kind === 'bonus' ? false : slot.required
    await assertPlannable(tx, learner, input.date, today, { optionalOnly: !required })
    await assertNotRest(tx, learner, input.date)
    await assertRoom(tx, learner.id, input.date, required, slot.id)
    const weekId = await ensureWeek(tx, ctx, learner.id, weekStart(input.date))
    await tx.update(planSlot).set({ date: input.date, planWeekId: weekId }).where(eq(planSlot.id, slot.id))
    await touchWeek(tx, weekId)
    await auditTx(tx, ctx, 'plan.slot.moved', slot.id, { learnerId: learner.id, from: slot.date, to: input.date })
  })
}

export async function deleteSlot(actor: Actor, slotId: string): Promise<void> {
  const ctx = orgCtx(actor)
  await inOrg(ctx, async (tx) => {
    const rows = await tx.delete(planSlot).where(eq(planSlot.id, slotId)).returning({ id: planSlot.id, learnerId: planSlot.learnerId, date: planSlot.date, weekId: planSlot.planWeekId })
    const row = rows[0]
    if (!row) throw notFound('Slot tidak ditemukan. Mungkin sudah dihapus; muat ulang halaman rencana.')
    await touchWeek(tx, row.weekId)
    await auditTx(tx, ctx, 'plan.slot.deleted', row.id, { learnerId: row.learnerId, date: row.date })
  })
}

/** Hari istirahat per tanggal (menimpa hari istirahat mingguan di Pengaturan). */
export async function setRestDay(actor: Actor, input: { learnerId: string; date: IsoDate; rest: boolean }): Promise<void> {
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  await inOrg(ctx, async (tx) => {
    const learner = await planLearner(tx, input.learnerId)
    if (input.date < today) throw invalid(`${dayLabelId(input.date)} sudah lewat. Hari istirahat hanya bisa diubah untuk hari ini dan hari berikutnya.`)
    if (input.date > addDays(today, MAX_AHEAD_DAYS)) throw invalid('Hari istirahat paling jauh satu tahun ke depan. Pilih tanggal yang lebih dekat.')
    await tx
      .insert(restDay)
      .values({ orgId: ctx.orgId, learnerId: learner.id, date: input.date, rest: input.rest })
      .onConflictDoUpdate({ target: [restDay.learnerId, restDay.date], set: { rest: input.rest } })
    await auditTx(tx, ctx, 'plan.rest.set', learner.id, { date: input.date, rest: input.rest })
  })
}

/** Hitung ulang usulan di server dan terapkan hanya id yang masih berlaku. Mengembalikan jumlah yang diterapkan. */
export async function applySuggestions(actor: Actor, input: { learnerId: string; weekStart: IsoDate; ids: string[] }): Promise<number> {
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  return inOrg(ctx, async (tx) => {
    const monday = weekStart(input.weekStart)
    // Kunci minggu dulu supaya dua penerapan bersamaan tidak mengisi sel yang sama.
    await planLearner(tx, input.learnerId)
    const weekId = await ensureWeek(tx, ctx, input.learnerId, monday)
    const v = await weekView(tx, input.learnerId, monday, today)
    const wanted = new Set(input.ids)
    const valid = v.suggestions.filter((s) => wanted.has(s.id))
    if (valid.length === 0) throw conflict('Usulan itu sudah tidak berlaku karena rencana berubah. Muat ulang halaman untuk melihat usulan terbaru.')
    await tx.insert(planSlot).values(
      valid.map((s) => ({
        orgId: ctx.orgId,
        planWeekId: weekId,
        learnerId: v.learner.id,
        date: s.date,
        subject: s.subject,
        kind: 'quest' as const,
        session: 'latihan' as const,
        required: true,
        skillId: s.skillId,
        mode: s.mode,
        questionCount: s.questionCount,
      })),
    )
    await touchWeek(tx, weekId)
    await auditTx(tx, ctx, 'plan.suggestions.applied', weekId, { learnerId: v.learner.id, weekStart: monday, applied: valid.length, requested: input.ids.length })
    return valid.length
  })
}

export async function publishWeek(actor: Actor, input: { learnerId: string; weekStart: IsoDate }): Promise<void> {
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  await inOrg(ctx, async (tx) => {
    const learner = await planLearner(tx, input.learnerId)
    const monday = weekStart(input.weekStart)
    if (addDays(monday, 6) < today) throw invalid('Minggu itu sudah lewat, jadi rencananya tidak dipakai lagi. Pilih minggu ini atau minggu berikutnya.')
    const now = new Date()
    const [row] = await tx
      .insert(planWeek)
      .values({ orgId: ctx.orgId, learnerId: learner.id, weekStart: monday, status: 'published', publishedAt: now, createdBy: ctx.userId })
      .onConflictDoUpdate({ target: [planWeek.learnerId, planWeek.weekStart], set: { status: 'published', publishedAt: now, updatedAt: now } })
      .returning({ id: planWeek.id })
    await auditTx(tx, ctx, 'plan.week.published', row!.id, { learnerId: learner.id, weekStart: monday })
  })
}

/**
 * Template untuk satu hari: Hari sekolah, Sabtu paper penuh, atau Hari ringan. Template menentukan sesi wajib
 * dasar hari itu. Hari ini yang sesinya sudah dibuat hanya bisa menjadi Hari ringan, dan hanya bila minggu itu
 * sudah terbit: Tes dan Paper yang belum dikerjakan dibuang supaya hari tetap lengkap dengan Latihan saja.
 */
export async function setDayTemplate(actor: Actor, input: { learnerId: string; date: IsoDate; template: DayTemplateId }): Promise<void> {
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  await inOrg(ctx, async (tx) => {
    const learner = await planLearner(tx, input.learnerId)
    if (input.date < today) throw invalid(`${dayLabelId(input.date)} sudah lewat. Template hanya bisa diubah untuk hari ini dan hari berikutnya.`)
    if (input.date > addDays(today, MAX_AHEAD_DAYS)) throw invalid('Rencana paling jauh satu tahun ke depan. Pilih tanggal yang lebih dekat.')
    await assertNotRest(tx, learner, input.date)
    const created = input.date === today && (await todayQuestsCreated(tx, learner.id, today))
    const weekId = await ensureWeek(tx, ctx, learner.id, weekStart(input.date))
    const [row] = await tx.select({ templates: planWeek.dayTemplates, status: planWeek.status }).from(planWeek).where(eq(planWeek.id, weekId)).limit(1)
    if (created) {
      if (input.template !== 'light') {
        throw conflict(`Sesi hari ini sudah dibuat di tablet ${learner.name}. Hari ini hanya bisa dijadikan Hari ringan; template lain berlaku mulai besok.`)
      }
      if (row?.status !== 'published') {
        throw conflict('Terbitkan rencana minggu ini dulu supaya Hari ringan langsung berlaku di tablet hari ini.')
      }
    }
    const templates = { ...((row?.templates as Record<string, string> | undefined) ?? {}) }
    // Template bawaan hari itu (Senin sampai Jumat sekolah, Sabtu paper penuh) tidak perlu disimpan.
    if (input.template === defaultTemplate(input.date)) delete templates[input.date]
    else templates[input.date] = input.template
    await tx.update(planWeek).set({ dayTemplates: templates, updatedAt: new Date() }).where(eq(planWeek.id, weekId))
    let dropped = 0
    if (created && input.template === 'light') dropped = await dropUnstartedHeavySessions(tx, ctx, learner.id, input.date)
    await auditTx(tx, ctx, 'plan.day.template', weekId, { learnerId: learner.id, date: input.date, template: input.template, dropped })
  })
}

/**
 * Salin rencana satu minggu ke minggu lain: slot (selain paper Kertas, yang terikat lembar cetak per tanggal)
 * dan template hari. Slot di minggu tujuan pada hari yang masih bisa diubah diganti; hari yang sudah lewat,
 * hari istirahat, dan hari ini yang sesinya sudah dibuat dilewati.
 */
export async function copyWeek(actor: Actor, input: { learnerId: string; fromWeekStart: IsoDate; toWeekStart: IsoDate }): Promise<{ copied: number; skipped: number }> {
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  const from = weekStart(input.fromWeekStart)
  const to = weekStart(input.toWeekStart)
  if (from === to) throw invalid('Pilih minggu sumber yang berbeda dari minggu tujuan.')
  if (addDays(to, 6) < today) throw invalid('Minggu tujuan sudah lewat. Pilih minggu ini atau minggu berikutnya.')
  return inOrg(ctx, async (tx) => {
    const learner = await planLearner(tx, input.learnerId)
    const sourceSlots = await slotsBetween(tx, learner.id, from, addDays(from, 6))
    const [source] = await tx
      .select({ templates: planWeek.dayTemplates })
      .from(planWeek)
      .where(and(eq(planWeek.learnerId, learner.id), eq(planWeek.weekStart, from)))
      .limit(1)
    const srcTemplates = (source?.templates as Record<string, string> | undefined) ?? {}
    if (sourceSlots.length === 0 && Object.keys(srcTemplates).length === 0) {
      throw conflict(`Minggu sumber belum punya rencana. ${learner.name} memakai sesi otomatis di minggu itu.`)
    }
    const diff = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
    const weekId = await ensureWeek(tx, ctx, learner.id, to)
    const overrides = await restOverrides(tx, learner.id, to, addDays(to, 6))
    const startedToday = await todayQuestsCreated(tx, learner.id, today)
    const plannable = (date: IsoDate) => date >= today && !(date === today && startedToday) && !isRestDate(date, learner.restWeekdays, overrides)
    const targetDates = weekOf(to).filter(plannable)
    if (targetDates.length > 0) {
      await tx.delete(planSlot).where(and(eq(planSlot.learnerId, learner.id), inArray(planSlot.date, targetDates), ne(planSlot.mode, 'kertas')))
    }
    let skipped = 0
    const rows = []
    for (const s of sourceSlots) {
      const date = addDays(s.date, diff)
      if (s.mode === 'kertas' || !plannable(date)) {
        skipped++
        continue
      }
      rows.push({
        orgId: ctx.orgId,
        planWeekId: weekId,
        learnerId: learner.id,
        date,
        subject: s.subject,
        kind: s.kind,
        session: s.session,
        required: s.required,
        paperKind: s.paperKind,
        config: s.config,
        skillId: s.skillId,
        paperId: s.paperId,
        mode: s.mode,
        questionCount: s.questionCount,
      })
    }
    if (rows.length > 0) await tx.insert(planSlot).values(rows)
    const [target] = await tx.select({ templates: planWeek.dayTemplates }).from(planWeek).where(eq(planWeek.id, weekId)).limit(1)
    const templates = { ...((target?.templates as Record<string, string> | undefined) ?? {}) }
    for (const date of targetDates) delete templates[date]
    for (const [d, t] of Object.entries(srcTemplates)) {
      const date = addDays(d, diff)
      if (targetDates.includes(date)) templates[date] = t
    }
    await tx.update(planWeek).set({ dayTemplates: templates, updatedAt: new Date() }).where(eq(planWeek.id, weekId))
    await auditTx(tx, ctx, 'plan.week.copied', weekId, { learnerId: learner.id, from, to, copied: rows.length, skipped })
    return { copied: rows.length, skipped }
  })
}
