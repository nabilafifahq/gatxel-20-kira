import 'server-only'
import { and, asc, eq, gte, isNull, lte, ne, notInArray, sql } from 'drizzle-orm'
import { addDays, jakartaDate, weekStart, type IsoDate } from '@kira/core'
import { tables } from '@kira/db'
import type { PlannerDTO, PlanSlotDTO, Subject } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { auditTx } from '../audit'
import { conflict, invalid, notFound } from '../errors'
import { content, skill as skillById } from './content'
import { skillTitle, SUBJECT_ID_LABEL, SUBJECT_ORDER } from './console-common'
import { shellIn } from './console-shell'
import {
  dayLabelId,
  firstPlannableDate,
  isRestDate,
  normaliseWeek,
  plannerDays,
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
 * T03 Perencana mingguan. Today di tablet hanya memakai slot dari minggu yang sudah terbit
 * (lihat ensureTodayQuests di learner-today), satu slot quest per mapel per hari ditambah
 * satu quest bonus. Quest dibuat saat Today pertama dibuka di hari itu, jadi perubahan hanya
 * berlaku untuk hari ini (selama quest hari ini belum dibuat) dan hari berikutnya.
 * Minggu yang sudah terbit tetap terbit saat diubah.
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
  skillId: string | null
  paperId: string | null
  mode: PlanMode
  questionCount: number
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
      skillId: planSlot.skillId,
      paperId: planSlot.paperId,
      mode: planSlot.mode,
      questionCount: planSlot.questionCount,
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
    .orderBy(asc(planSlot.date), asc(planSlot.createdAt))
}

async function slotById(tx: Tx, slotId: string): Promise<SlotRow> {
  const rows = await slotQuery(tx).where(eq(planSlot.id, slotId)).limit(1)
  if (!rows[0]) throw notFound('Slot tidak ditemukan. Mungkin sudah dihapus; muat ulang halaman rencana.')
  return rows[0]
}

function toSlotDTO(r: SlotRow): PlanSlotDTO {
  if (r.paperId) {
    const count = r.paperItems ?? r.questionCount
    const title = r.paperTitle ? (r.paperDeleted ? `${r.paperTitle}, paper dihapus` : r.paperTitle) : 'Paper tidak ditemukan'
    return { id: r.id, date: r.date, subject: r.subject, kind: r.kind, skillId: null, title, mode: r.mode, minutes: slotMinutes({ questionCount: count, paperMinutes: r.paperMinutes }), questionCount: count }
  }
  return {
    id: r.id,
    date: r.date,
    subject: r.subject,
    kind: r.kind,
    skillId: r.skillId,
    title: skillTitle(r.skillId),
    mode: r.mode,
    minutes: slotMinutes({ questionCount: r.questionCount }),
    questionCount: r.questionCount,
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

type WeekView = {
  learner: PlanLearner
  monday: IsoDate
  week: IsoDate[]
  rest: Set<IsoDate>
  slots: SlotRow[]
  status: 'draft' | 'published'
  states: Map<string, SkillStateLite>
  suggestions: Suggestion[]
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
    .select({ status: planWeek.status })
    .from(planWeek)
    .where(and(eq(planWeek.learnerId, learner.id), eq(planWeek.weekStart, monday)))
    .limit(1)
  const states = await statesOf(tx, learner.id)
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
    slots: slots.map((s) => ({ date: s.date, subject: s.subject, kind: s.kind, skillId: s.paperId ? null : s.skillId, minutes: toSlotDTO(s).minutes })),
    competitions: await upcomingCompetitions(tx, learner.id, today),
  })
  return { learner, monday, week, rest, slots, status: weekRow?.status ?? 'draft', states, suggestions }
}

/** Skill untuk pemilih slot: grade learner dulu, lalu grade di bawah dan di atasnya, plus skill yang punya data. */
function pickerSkills(grade: number, states: Map<string, SkillStateLite>): PlannerDTO['skills'] {
  const rank = (g: number) => (g === grade ? 0 : g < grade ? 1 : 2)
  return [...content().skills.values()]
    .filter((s) => Math.abs(s.grade - grade) <= 1 || states.has(s.id))
    .sort((a, b) => SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject) || rank(a.grade) - rank(b.grade) || a.grade - b.grade || a.order - b.order)
    .map((s) => ({ id: s.id, subject: s.subject, grade: s.grade, title: s.title, stars: states.get(s.id)?.stars ?? 0 }))
}

function weekHref(learnerId: string, monday: IsoDate): string {
  return `/konsol/rencana?learner=${encodeURIComponent(learnerId)}&minggu=${monday}`
}

/** T03: null bila belum ada learner sama sekali (halaman mengarahkan ke daftar learner). */
export async function plannerDTO(actor: Actor, learnerParam: string | null, weekParam: string | null): Promise<PlannerDTO | null> {
  const today = jakartaDate()
  return inOrg(orgCtx(actor), async (tx) => {
    const { shell, learner } = await shellIn(tx, actor, learnerParam)
    if (!learner) return null
    const monday = normaliseWeek(weekParam, today)
    const v = await weekView(tx, learner.id, monday, today)
    const slots = v.slots
      .map(toSlotDTO)
      .sort((a, b) => a.date.localeCompare(b.date) || SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject) || (a.kind === b.kind ? 0 : a.kind === 'quest' ? -1 : 1))
    return {
      shell,
      learnerId: v.learner.id,
      weekStart: monday,
      weekLabel: weekLabelLong(monday),
      status: v.status,
      days: plannerDays(v.week, v.rest, slots, v.learner.screenLimitMin),
      slots,
      suggestions: v.suggestions.map((s) => ({ id: s.id, date: s.date, subject: s.subject, skillId: s.skillId, title: s.title, reason: s.reason })),
      skills: pickerSkills(v.learner.grade, v.states),
      screenLimitMin: v.learner.screenLimitMin,
      prevWeekHref: weekHref(v.learner.id, addDays(monday, -7)),
      nextWeekHref: weekHref(v.learner.id, addDays(monday, 7)),
    }
  })
}

// ---------------------------------------------------------------------------
// Perubahan

const MAX_AHEAD_DAYS = 366

/** Tanggal masih berpengaruh: tidak lewat, tidak lebih dari setahun lagi, dan bukan hari ini yang quest-nya sudah dibuat. */
async function assertPlannable(tx: Tx, learner: PlanLearner, date: IsoDate, today: IsoDate): Promise<void> {
  if (date < today) throw invalid(`${dayLabelId(date)} sudah lewat. Rencana hanya bisa diubah untuk hari ini dan hari berikutnya.`)
  if (date > addDays(today, MAX_AHEAD_DAYS)) throw invalid('Rencana paling jauh satu tahun ke depan. Pilih tanggal yang lebih dekat.')
  if (date === today && (await todayQuestsCreated(tx, learner.id, today))) {
    throw conflict(`Quest hari ini sudah dibuat di tablet ${learner.name}, jadi perubahan untuk hari ini tidak dipakai lagi. Pilih besok atau hari berikutnya.`)
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

async function otherBonus(tx: Tx, learnerId: string, date: IsoDate, exceptId: string | null): Promise<boolean> {
  const rows = await tx
    .select({ id: planSlot.id })
    .from(planSlot)
    .where(and(eq(planSlot.learnerId, learnerId), eq(planSlot.date, date), eq(planSlot.kind, 'bonus'), exceptId ? ne(planSlot.id, exceptId) : undefined))
    .limit(1)
  return rows.length > 0
}

export type UpsertSlotInput = {
  learnerId: string
  slotId?: string | undefined
  date: IsoDate
  subject: Subject
  kind: 'quest' | 'bonus'
  skillId: string
  mode: PlanMode
  questionCount: number
}

/**
 * Tambah atau ubah slot skill. Slot quest baru menggantikan slot quest lain di mapel dan hari
 * yang sama; quest bonus hanya satu per hari. Slot paper dibuat dan diisi oleh Penyusun paper.
 */
export async function upsertSlot(actor: Actor, input: UpsertSlotInput): Promise<void> {
  // Today melewati slot Kertas (paper dicetak lalu dinilai lewat Input LJK), jadi slot skill harus mode tablet.
  if (input.mode === 'kertas') {
    const msg = 'Mode Kertas hanya untuk paper dari Penyusun paper. Pilih Belajar, Latihan, atau Tes.'
    throw invalid(msg, { mode: msg })
  }
  const sk = skillById(input.skillId)
  if (!sk) throw invalid('Skill itu tidak ada di konten Kira. Pilih skill dari daftar.', { skillId: 'Pilih skill dari daftar.' })
  if (sk.subject !== input.subject) {
    throw invalid(`${sk.title} bukan skill ${SUBJECT_ID_LABEL[input.subject]}. Pilih skill dari mapel ${SUBJECT_ID_LABEL[input.subject]}.`, { skillId: 'Skill dan mapel tidak cocok.' })
  }
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  await inOrg(ctx, async (tx) => {
    const learner = await planLearner(tx, input.learnerId)
    const existing = input.slotId ? await slotById(tx, input.slotId) : null
    if (existing && existing.learnerId !== learner.id) throw notFound('Slot tidak ditemukan untuk learner ini. Muat ulang halaman rencana.')
    if (existing?.paperId) throw conflict('Slot ini berisi paper. Isi paper diubah di Penyusun paper; di rencana slot paper hanya bisa dipindah atau dihapus.')
    await assertPlannable(tx, learner, input.date, today)
    await assertNotRest(tx, learner, input.date)
    const weekId = await ensureWeek(tx, ctx, learner.id, weekStart(input.date))
    let replaced = 0
    if (input.kind === 'bonus') {
      if (await otherBonus(tx, learner.id, input.date, existing?.id ?? null)) {
        throw conflict(`Sudah ada quest bonus di ${dayLabelId(input.date)}. Ubah atau hapus quest bonus itu dulu.`)
      }
    } else {
      const gone = await tx
        .delete(planSlot)
        .where(
          and(
            eq(planSlot.learnerId, learner.id),
            eq(planSlot.date, input.date),
            eq(planSlot.subject, input.subject),
            eq(planSlot.kind, 'quest'),
            existing ? ne(planSlot.id, existing.id) : undefined,
          ),
        )
        .returning({ id: planSlot.id })
      replaced = gone.length
    }
    const values = { planWeekId: weekId, date: input.date, subject: input.subject, kind: input.kind, skillId: sk.id, paperId: null, mode: input.mode, questionCount: input.questionCount }
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
    await auditTx(tx, ctx, existing ? 'plan.slot.updated' : 'plan.slot.added', slotId, { learnerId: learner.id, date: input.date, subject: input.subject, kind: input.kind, skillId: sk.id, replaced })
  })
}

export async function moveSlot(actor: Actor, input: { slotId: string; date: IsoDate }): Promise<void> {
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  await inOrg(ctx, async (tx) => {
    const slot = await slotById(tx, input.slotId)
    if (slot.date === input.date) return
    const learner = await planLearner(tx, slot.learnerId)
    await assertPlannable(tx, learner, input.date, today)
    await assertNotRest(tx, learner, input.date)
    const weekId = await ensureWeek(tx, ctx, learner.id, weekStart(input.date))
    if (slot.kind === 'bonus') {
      if (await otherBonus(tx, learner.id, input.date, slot.id)) {
        throw conflict(`Sudah ada quest bonus di ${dayLabelId(input.date)}. Hapus atau pindahkan quest bonus itu dulu.`)
      }
    } else {
      const taken = await tx
        .select({ id: planSlot.id })
        .from(planSlot)
        .where(and(eq(planSlot.learnerId, learner.id), eq(planSlot.date, input.date), eq(planSlot.subject, slot.subject), eq(planSlot.kind, 'quest'), ne(planSlot.id, slot.id)))
        .limit(1)
      if (taken[0]) {
        throw conflict(`${dayLabelId(input.date)} sudah punya quest ${SUBJECT_ID_LABEL[slot.subject]}. Hapus atau pindahkan slot itu dulu, atau pilih hari lain.`)
      }
    }
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
