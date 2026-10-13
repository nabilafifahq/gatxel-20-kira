import 'server-only'
import { and, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm'
import { addDays, jakartaDate, weekStart, type IsoDate } from '@kira/core'
import { findContentDir } from '@kira/content/load'
import { loadPrograms } from '@kira/content/extras'
import { expandProgram, PROGRAM_DAYS, type Program } from '@kira/content/programs'
import { tables } from '@kira/db'
import type { ProgramCardDTO, ProgramRunDTO, ProgramsDTO, ProgramStartResult } from '@/lib/dto-paper'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import { auditTx } from '../audit'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { conflict, invalid, notFound } from '../errors'
import { shellIn } from './console-shell'
import { dayLabelId, firstPlannableDate, isRestDate } from './planner-logic'

/**
 * Program Persiapan Olimpiade di perencana (rencana 13.3). Tutor memilih program dan tanggal mulai; slot Latihan dan
 * Tes harian ditulis ke `plan_slot` sebagai sesi wajib (isi harian ada di packages/content/src/programs.ts), dan Sabtu
 * simulasi menambah Paper penuh. Hari istirahat dilewati, slot yang bentrok dengan sesi wajib tutor di mapel, hari,
 * dan jenis sesi yang sama dilewati, dan minggu yang belum ada dibuat
 * langsung terbit supaya Today memakainya. Minggu yang sudah ada tidak diubah statusnya.
 */

const { planWeek, planSlot, restDay, learnerProfile, programRun, quest } = tables

const MAX_AHEAD_DAYS = 366

let cache: Program[] | null = null
export function allPrograms(): Program[] {
  cache ??= loadPrograms(findContentDir()).programs
  return cache
}

export function programById(id: string): Program | undefined {
  return allPrograms().find((p) => p.id === id)
}

const SUBJECT_ORDER = ['math', 'english', 'science'] as const

function card(p: Program): ProgramCardDTO {
  return {
    id: p.id,
    title: p.title,
    subject: p.subject,
    grade: p.grade,
    summary: p.summary,
    competitions: p.competitions.map((c) => c.toUpperCase()),
    phases: p.phases.map((ph) => ({ name: ph.name, weeks: ph.weeks[0] === ph.weeks[1] ? `Minggu ${ph.weeks[0]}` : `Minggu ${ph.weeks[0]} dan ${ph.weeks[1]}`, focus: ph.focus, summary: ph.summary })),
    simulationNote: `Sabtu di minggu ${p.simulation.weeks.join(' dan ')} memakai paper penuh ${p.simulation.minMinutes} sampai ${p.simulation.maxMinutes} menit bila ada di pustaka. Hari terakhir (${p.taper.days} hari) hanya teka-teki ringan.`,
  }
}

async function todayQuestsCreated(tx: Tx, learnerId: string, today: IsoDate): Promise<boolean> {
  const rows = await tx.select({ id: quest.id }).from(quest).where(and(eq(quest.learnerId, learnerId), eq(quest.date, today), eq(quest.kind, 'daily'))).limit(1)
  return rows.length > 0
}

export async function programsDTO(actor: Actor, learnerParam: string | null): Promise<ProgramsDTO> {
  const today = jakartaDate()
  return inOrg(orgCtx(actor), async (tx) => {
    const { shell, learner } = await shellIn(tx, actor, learnerParam)
    const runs = learner
      ? await tx.select().from(programRun).where(eq(programRun.learnerId, learner.id)).orderBy(desc(programRun.createdAt)).limit(20)
      : []
    const runDtos: ProgramRunDTO[] = runs.map((r) => ({
      id: r.id,
      programId: r.programId,
      title: programById(r.programId)?.title ?? r.programId,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      slots: r.slotIds.length,
    }))
    return {
      shell,
      learner: learner ? { id: learner.id, name: learner.name, grade: learner.grade } : null,
      programs: allPrograms()
        .filter((p) => !learner || p.grade === learner.grade)
        .sort((a, b) => SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject))
        .map(card),
      runs: runDtos,
      minStart: firstPlannableDate(today, learner ? await todayQuestsCreated(tx, learner.id, today) : false),
    }
  })
}

export type StartProgramInput = { learnerId: string; programId: string; startDate: IsoDate }

/**
 * Slot yang ditulis program, dalam model sesi harian: Latihan dan Tes wajib (session latihan dan tes, skill dari program)
 * menggantikan sesi dasar mapel itu di hari tersebut, dan Sabtu simulasi menambah Paper penuh wajib untuk mapel program
 * (waktu mengikuti rentang simulasi program). `mode` tetap latihan atau tes (paper memakai tes, berwaktu).
 */
export type ProgramPlanSlot = {
  date: IsoDate
  subject: Program['subject']
  session: 'latihan' | 'tes' | 'paper'
  mode: 'latihan' | 'tes'
  skillId: string | null
  questionCount: number
  paperKind: 'full' | null
}

/** Jumlah slot dan ringkasan, tanpa menulis apa pun; dipakai tes dan pratinjau. `taken` berisi tanggal:mapel:sesi slot wajib tutor. */
export function planProgramSlots(
  program: Program,
  startDate: IsoDate,
  isRest: (date: IsoDate) => boolean,
  taken: ReadonlySet<string>,
): { slots: ProgramPlanSlot[]; restDaysSkipped: number; conflictsSkipped: number; simulations: number } {
  const slots: ProgramPlanSlot[] = []
  let restDaysSkipped = 0
  let conflictsSkipped = 0
  for (const day of expandProgram(program, startDate)) {
    if (isRest(day.date)) {
      restDaysSkipped++
      continue
    }
    for (const s of day.slots) {
      if (taken.has(`${day.date}:${s.subject}:${s.mode}`)) {
        conflictsSkipped++
        continue
      }
      slots.push({ date: day.date, subject: s.subject, session: s.mode, mode: s.mode, skillId: s.skillId, questionCount: s.questionCount, paperKind: null })
    }
    if (day.kind === 'simulation') {
      if (taken.has(`${day.date}:${program.subject}:paper`)) conflictsSkipped++
      else slots.push({ date: day.date, subject: program.subject, session: 'paper', mode: 'tes', skillId: null, questionCount: 10, paperKind: 'full' })
    }
  }
  const simulations = expandProgram(program, startDate).filter((d) => d.kind === 'simulation' && !isRest(d.date)).length
  return { slots, restDaysSkipped, conflictsSkipped, simulations }
}

export async function startProgramTx(tx: Tx, ctx: OrgContext, input: StartProgramInput): Promise<ProgramStartResult> {
  const program = programById(input.programId)
  if (!program) throw notFound('Program itu tidak ada. Muat ulang halaman program.')
  const today = jakartaDate()
  const [learner] = await tx
    .select({ id: learnerProfile.userId, name: learnerProfile.name, grade: learnerProfile.grade, restWeekdays: learnerProfile.restWeekdays })
    .from(learnerProfile)
    .where(and(eq(learnerProfile.userId, input.learnerId), isNull(learnerProfile.deletedAt)))
    .limit(1)
  if (!learner) throw notFound('Learner tidak ditemukan. Muat ulang halaman program lalu pilih learner lagi.')
  if (learner.grade !== program.grade) throw invalid(`Program ini untuk Grade ${program.grade}, sedangkan ${learner.name} Grade ${learner.grade}.`)
  if (input.startDate < today) throw invalid(`${dayLabelId(input.startDate)} sudah lewat. Pilih hari ini atau hari berikutnya.`, { startDate: 'Pilih tanggal yang belum lewat.' })
  if (input.startDate > addDays(today, MAX_AHEAD_DAYS)) throw invalid('Program paling jauh dimulai satu tahun ke depan.', { startDate: 'Pilih tanggal yang lebih dekat.' })
  if (input.startDate === today && (await todayQuestsCreated(tx, learner.id, today))) {
    throw conflict(`Quest hari ini sudah dibuat di tablet ${learner.name}. Mulai program besok atau hari berikutnya.`)
  }
  const [running] = await tx
    .select({ id: programRun.id })
    .from(programRun)
    .where(and(eq(programRun.learnerId, learner.id), eq(programRun.programId, program.id), eq(programRun.status, 'active')))
    .limit(1)
  if (running) throw conflict('Program ini sudah berjalan untuk learner ini. Batalkan yang lama dulu kalau ingin memulai ulang dari tanggal lain.')

  const endDate = addDays(input.startDate, PROGRAM_DAYS - 1)
  const overrides = new Map(
    (await tx.select({ date: restDay.date, rest: restDay.rest }).from(restDay).where(and(eq(restDay.learnerId, learner.id), gte(restDay.date, input.startDate), lte(restDay.date, endDate)))).map((r) => [r.date, r.rest]),
  )
  const existing = await tx
    .select({ date: planSlot.date, subject: planSlot.subject, session: planSlot.session, required: planSlot.required, kind: planSlot.kind })
    .from(planSlot)
    .where(and(eq(planSlot.learnerId, learner.id), gte(planSlot.date, input.startDate), lte(planSlot.date, endDate)))
  // Hanya sesi wajib tutor yang bentrok: sesi opsional berdiri sendiri di bagian Extra today.
  const taken = new Set(existing.filter((e) => e.required && e.kind === 'quest').map((e) => `${e.date}:${e.subject}:${e.session}`))
  const plan = planProgramSlots(program, input.startDate, (d) => isRestDate(d, learner.restWeekdays, overrides), taken)
  if (plan.slots.length === 0) throw conflict('Semua hari program ini bentrok dengan hari istirahat atau slot yang sudah ada. Pilih tanggal mulai lain.')

  // Minggu yang dipakai: dibuat bila belum ada (langsung terbit), yang sudah ada dibiarkan.
  const mondays = [...new Set(plan.slots.map((s) => weekStart(s.date)))]
  await tx
    .insert(planWeek)
    .values(mondays.map((weekStartDate) => ({ orgId: ctx.orgId, learnerId: learner.id, weekStart: weekStartDate, status: 'published' as const, publishedAt: new Date(), createdBy: ctx.userId })))
    .onConflictDoNothing()
  const weeks = await tx
    .select({ id: planWeek.id, weekStart: planWeek.weekStart, status: planWeek.status })
    .from(planWeek)
    .where(and(eq(planWeek.learnerId, learner.id), inArray(planWeek.weekStart, mondays)))
  const weekId = new Map(weeks.map((w) => [w.weekStart, w.id]))
  const inserted = await tx
    .insert(planSlot)
    .values(
      plan.slots.map((s) => ({
        orgId: ctx.orgId,
        planWeekId: weekId.get(weekStart(s.date))!,
        learnerId: learner.id,
        date: s.date,
        subject: s.subject,
        kind: 'quest' as const,
        session: s.session,
        required: true,
        paperKind: s.paperKind,
        skillId: s.skillId,
        paperId: null,
        mode: s.mode,
        questionCount: s.questionCount,
      })),
    )
    .returning({ id: planSlot.id })
  const [run] = await tx
    .insert(programRun)
    .values({ orgId: ctx.orgId, learnerId: learner.id, programId: program.id, startDate: input.startDate, endDate, slotIds: inserted.map((r) => r.id), createdBy: ctx.userId })
    .returning({ id: programRun.id })
  await auditTx(tx, ctx, 'program.started', run!.id, { programId: program.id, learnerId: learner.id, startDate: input.startDate, slots: inserted.length })
  return {
    runId: run!.id,
    slots: inserted.length,
    restDaysSkipped: plan.restDaysSkipped,
    conflictsSkipped: plan.conflictsSkipped,
    simulations: plan.simulations,
    draftWeeks: weeks.filter((w) => w.status === 'draft').length,
  }
}

/** Batalkan program: slot yang dibuatnya mulai hari ini ke depan dihapus; yang sudah lewat tetap sebagai riwayat. */
export async function cancelProgramTx(tx: Tx, ctx: OrgContext, runId: string): Promise<{ removed: number }> {
  const [run] = await tx.select().from(programRun).where(eq(programRun.id, runId)).limit(1).for('update')
  if (!run) throw notFound('Program itu tidak ditemukan. Muat ulang halaman program.')
  if (run.status === 'cancelled') throw conflict('Program ini sudah dibatalkan.')
  const today = jakartaDate()
  const removed =
    run.slotIds.length === 0
      ? []
      : await tx
          .delete(planSlot)
          .where(and(inArray(planSlot.id, run.slotIds), gte(planSlot.date, today)))
          .returning({ id: planSlot.id })
  await tx.update(programRun).set({ status: 'cancelled' }).where(eq(programRun.id, run.id))
  await auditTx(tx, ctx, 'program.cancelled', run.id, { removed: removed.length })
  return { removed: removed.length }
}
