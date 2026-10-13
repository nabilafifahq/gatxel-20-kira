import 'server-only'
import { and, asc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm'
import {
  DEFAULT_REQUIRED_SESSIONS,
  addDays,
  computeGate,
  difficultyToB,
  formatDateId,
  initialTheta,
  jakartaDate,
  jakartaMidnight,
  outcomeScore,
  pushRecent,
  updateTheta,
  weekday,
  weekStart as mondayOf,
  type Gate,
  type IsoDate,
} from '@kira/core'
import { tables } from '@kira/db'
import type { Subject, WeekSummaryDTO } from '@/lib/dto'
import type { Tx } from '../db'
import { SUBJECT_ORDER } from './console-common'
import { gradeOfSkill, skill, subjectOfSkill } from './content'
import { loadLearner, type LearnerRow } from './learner-core'

/**
 * Ringkasan satu minggu belajar (Senin sampai Minggu, WIB) untuk laporan konsol (T09),
 * halaman keluarga (G01), dan email laporan mingguan (endpoint internal worker).
 *
 * Aturan skill (diputuskan di sini, diuji di test/week-summary.test.ts):
 * - Dihitung hanya skill yang dilatih minggu ini: ada jawaban percobaan pertama yang sudah dinilai
 *   (benar atau salah) di rentang minggu itu.
 * - Bintang awal dan akhir minggu dihitung ulang dari semua jawaban percobaan pertama skill itu
 *   lewat aturan mesin belajar yang sama (initialTheta, updateTheta, pushRecent, computeGate).
 *   Jadi minggu yang sudah lewat tetap memakai bintang pada minggu itu, bukan bintang hari ini.
 * - Perlu diulang: akurasi percobaan pertama minggu ini di bawah 70% dari paling sedikit 3 jawaban,
 *   atau gerbang di akhir minggu `reteach` (1 bintang). Catatan selalu memuat angkanya.
 * - Naik minggu ini: tidak termasuk Perlu diulang, bintang akhir minggu paling sedikit 2, dan
 *   bintangnya naik selama minggu itu, atau minggu itu kuat (paling sedikit 5 jawaban dengan
 *   akurasi percobaan pertama 80% atau lebih).
 * - Masing-masing paling banyak 5 skill supaya email tetap singkat.
 */

const { dayRecord, restDay, response, weekReport, competitionEvent } = tables

export const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as const

export const UP_MIN_STARS = 2
export const STRONG_WEEK_MIN_ANSWERS = 5
export const STRONG_WEEK_ACCURACY = 0.8
export const REPEAT_MIN_ANSWERS = 3
export const REPEAT_ACCURACY = 0.7
export const MAX_SKILLS_LISTED = 5
/** Sesi wajib per hari belajar bila hari itu belum punya day_record (Latihan, Tes, dan Paper untuk tiga mapel). */
export const DEFAULT_DAILY_QUESTS = DEFAULT_REQUIRED_SESSIONS

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function parts(d: IsoDate): [number, number, number] {
  return d.split('-').map(Number) as [number, number, number]
}

/** "Senin 12 sampai Minggu 18 Oktober 2026"; lintas bulan dan lintas tahun ditulis lengkap. */
export function weekRangeLabel(monday: IsoDate): string {
  const sunday = addDays(monday, 6)
  const [y1, m1, d1] = parts(monday)
  const [y2, m2] = parts(sunday)
  if (y1 !== y2) return `Senin ${formatDateId(monday)} sampai Minggu ${formatDateId(sunday)}`
  if (m1 !== m2) return `Senin ${d1} ${MONTHS[m1 - 1]} sampai Minggu ${formatDateId(sunday)}`
  return `Senin ${d1} sampai Minggu ${formatDateId(sunday)}`
}

export type DayRow = { date: IsoDate; minutes: number; questsDone: number; questsRequired: number; rest: boolean }

/** Menit per hari Senin sampai Minggu dengan label Sen sampai Min. Hari tanpa catatan bernilai 0. */
export function minutesPerDay(monday: IsoDate, rows: Pick<DayRow, 'date' | 'minutes'>[]): { label: string; minutes: number }[] {
  return DAY_LABELS.map((label, i) => {
    const date = addDays(monday, i)
    const row = rows.find((r) => r.date === date)
    return { label, minutes: Math.max(0, Math.round(row?.minutes ?? 0)) }
  })
}

/**
 * Sesi wajib yang selesai dan direncanakan sampai hari ini. Hari yang dihitung: sejak learner mulai,
 * paling lambat hari ini, bukan hari istirahat (rest_day mengalahkan hari istirahat mingguan).
 * Hari belajar tanpa day_record dihitung 9 sesi wajib.
 */
export function questTotals(input: {
  monday: IsoDate
  today: IsoDate
  startedOn: IsoDate | null
  rows: DayRow[]
  restOverrides: { date: IsoDate; rest: boolean }[]
  restWeekdays: number[]
}): { done: number; planned: number } {
  let done = 0
  let planned = 0
  for (let i = 0; i < 7; i++) {
    const date = addDays(input.monday, i)
    const row = input.rows.find((r) => r.date === date)
    done += Math.max(0, row?.questsDone ?? 0)
    if (date > input.today || input.startedOn === null || date < input.startedOn) continue
    const override = input.restOverrides.find((o) => o.date === date)
    const rest = override ? override.rest : Boolean(row?.rest) || input.restWeekdays.includes(weekday(date))
    if (rest) continue
    planned += row && row.questsRequired > 0 ? row.questsRequired : DEFAULT_DAILY_QUESTS
  }
  return { done, planned: Math.max(planned, done) }
}

export type FirstAttempt = { correct: boolean; hintsUsed: number; difficulty: number }
export type GateState = { gate: Gate; stars: number; accuracy: number | null; answers: number }

/** Putar ulang jawaban percobaan pertama satu skill (urut waktu) dengan aturan mesin belajar. */
export function replayGate(attempts: readonly FirstAttempt[], learnerGrade: number, skillGrade: number): GateState {
  let theta = initialTheta(learnerGrade, skillGrade)
  let recent: number[] = []
  let n = 0
  for (const a of attempts) {
    const s = outcomeScore({ correct: a.correct, hintsUsed: a.hintsUsed })
    theta = updateTheta(theta, n, difficultyToB(a.difficulty), s)
    recent = pushRecent(recent, s)
    n++
  }
  const g = computeGate({ nAnswers: n, recentScores: recent, theta })
  return { gate: g.gate, stars: g.stars, accuracy: g.accuracy, answers: n }
}

export type SkillWeek = {
  skillId: string
  subject: Subject
  title: string
  /** Jawaban percobaan pertama yang dinilai di minggu itu. */
  week: { right: number; total: number }
  before: GateState
  after: GateState
}

export type RepeatSkill = SkillWeek & { note: string }

function weekAccuracy(s: SkillWeek): number {
  return s.week.total > 0 ? s.week.right / s.week.total : 0
}

/** Catatan Perlu diulang, selalu dengan angka. */
export function repeatNote(s: SkillWeek): string {
  if (s.week.total >= REPEAT_MIN_ANSWERS && weekAccuracy(s) < REPEAT_ACCURACY) return `${s.week.right} dari ${s.week.total} benar minggu ini`
  const window = Math.min(s.after.answers, 20)
  const pct = Math.round((s.after.accuracy ?? 0) * 100)
  return `${pct}% benar di ${window} soal terakhir`
}

function subjectRank(s: Subject): number {
  return SUBJECT_ORDER.indexOf(s)
}

function needsRepeat(s: SkillWeek): boolean {
  return (s.week.total >= REPEAT_MIN_ANSWERS && weekAccuracy(s) < REPEAT_ACCURACY) || s.after.gate === 'reteach'
}

/** Pisahkan skill minggu ini menjadi Naik dan Perlu diulang (aturan di komentar modul). */
export function classifySkills(skills: readonly SkillWeek[]): { up: SkillWeek[]; repeat: RepeatSkill[] } {
  const practiced = skills.filter((s) => s.week.total > 0)
  const repeat: RepeatSkill[] = practiced
    .filter(needsRepeat)
    .map((s) => ({ ...s, note: repeatNote(s) }))
    .sort((a, b) => weekAccuracy(a) - weekAccuracy(b) || subjectRank(a.subject) - subjectRank(b.subject) || a.title.localeCompare(b.title))
    .slice(0, MAX_SKILLS_LISTED)
  const up = practiced
    .filter((s) => !needsRepeat(s) && s.after.stars >= UP_MIN_STARS)
    .filter((s) => s.after.stars > s.before.stars || (s.week.total >= STRONG_WEEK_MIN_ANSWERS && weekAccuracy(s) >= STRONG_WEEK_ACCURACY))
    .sort((a, b) => b.after.stars - a.after.stars || subjectRank(a.subject) - subjectRank(b.subject) || a.title.localeCompare(b.title))
    .slice(0, MAX_SKILLS_LISTED)
  return { up, repeat }
}

export type CompetitionCandidate = { name: string; date: IsoDate | null; dateIsEstimate: boolean; status: string; learnerIds: string[] }

/**
 * Lomba berikutnya untuk learner ini: tanggal pasti hari ini atau sesudahnya, tidak berstatus
 * Tidak ikut atau Selesai, dan learner ikut (daftar learner kosong berarti semua learner).
 * Tanggal perkiraan tidak ditampilkan ke orang tua, sama dengan hitung mundur di layar learner.
 */
export function pickNextCompetition(rows: readonly CompetitionCandidate[], learnerId: string, today: IsoDate): { name: string; date: IsoDate } | null {
  const hit = rows
    .filter((r) => r.date !== null && r.date >= today && !r.dateIsEstimate && r.status !== 'skip' && r.status !== 'done')
    .filter((r) => r.learnerIds.length === 0 || r.learnerIds.includes(learnerId))
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0))[0]
  return hit ? { name: hit.name, date: hit.date! } : null
}

/** Judul skill untuk orang tua (bahasa Indonesia bila ada). */
export function skillTitleForFamily(skillId: string): string {
  const s = skill(skillId)
  return s?.titleId ?? s?.title ?? skillId
}

export type WeekSummaryData = {
  dto: WeekSummaryDTO
  monday: IsoDate
  learner: LearnerRow
  skills: SkillWeek[]
  up: SkillWeek[]
  repeat: RepeatSkill[]
}

/**
 * Bangun ringkasan minggu dari database. `weekStart` boleh tanggal mana pun di minggu itu.
 * `note` mengganti catatan tutor (dipakai saat mengirim laporan); tanpa `note` dibaca dari week_report.
 */
export async function weekSummaryData(tx: Tx, learnerId: string, weekStart: IsoDate, opts: { note?: string | null; today?: IsoDate } = {}): Promise<WeekSummaryData> {
  const learner = await loadLearner(tx, learnerId)
  const today = opts.today ?? jakartaDate()
  const monday = mondayOf(weekStart)
  const sunday = addDays(monday, 6)
  const startAt = jakartaMidnight(monday)
  const endAt = jakartaMidnight(addDays(monday, 7))

  const days = await tx
    .select({ date: dayRecord.date, minutes: dayRecord.minutes, questsDone: dayRecord.questsDone, questsRequired: dayRecord.questsRequired, rest: dayRecord.rest })
    .from(dayRecord)
    .where(and(eq(dayRecord.learnerId, learnerId), gte(dayRecord.date, monday), lte(dayRecord.date, sunday)))
  const overrides = await tx
    .select({ date: restDay.date, rest: restDay.rest })
    .from(restDay)
    .where(and(eq(restDay.learnerId, learnerId), gte(restDay.date, monday), lte(restDay.date, sunday)))

  const perDay = minutesPerDay(monday, days)
  const quests = questTotals({ monday, today, startedOn: learner.startedOn, rows: days, restOverrides: overrides, restWeekdays: learner.restWeekdays })

  // Jawaban percobaan pertama yang dinilai, per skill, di minggu ini.
  const weekRows = await tx
    .select({
      skillId: response.skillId,
      right: sql<number>`count(*) filter (where ${response.status} = 'correct')::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(response)
    .where(
      and(
        eq(response.learnerId, learnerId),
        eq(response.attemptNo, 1),
        eq(response.retry, false),
        inArray(response.status, ['correct', 'wrong']),
        gte(response.answeredAt, startAt),
        lt(response.answeredAt, endAt),
      ),
    )
    .groupBy(response.skillId)

  const skills: SkillWeek[] = []
  if (weekRows.length > 0) {
    const ids = weekRows.map((r) => r.skillId)
    const history = await tx
      .select({ skillId: response.skillId, at: response.answeredAt, status: response.status, hintsUsed: response.hintsUsed, difficulty: response.difficulty })
      .from(response)
      .where(and(eq(response.learnerId, learnerId), eq(response.attemptNo, 1), eq(response.retry, false), inArray(response.status, ['correct', 'wrong']), inArray(response.skillId, ids), lt(response.answeredAt, endAt)))
      .orderBy(asc(response.answeredAt), asc(response.position))
    for (const w of weekRows) {
      const all = history.filter((h) => h.skillId === w.skillId)
      const toAttempt = (h: (typeof all)[number]): FirstAttempt => ({ correct: h.status === 'correct', hintsUsed: h.hintsUsed, difficulty: h.difficulty })
      const before = all.filter((h) => h.at.getTime() < startAt.getTime()).map(toAttempt)
      const grade = gradeOfSkill(w.skillId)
      skills.push({
        skillId: w.skillId,
        subject: subjectOfSkill(w.skillId),
        title: skillTitleForFamily(w.skillId),
        week: { right: w.right, total: w.total },
        before: replayGate(before, learner.grade, grade),
        after: replayGate(all.map(toAttempt), learner.grade, grade),
      })
    }
  }
  const { up, repeat } = classifySkills(skills)

  let tutorNote: string | null
  if (opts.note !== undefined) tutorNote = opts.note && opts.note.trim() ? opts.note.trim() : null
  else {
    const [rep] = await tx
      .select({ note: weekReport.note })
      .from(weekReport)
      .where(and(eq(weekReport.learnerId, learnerId), eq(weekReport.weekStart, monday)))
      .limit(1)
    tutorNote = rep?.note?.trim() ? rep.note.trim() : null
  }

  const events = await tx
    .select({ name: competitionEvent.name, date: competitionEvent.date, dateIsEstimate: competitionEvent.dateIsEstimate, status: competitionEvent.status, learnerIds: competitionEvent.learnerIds })
    .from(competitionEvent)
    .where(gte(competitionEvent.date, today))

  const dto: WeekSummaryDTO = {
    learnerName: learner.name,
    weekLabel: weekRangeLabel(monday),
    firstWeek: learner.startedOn !== null && learner.startedOn >= monday && learner.startedOn <= sunday,
    minutes: perDay.reduce((a, d) => a + d.minutes, 0),
    minutesPerDay: perDay,
    questsDone: quests.done,
    questsPlanned: quests.planned,
    skillsUp: up.map((s) => ({ subject: s.subject, title: s.title, stars: s.after.stars })),
    skillsToRepeat: repeat.map((s) => ({ subject: s.subject, title: s.title, note: s.note })),
    tutorNote,
    nextCompetition: pickNextCompetition(events, learnerId, today),
  }
  return { dto, monday, learner, skills, up, repeat }
}

export async function weekSummaryDTO(tx: Tx, learnerId: string, weekStart: IsoDate, opts: { note?: string | null; today?: IsoDate } = {}): Promise<WeekSummaryDTO> {
  return (await weekSummaryData(tx, learnerId, weekStart, opts)).dto
}
