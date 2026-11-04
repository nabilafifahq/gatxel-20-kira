import 'server-only'
import { and, asc, eq, gte, inArray, isNull, lte, ne, notInArray, sql } from 'drizzle-orm'
import {
  DAY_TEMPLATES,
  DAY_PRESET_LABEL_ID,
  LATIHAN_COUNT,
  TES_COUNT,
  MAX_EXTRA_PER_DAY,
  addDays,
  baselineSessions,
  composeDay,
  type DayPreset,
  type DayRules,
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
import type { DayTemplateId, PlanChangeResult, PlannerDTO, PlannerDay, PlanSlotConfig, PlanSlotDTO, SessionTarget, Subject, UpsertSlotInput } from '@/lib/dto'
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
import { dayRulesFor } from './learner-rules'
import { featureMapFor } from './learner-features'
import { sessionAllowed } from '@kira/core/features'
import { questContentDiffers, questSlotValues, questStarted, syncTodayIfCreated, type QuestRow } from './learner-session'
import {
  SESSION_LABEL_ID,
  TEMPLATE_LABEL_ID,
  dayLabelId,
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

const CORE_SESSIONS: readonly SessionType[] = ['latihan', 'tes', 'paper']
const CONSOLE_ROUTES_SETTINGS = '/konsol/pengaturan'

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
  base: boolean
  off: boolean
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
      base: planSlot.base,
      off: planSlot.off,
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
      return r.skillId ? skillTitle(r.skillId) : r.session === 'tes' ? 'Skill sama dengan Latihan' : r.session === 'latihan' ? 'Skill dipilih Kira' : SESSION_LABEL_ID[r.session]
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
    required: e.required,
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

/** Sesi hari ini yang sudah dimulai atau selesai di tablet. */
async function startedQuestsOn(tx: Tx, learnerId: string, date: IsoDate): Promise<QuestRow[]> {
  const rows = await tx.select().from(quest).where(and(eq(quest.learnerId, learnerId), eq(quest.date, date), ne(quest.kind, 'bonus')))
  const out: QuestRow[] = []
  for (const q of rows) if (await questStarted(tx, q)) out.push(q)
  return out
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
  preset: DayPreset
  rules: DayRules
}

function plannedOf(rows: readonly SlotRow[]): PlannedSlot[] {
  return rows.map((r, i) => ({ id: r.id, subject: r.subject, session: r.session, required: r.kind === 'bonus' ? false : r.required, paperKind: r.paperKind, order: i, base: r.base, off: r.off }))
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
  const { rules, preset } = await dayRulesFor(tx, learner.id)
  const startedToday = monday <= today && today <= sunday ? await startedQuestsOn(tx, learner.id, today) : []

  const sessions: PlanSlotDTO[] = []
  for (const date of week) {
    if (rest.has(date)) continue
    const rows = slots.filter((s) => s.date === date)
    const byId = new Map(rows.map((r) => [r.id, r]))
    const fullMinutes = (subject: Subject) => paperPresetFor(subject, learner.grade, date)?.rules.timeLimitMin ?? null
    for (const e of composeDay({ template: templateAt(templates, date), date, slots: plannedOf(rows), rules })) {
      const row = e.slotId ? byId.get(e.slotId) : undefined
      const dto = row ? { ...toSlotDTO(row, fullMinutes(row.subject)), required: e.required, paperKind: e.paper ?? row.paperKind } : autoDTO(e, date, fullMinutes(e.subject))
      sessions.push(date === today ? { ...dto, started: startedToday.some((q) => (e.slotId ? q.planSlotId === e.slotId : q.planSlotId === null && q.subject === e.subject && q.session === e.session)) } : dto)
    }
    // Slot yang tidak masuk susunan hari (melebihi batas sesi opsional) tetap terlihat supaya bisa dihapus.
    for (const r of rows) if (!r.off && !sessions.some((s) => s.id === r.id)) sessions.push(toSlotDTO(r, fullMinutes(r.subject)))
  }

  const c = content()
  const skills = new Map<string, SkillMeta>()
  for (const s of c.skills.values()) skills.set(s.id, toMeta(s))
  const curriculum = SUBJECT_ORDER.flatMap((subject) => (c.skillsByKey.get(`${subject}:${learner.grade}`) ?? []).map((s) => skills.get(s.id)!))
  const suggestions = suggestWeek({
    today,
    // Hari ini juga bisa diubah: sesi yang belum dimulai di tablet disamakan, yang sudah dimulai dipertahankan.
    firstPlannable: today,
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
  return { learner, monday, week, rest, slots, status: weekRow?.status ?? 'draft', templates, states, suggestions, sessions, preset, rules }
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
      dayPresetLabel: DAY_PRESET_LABEL_ID[v.preset],
      rulesHref: `${CONSOLE_ROUTES_SETTINGS}?learner=${encodeURIComponent(v.learner.id)}#aturan-hari`,
      prevWeekHref: weekHref(v.learner.id, addDays(monday, -7)),
      nextWeekHref: weekHref(v.learner.id, addDays(monday, 7)),
    }
  })
}

// ---------------------------------------------------------------------------
// Perubahan

const MAX_AHEAD_DAYS = 366
const MAX_REQUIRED_PER_DAY = 15

const NO_CHANGE: PlanChangeResult = { today: false, published: false, created: 0, removed: 0, regenerated: 0, kept: 0 }

/** Tanggal masih berpengaruh: tidak lewat dan tidak lebih dari setahun lagi. Hari ini boleh diubah (lihat applyToday). */
function assertPlannable(date: IsoDate, today: IsoDate): void {
  if (date < today) throw invalid(`${dayLabelId(date)} sudah lewat. Rencana hanya bisa diubah untuk hari ini dan hari berikutnya.`)
  if (date > addDays(today, MAX_AHEAD_DAYS)) throw invalid('Rencana paling jauh satu tahun ke depan. Pilih tanggal yang lebih dekat.')
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

/**
 * Jumlah slot wajib dan opsional tambahan di sebuah hari, tanpa slot yang sedang diubah. Slot yang menggantikan
 * atau mematikan sesi dasar tidak dihitung: batasnya hanya untuk sesi yang ditambahkan tutor.
 */
async function slotCounts(tx: Tx, learnerId: string, date: IsoDate, exceptId: string | null): Promise<{ required: number; optional: number }> {
  const rows = await tx
    .select({ required: planSlot.required, kind: planSlot.kind, base: planSlot.base, off: planSlot.off })
    .from(planSlot)
    .where(and(eq(planSlot.learnerId, learnerId), eq(planSlot.date, date), exceptId ? ne(planSlot.id, exceptId) : undefined))
  const added = rows.filter((r) => !r.base && !r.off)
  const optional = added.filter((r) => !r.required || r.kind === 'bonus').length
  return { required: added.length - optional, optional }
}

async function assertRoom(tx: Tx, learnerId: string, date: IsoDate, required: boolean, exceptId: string | null): Promise<void> {
  const n = await slotCounts(tx, learnerId, date, exceptId)
  if (!required && n.optional >= MAX_EXTRA_PER_DAY) {
    throw conflict(`${dayLabelId(date)} sudah punya ${MAX_EXTRA_PER_DAY} sesi opsional tambahan, batas sehari. Hapus atau pindahkan satu dulu.`)
  }
  if (required && n.required >= MAX_REQUIRED_PER_DAY) {
    throw conflict(`${dayLabelId(date)} sudah punya ${MAX_REQUIRED_PER_DAY} slot sesi wajib. Hapus atau pindahkan satu dulu.`)
  }
}

export type { UpsertSlotInput }

/** Susunan sesi sebuah hari menurut aturan hari, template, dan slot saat ini. */
async function dayEntries(tx: Tx, learner: PlanLearner, date: IsoDate): Promise<{ entries: DayEntry[]; template: DayTemplate; rules: DayRules }> {
  const [weekRow] = await tx
    .select({ templates: planWeek.dayTemplates })
    .from(planWeek)
    .where(and(eq(planWeek.learnerId, learner.id), eq(planWeek.weekStart, weekStart(date))))
    .limit(1)
  const rows = await slotsBetween(tx, learner.id, date, date)
  const { rules } = await dayRulesFor(tx, learner.id)
  const template = templateAt(weekRow?.templates, date)
  const features = await featureMapFor(tx, learner.id)
  return { entries: composeDay({ template, date, slots: plannedOf(rows), rules }).filter((e) => sessionAllowed(features, e.subject, e.session)), template, rules }
}

// ---------------------------------------------------------------------------
// Hari ini: sesi yang sudah dibuat di tablet

/**
 * Sesi hari ini milik sebuah slot atau sesi otomatis: yang terhubung ke slot itu, atau (untuk sesi lama dan sesi
 * otomatis) sesi mapel dan jenis yang sama yang belum terhubung ke slot. Yang sudah dimulai didahulukan.
 */
async function questForTarget(tx: Tx, learnerId: string, date: IsoDate, t: { slotId: string | null; subject: Subject; session: SessionType }): Promise<QuestRow | null> {
  const rows = await tx
    .select()
    .from(quest)
    .where(and(eq(quest.learnerId, learnerId), eq(quest.date, date), ne(quest.kind, 'bonus'), eq(quest.subject, t.subject), eq(quest.session, t.session)))
  if (t.slotId) {
    const bySlot = rows.find((q) => q.planSlotId === t.slotId)
    if (bySlot) return bySlot
  }
  const free = rows.filter((q) => q.planSlotId === null)
  for (const q of free) if (await questStarted(tx, q)) return q
  return free[0] ?? null
}

function startedText(q: Pick<QuestRow, 'status'>, name: string): string {
  const state = q.status === 'done' ? 'sudah selesai' : 'sudah dimulai'
  return `Sesi ini ${state} di tablet ${name}. Soal dan jawaban yang sudah masuk dipertahankan, jadi isinya (skill, mode, jumlah soal, atau paper) tidak bisa diubah hari ini.`
}

/**
 * Setelah perubahan yang mengenai hari ini: terbitkan minggu itu bila masih draf (supaya tablet memakai perubahan
 * itu), lalu samakan sesi hari ini. Sesi yang belum dimulai dibuat ulang, dihapus, atau ditambah; sesi yang sedang
 * berjalan atau selesai dipertahankan isinya. day_record dan streak dihitung ulang di transaksi yang sama.
 */
async function applyToday(tx: Tx, ctx: OrgContext, learnerId: string, dates: readonly IsoDate[], today: IsoDate, opts: { publish: boolean }): Promise<PlanChangeResult> {
  if (!dates.includes(today)) return NO_CHANGE
  let published = false
  if (opts.publish) {
    const [wk] = await tx
      .select({ id: planWeek.id, status: planWeek.status })
      .from(planWeek)
      .where(and(eq(planWeek.learnerId, learnerId), eq(planWeek.weekStart, weekStart(today))))
      .limit(1)
    if (wk && wk.status !== 'published') {
      const now = new Date()
      await tx.update(planWeek).set({ status: 'published', publishedAt: now, updatedAt: now }).where(eq(planWeek.id, wk.id))
      await auditTx(tx, ctx, 'plan.week.published', wk.id, { learnerId, weekStart: weekStart(today), auto: true })
      published = true
    }
  }
  const r = await syncTodayIfCreated(tx, ctx, learnerId, today)
  return { today: true, published, created: r?.created ?? 0, removed: r?.removed ?? 0, regenerated: r?.regenerated ?? 0, kept: r?.kept ?? 0 }
}

/** Isi slot untuk sesi otomatis: sama dengan sesi hari ini bila sudah dibuat, atau bawaan bila belum. */
async function autoSlotValues(tx: Tx, learner: PlanLearner, date: IsoDate, today: IsoDate, entry: DayEntry) {
  const fallback = {
    mode: (entry.session === 'tes' ? 'tes' : 'latihan') as PlanMode,
    questionCount: entry.session === 'tes' ? TES_COUNT : LATIHAN_COUNT,
    paperKind: entry.session === 'paper' ? (entry.paper ?? 'mini') : null,
    config: null as Record<string, string | number> | null,
  }
  if (date !== today) return fallback
  const q = await questForTarget(tx, learner.id, date, { slotId: null, subject: entry.subject, session: entry.session })
  if (!q) return fallback
  const v = questSlotValues(q)
  return { mode: v.mode as PlanMode, questionCount: v.questionCount, paperKind: entry.session === 'paper' ? (entry.paper ?? v.paperKind) : null, config: v.config }
}

// ---------------------------------------------------------------------------
// Tambah, ubah, pindah, hapus

/**
 * Tambah atau ubah slot. Slot dasar (dari sesi otomatis, atau slot wajib yang menggantikan sesi dasar) menggantikan
 * sesi dasar dengan mapel dan jenis yang sama dan membawa pilihan Wajib atau Opsional sendiri; slot lain menjadi
 * sesi tambahan. Untuk hari ini, sesi yang belum dimulai di tablet langsung dibuat ulang; sesi yang sudah dimulai
 * atau selesai hanya boleh berganti Wajib atau Opsional. Slot paper dari Penyusun paper diisi oleh Penyusun paper.
 */
export async function upsertSlot(actor: Actor, input: UpsertSlotInput): Promise<PlanChangeResult> {
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
  return inOrg(ctx, async (tx) => {
    const learner = await planLearner(tx, input.learnerId)
    const existing = input.slotId ? await slotById(tx, input.slotId) : null
    if (existing && existing.learnerId !== learner.id) throw notFound('Slot tidak ditemukan untuk learner ini. Muat ulang halaman rencana.')
    if (existing?.paperId) throw conflict('Slot ini berisi paper. Isi paper diubah di Penyusun paper; di rencana slot paper hanya bisa dipindah atau dihapus.')
    assertPlannable(input.date, today)
    await assertNotRest(tx, learner, input.date)

    // Sesi hari ini yang sudah dimulai: isinya tidak boleh berubah.
    if (input.date === today) {
      const q = await questForTarget(tx, learner.id, input.date, {
        slotId: existing?.id ?? null,
        subject: existing?.subject ?? input.subject,
        session: existing?.session ?? input.session,
      })
      const editsThis = existing !== null || input.fromAuto === true
      if (q && editsThis && (await questStarted(tx, q))) {
        const differs = questContentDiffers(q, {
          session: norm.session,
          subject: norm.subject,
          skillId: norm.skillId,
          mode: norm.mode,
          questionCount: norm.questionCount,
          paperKind: norm.paperKind,
          paperId: null,
          config: norm.config,
        })
        if (differs) throw conflict(`${startedText(q, learner.name)} Yang masih bisa diubah: Wajib atau Opsional.`)
      }
    }

    // Slot baru menggantikan sesi dasar yang belum punya slot bila dibuka dari sesi otomatis, atau bila wajib.
    const { entries } = await dayEntries(tx, learner, input.date)
    const unclaimed = entries.find((e) => e.baseline && e.slotId === null && e.subject === norm.subject && e.session === norm.session)
    const [offRow] = existing
      ? []
      : await tx
          .select({ id: planSlot.id })
          .from(planSlot)
          .where(and(eq(planSlot.learnerId, learner.id), eq(planSlot.date, input.date), eq(planSlot.subject, norm.subject), eq(planSlot.session, norm.session), eq(planSlot.off, true)))
          .limit(1)
    const base = existing ? existing.base : offRow ? true : Boolean(unclaimed) && (input.fromAuto === true || norm.required)
    if (!base) await assertRoom(tx, learner.id, input.date, norm.required, existing?.id ?? null)
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
      base,
      off: false,
    }
    const targetId = existing?.id ?? offRow?.id ?? null
    let slotId: string
    if (targetId) {
      await tx.update(planSlot).set(values).where(eq(planSlot.id, targetId))
      slotId = targetId
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
    return applyToday(tx, ctx, learner.id, [input.date], today, { publish: true })
  })
}

/** Jadikan satu sesi Wajib (dihitung streak) atau Opsional. Boleh untuk sesi yang sudah dimulai atau selesai hari ini. */
export async function setSessionRequired(actor: Actor, input: SessionTarget & { required: boolean }): Promise<PlanChangeResult> {
  if (!CORE_SESSIONS.includes(input.session)) throw invalid('Hanya Latihan, Tes, dan Paper yang bisa dijadikan wajib. Sesi jenis lain selalu opsional.')
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  return inOrg(ctx, async (tx) => {
    const learner = await planLearner(tx, input.learnerId)
    assertPlannable(input.date, today)
    await assertNotRest(tx, learner, input.date)
    const weekId = await ensureWeek(tx, ctx, learner.id, weekStart(input.date))
    let slotId: string
    // Tanpa slotId: pakai slot dasar yang sudah menggantikan sesi otomatis itu (misalnya setelah dijadikan Opsional).
    const claimed = input.slotId ? null : (await dayEntries(tx, learner, input.date)).entries.find((e) => e.baseline && e.slotId !== null && e.subject === input.subject && e.session === input.session)
    const useSlotId = input.slotId ?? claimed?.slotId ?? null
    if (useSlotId) {
      const slot = await slotById(tx, useSlotId)
      if (slot.learnerId !== learner.id || slot.date !== input.date) throw notFound('Slot tidak ditemukan untuk hari itu. Muat ulang halaman rencana.')
      if (!slot.base) await assertRoom(tx, learner.id, slot.date, input.required, slot.id)
      await tx.update(planSlot).set({ required: input.required }).where(eq(planSlot.id, slot.id))
      slotId = slot.id
    } else {
      const { entries } = await dayEntries(tx, learner, input.date)
      const entry = entries.find((e) => e.baseline && e.slotId === null && e.subject === input.subject && e.session === input.session)
      if (!entry) throw conflict('Sesi ini sudah tidak ada di hari itu. Muat ulang halaman rencana.')
      const v = await autoSlotValues(tx, learner, input.date, today, entry)
      const [row] = await tx
        .insert(planSlot)
        .values({
          orgId: ctx.orgId,
          planWeekId: weekId,
          learnerId: learner.id,
          date: input.date,
          subject: input.subject,
          kind: 'quest',
          session: input.session,
          required: input.required,
          paperKind: v.paperKind,
          config: v.config,
          skillId: null,
          paperId: null,
          mode: v.mode,
          questionCount: v.questionCount,
          base: true,
          off: false,
        })
        .returning({ id: planSlot.id })
      slotId = row!.id
    }
    await touchWeek(tx, weekId)
    await auditTx(tx, ctx, 'plan.session.required', slotId, { learnerId: learner.id, date: input.date, subject: input.subject, session: input.session, required: input.required })
    return applyToday(tx, ctx, learner.id, [input.date], today, { publish: true })
  })
}

/**
 * Hapus satu sesi dari sebuah hari. Slot tambahan dihapus; slot yang menggantikan sesi dasar, dan sesi otomatis,
 * dimatikan (Mati) supaya sesi dasarnya tidak muncul lagi. Sesi hari ini yang sudah dimulai atau selesai tidak
 * bisa dihapus (jadikan Opsional).
 */
async function removeSessionIn(
  tx: Tx,
  ctx: OrgContext,
  learner: PlanLearner,
  today: IsoDate,
  t: { date: IsoDate; subject: Subject; session: SessionType; slot: SlotRow | null },
): Promise<PlanChangeResult> {
  if (t.date === today) {
    const q = await questForTarget(tx, learner.id, t.date, { slotId: t.slot?.id ?? null, subject: t.subject, session: t.session })
    if (q && (await questStarted(tx, q))) throw conflict(`${startedText(q, learner.name)} Sesi ini tidak bisa dihapus, tetapi bisa dijadikan Opsional supaya tidak dihitung streak.`)
  }
  const weekId = await ensureWeek(tx, ctx, learner.id, weekStart(t.date))
  const { entries, template, rules } = await dayEntries(tx, learner, t.date)
  const hasBaseline = baselineSessions(template, t.date, rules).some((b) => b.subject === t.subject && b.session === t.session)
  let id: string
  if (t.slot) {
    id = t.slot.id
    if (t.slot.base && hasBaseline && !t.slot.off) await tx.update(planSlot).set({ off: true }).where(eq(planSlot.id, t.slot.id))
    else await tx.delete(planSlot).where(eq(planSlot.id, t.slot.id))
  } else {
    const entry = entries.find((e) => e.baseline && e.slotId === null && e.subject === t.subject && e.session === t.session)
    if (!entry) throw conflict('Sesi ini sudah tidak ada di hari itu. Muat ulang halaman rencana.')
    const [row] = await tx
      .insert(planSlot)
      .values({
        orgId: ctx.orgId,
        planWeekId: weekId,
        learnerId: learner.id,
        date: t.date,
        subject: t.subject,
        kind: 'quest',
        session: t.session,
        required: true,
        skillId: null,
        mode: 'latihan',
        questionCount: LATIHAN_COUNT,
        base: true,
        off: true,
      })
      .returning({ id: planSlot.id })
    id = row!.id
  }
  await touchWeek(tx, weekId)
  await auditTx(tx, ctx, 'plan.slot.deleted', id, { learnerId: learner.id, date: t.date, subject: t.subject, session: t.session, off: !t.slot || (t.slot.base && hasBaseline) })
  return applyToday(tx, ctx, learner.id, [t.date], today, { publish: true })
}

export async function removeSession(actor: Actor, input: SessionTarget): Promise<PlanChangeResult> {
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  return inOrg(ctx, async (tx) => {
    const learner = await planLearner(tx, input.learnerId)
    assertPlannable(input.date, today)
    await assertNotRest(tx, learner, input.date)
    const slot = input.slotId ? await slotById(tx, input.slotId) : null
    if (slot && (slot.learnerId !== learner.id || slot.date !== input.date)) throw notFound('Slot tidak ditemukan untuk hari itu. Muat ulang halaman rencana.')
    return removeSessionIn(tx, ctx, learner, today, { date: input.date, subject: slot?.subject ?? input.subject, session: slot?.session ?? input.session, slot })
  })
}

export async function deleteSlot(actor: Actor, slotId: string): Promise<PlanChangeResult> {
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  return inOrg(ctx, async (tx) => {
    const slot = await slotById(tx, slotId)
    const learner = await planLearner(tx, slot.learnerId)
    if (slot.date < today) {
      // Hari yang sudah lewat tidak berpengaruh lagi pada sesi; slotnya tetap boleh dibersihkan.
      const [row] = await tx.delete(planSlot).where(eq(planSlot.id, slot.id)).returning({ weekId: planSlot.planWeekId })
      if (row) await touchWeek(tx, row.weekId)
      await auditTx(tx, ctx, 'plan.slot.deleted', slot.id, { learnerId: slot.learnerId, date: slot.date })
      return NO_CHANGE
    }
    return removeSessionIn(tx, ctx, learner, today, { date: slot.date, subject: slot.subject, session: slot.session, slot })
  })
}

export async function moveSlot(actor: Actor, input: { slotId: string; date: IsoDate }): Promise<PlanChangeResult> {
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  return inOrg(ctx, async (tx) => {
    const slot = await slotById(tx, input.slotId)
    if (slot.date === input.date) return NO_CHANGE
    const learner = await planLearner(tx, slot.learnerId)
    const required = slot.kind === 'bonus' ? false : slot.required
    assertPlannable(input.date, today)
    await assertNotRest(tx, learner, input.date)
    if (slot.date === today) {
      const q = await questForTarget(tx, learner.id, slot.date, { slotId: slot.id, subject: slot.subject, session: slot.session })
      if (q && (await questStarted(tx, q))) throw conflict(`${startedText(q, learner.name)} Sesi ini tidak bisa dipindah ke hari lain.`)
    }
    if (!slot.base) await assertRoom(tx, learner.id, input.date, required, slot.id)
    const weekId = await ensureWeek(tx, ctx, learner.id, weekStart(input.date))
    await tx.update(planSlot).set({ date: input.date, planWeekId: weekId }).where(eq(planSlot.id, slot.id))
    await touchWeek(tx, weekId)
    await auditTx(tx, ctx, 'plan.slot.moved', slot.id, { learnerId: learner.id, from: slot.date, to: input.date })
    return applyToday(tx, ctx, learner.id, [slot.date, input.date], today, { publish: true })
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
export async function applySuggestions(actor: Actor, input: { learnerId: string; weekStart: IsoDate; ids: string[] }): Promise<PlanChangeResult> {
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
        base: true,
        skillId: s.skillId,
        mode: s.mode,
        questionCount: s.questionCount,
      })),
    )
    await touchWeek(tx, weekId)
    await auditTx(tx, ctx, 'plan.suggestions.applied', weekId, { learnerId: v.learner.id, weekStart: monday, applied: valid.length, requested: input.ids.length })
    return applyToday(tx, ctx, v.learner.id, valid.map((s) => s.date), today, { publish: true })
  })
}

export async function publishWeek(actor: Actor, input: { learnerId: string; weekStart: IsoDate }): Promise<PlanChangeResult> {
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  return inOrg(ctx, async (tx) => {
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
    // Bila minggu ini punya sesi hari ini yang sudah dibuat, samakan dengan rencana yang baru terbit.
    return applyToday(tx, ctx, learner.id, weekOf(monday), today, { publish: false })
  })
}

/**
 * Template untuk satu hari: Hari sekolah, Sabtu paper penuh, atau Hari ringan. Template menimpa aturan hari learner
 * untuk hari itu. Untuk hari ini, sesi yang belum dimulai di tablet langsung disamakan (Hari ringan membuang Tes dan
 * Paper yang belum dikerjakan); sesi yang sudah dimulai atau selesai dipertahankan.
 */
export async function setDayTemplate(actor: Actor, input: { learnerId: string; date: IsoDate; template: DayTemplateId }): Promise<PlanChangeResult> {
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  return inOrg(ctx, async (tx) => {
    const learner = await planLearner(tx, input.learnerId)
    if (input.date < today) throw invalid(`${dayLabelId(input.date)} sudah lewat. Template hanya bisa diubah untuk hari ini dan hari berikutnya.`)
    if (input.date > addDays(today, MAX_AHEAD_DAYS)) throw invalid('Rencana paling jauh satu tahun ke depan. Pilih tanggal yang lebih dekat.')
    await assertNotRest(tx, learner, input.date)
    const weekId = await ensureWeek(tx, ctx, learner.id, weekStart(input.date))
    const [row] = await tx.select({ templates: planWeek.dayTemplates }).from(planWeek).where(eq(planWeek.id, weekId)).limit(1)
    const templates = { ...((row?.templates as Record<string, string> | undefined) ?? {}) }
    // Template bawaan hari itu (Senin sampai Jumat sekolah, Sabtu paper penuh) tidak perlu disimpan.
    if (input.template === defaultTemplate(input.date)) delete templates[input.date]
    else templates[input.date] = input.template
    await tx.update(planWeek).set({ dayTemplates: templates, updatedAt: new Date() }).where(eq(planWeek.id, weekId))
    const change = await applyToday(tx, ctx, learner.id, [input.date], today, { publish: true })
    await auditTx(tx, ctx, 'plan.day.template', weekId, { learnerId: learner.id, date: input.date, template: input.template, removed: change.removed, regenerated: change.regenerated })
    return change
  })
}

/**
 * Salin rencana satu minggu ke minggu lain: slot (selain paper Kertas, yang terikat lembar cetak per tanggal)
 * dan template hari. Slot di minggu tujuan pada hari yang masih bisa diubah diganti; hari yang sudah lewat dan
 * hari istirahat dilewati. Hari ini ikut diganti dan disamakan dengan tablet (sesi yang sudah dimulai dipertahankan).
 */
export async function copyWeek(actor: Actor, input: { learnerId: string; fromWeekStart: IsoDate; toWeekStart: IsoDate }): Promise<{ copied: number; skipped: number; change: PlanChangeResult }> {
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
    const plannable = (date: IsoDate) => date >= today && !isRestDate(date, learner.restWeekdays, overrides)
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
        base: s.base,
        off: s.off,
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
    const change = await applyToday(tx, ctx, learner.id, targetDates, today, { publish: false })
    return { copied: rows.length, skipped, change }
  })
}
