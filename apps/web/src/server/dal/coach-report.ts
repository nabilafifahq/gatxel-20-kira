import 'server-only'
import { and, asc, eq, gte, lt, ne, sql, inArray } from 'drizzle-orm'
import { jakartaDate, jakartaMidnight, type IsoDate } from '@kira/core'
import { loadCambridgeMap, type CambridgeMap } from '@kira/content/cambridge'
import { findContentDir } from '@kira/content/load'
import { tables } from '@kira/db'
import type { Subject } from '@/lib/dto'
import type { MonthlyReportDTO, ReportCoverageDTO, ReportPageDTO, ReportSubjectDTO } from '@/lib/dto-coach'
import type { Actor } from '../auth/actor'
import { withFamilyAdmin } from '../auth/parent'
import type { Tx } from '../db'
import { log } from '../log'
import { chooseChild, linkedChildren, skillSnapshots } from './coach'
import { selectWeak } from './coach-logic'
import { SUBJECT_ID_LABEL, SUBJECT_ORDER } from './console-common'
import { skill } from './content'
import { loadLearner } from './learner-core'
import { replayGate, type FirstAttempt, type GateState } from './week-summary'

/**
 * Rapor bulanan untuk orang tua: waktu belajar, sesi, perubahan bintang per mapel, dan cakupan terhadap tujuan belajar
 * pada kerangka Cambridge Primary. Semua dihitung dari data nyata (day_record, attempt, response) dengan aturan
 * mesin belajar yang sama dengan ringkasan mingguan. Tanpa AI dan tanpa klaim resmi.
 */

const { dayRecord, attempt, response } = tables

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const FRAMEWORK_CODE: Record<Subject, string> = { math: '0096', english: '0058', science: '0097' }

export const COVERAGE_NOTE =
  'Cakupan ini mengacu pada kerangka Cambridge Primary (Math 0096, English 0058, Science 0097). Kira memetakan tiap skill ke tujuan belajar di kerangka itu, lalu menghitung mana yang sudah dilatih anak. Ini bukan penilaian resmi dan bukan sertifikat. "Kuat" berarti anak sudah mencapai sedikitnya 2 bintang pada skill yang dipetakan langsung ke tujuan itu. Tujuan tanpa skill di Kira ditulis apa adanya sebagai "belum ada latihannya".'

export function isMonth(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return `${MONTHS[m - 1]} ${y}`
}

export function monthRange(month: string): { start: IsoDate; endExclusive: IsoDate; days: number } {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const start = `${month}-01` as IsoDate
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  const endExclusive = `${ny}-${String(nm).padStart(2, '0')}-01` as IsoDate
  const days = Math.round((Date.parse(`${endExclusive}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000)
  return { start, endExclusive, days }
}

/** Enam bulan terakhir sampai bulan ini, terbaru dulu. */
export function recentMonths(today: IsoDate, n = 6): { value: string; label: string }[] {
  let y = Number(today.slice(0, 4))
  let m = Number(today.slice(5, 7))
  const out: { value: string; label: string }[] = []
  for (let i = 0; i < n; i++) {
    const value = `${y}-${String(m).padStart(2, '0')}`
    out.push({ value, label: monthLabel(value) })
    m -= 1
    if (m === 0) {
      m = 12
      y -= 1
    }
  }
  return out
}

let cachedMap: CambridgeMap | null | undefined
function cambridgeMap(): CambridgeMap | null {
  if (cachedMap !== undefined) return cachedMap
  const { map, errors } = loadCambridgeMap(findContentDir())
  if (errors.length) log.error('pemetaan Cambridge tidak bisa dibaca untuk rapor', { first: errors[0] })
  cachedMap = map
  return map
}

type HistRow = { skillId: string; at: Date; correct: boolean; hintsUsed: number; difficulty: number }

/** Bintang awal dan akhir bulan dari semua jawaban percobaan pertama, dengan aturan mesin belajar. */
export function replayMonth(history: readonly HistRow[], startAt: Date, learnerGrade: number, gradeOf: (skillId: string) => number): Map<string, { before: GateState; after: GateState; monthTotal: number; monthRight: number }> {
  const bySkill = new Map<string, HistRow[]>()
  for (const h of history) {
    const list = bySkill.get(h.skillId) ?? []
    list.push(h)
    bySkill.set(h.skillId, list)
  }
  const out = new Map<string, { before: GateState; after: GateState; monthTotal: number; monthRight: number }>()
  for (const [skillId, rows] of bySkill) {
    const toAttempt = (h: HistRow): FirstAttempt => ({ correct: h.correct, hintsUsed: h.hintsUsed, difficulty: h.difficulty })
    const before = rows.filter((r) => r.at.getTime() < startAt.getTime())
    const inMonth = rows.filter((r) => r.at.getTime() >= startAt.getTime())
    out.set(skillId, {
      before: replayGate(before.map(toAttempt), learnerGrade, gradeOf(skillId)),
      after: replayGate(rows.map(toAttempt), learnerGrade, gradeOf(skillId)),
      monthTotal: inMonth.length,
      monthRight: inMonth.filter((r) => r.correct).length,
    })
  }
  return out
}

export function coverageFor(
  map: CambridgeMap,
  subject: Subject,
  stage: number,
  states: ReadonlyMap<string, { stars: number; answers: number }>,
  subjectOf: (skillId: string) => Subject | undefined,
): ReportCoverageDTO {
  const codes = map.objectives[subject]?.[String(stage)] ?? []
  const direct = new Map<string, string[]>()
  const any = new Map<string, string[]>()
  for (const [id, m] of Object.entries(map.skills)) {
    if (subjectOf(id) !== subject) continue
    for (const c of m.direct) {
      direct.set(c, [...(direct.get(c) ?? []), id])
      any.set(c, [...(any.get(c) ?? []), id])
    }
    for (const c of m.partial) any.set(c, [...(any.get(c) ?? []), id])
  }
  let strong = 0
  let inProgress = 0
  let notYet = 0
  let noSkill = 0
  for (const code of codes) {
    const mapped = any.get(code) ?? []
    if (mapped.length === 0) {
      noSkill++
      continue
    }
    const isStrong = (direct.get(code) ?? []).some((id) => (states.get(id)?.stars ?? 0) >= 2)
    if (isStrong) strong++
    else if (mapped.some((id) => (states.get(id)?.answers ?? 0) > 0)) inProgress++
    else notYet++
  }
  return {
    subject,
    label: SUBJECT_ID_LABEL[subject],
    frameworkTitle: `Cambridge Primary ${SUBJECT_ID_LABEL[subject]} (${FRAMEWORK_CODE[subject]})`,
    stage,
    total: codes.length,
    strong,
    inProgress,
    notYet,
    noSkill,
  }
}

export function nextMonthAdvice(input: {
  name: string
  activeDays: number
  minutes: number
  weakTitles: { title: string; subject: Subject }[]
  coverage: ReportCoverageDTO[]
  hasData: boolean
}): string[] {
  if (!input.hasData) {
    return [
      `Mulai dari yang kecil: ajak ${input.name} belajar 10 menit sehari, 4 hari dalam seminggu. Kebiasaan kecil lebih berguna daripada satu sesi panjang.`,
      'Buka Pelatih mingguan untuk satu kegiatan rumah yang ringan, dan cetak satu lembar kerja bila anak suka menulis di kertas.',
    ]
  }
  const out: string[] = []
  const perDay = input.activeDays > 0 ? Math.round(input.minutes / input.activeDays) : 0
  if (input.activeDays < 12) {
    out.push(`Bulan ini ${input.name} belajar di ${input.activeDays} hari. Coba targetkan 4 hari dalam seminggu, sekitar ${Math.max(10, Math.min(perDay || 15, 25))} menit per hari. Jadwal yang sama tiap hari membantu.`)
  } else {
    out.push(`${input.name} belajar di ${input.activeDays} hari bulan ini, rata-rata ${perDay} menit per hari. Pertahankan ritmenya dan beri hari istirahat kalau lelah.`)
  }
  for (const w of input.weakTitles.slice(0, 2)) {
    out.push(`Beri perhatian pada ${w.title} (${SUBJECT_ID_LABEL[w.subject]}). Pakai kegiatan 10 menit dari Pelatih mingguan dan cetak satu lembar kerja untuk skill ini.`)
  }
  const withData = input.coverage.filter((c) => c.total > 0)
  const lowest = [...withData].sort((a, b) => a.strong / a.total - b.strong / b.total)[0]
  if (lowest && lowest.strong < lowest.total) {
    out.push(`Cakupan ${lowest.label} tahap ${lowest.stage} masih paling sedikit: ${lowest.strong} dari ${lowest.total} tujuan sudah kuat. Selipkan satu sesi ${lowest.label} di tiap minggu.`)
  }
  return out
}

export async function monthlyReportFor(tx: Tx, learnerId: string, month: string, today: IsoDate = jakartaDate()): Promise<MonthlyReportDTO> {
  const learner = await loadLearner(tx, learnerId)
  const { start, endExclusive, days } = monthRange(month)
  const startAt = jakartaMidnight(start)
  const endAt = jakartaMidnight(endExclusive)

  const dayRows = await tx
    .select({ minutes: dayRecord.minutes })
    .from(dayRecord)
    .where(and(eq(dayRecord.learnerId, learnerId), gte(dayRecord.date, start), lt(dayRecord.date, endExclusive)))
  const minutes = dayRows.reduce((a, r) => a + Math.max(0, Math.round(r.minutes)), 0)
  const activeDays = dayRows.filter((r) => r.minutes > 0).length

  const sessionRows = await tx
    .select({ subject: attempt.subject, n: sql<number>`count(*)::int` })
    .from(attempt)
    .where(and(eq(attempt.learnerId, learnerId), ne(attempt.status, 'in_progress'), gte(attempt.submittedAt, startAt), lt(attempt.submittedAt, endAt)))
    .groupBy(attempt.subject)
  const sessionsBySubject = new Map(sessionRows.map((r) => [r.subject as Subject, r.n]))
  const sessions = sessionRows.reduce((a, r) => a + r.n, 0)

  const hist = await tx
    .select({ skillId: response.skillId, at: response.answeredAt, status: response.status, hintsUsed: response.hintsUsed, difficulty: response.difficulty })
    .from(response)
    .where(and(eq(response.learnerId, learnerId), eq(response.attemptNo, 1), eq(response.retry, false), inArray(response.status, ['correct', 'wrong']), lt(response.answeredAt, endAt)))
    .orderBy(asc(response.answeredAt), asc(response.position))
  const history: HistRow[] = hist.map((h) => ({ skillId: h.skillId, at: h.at, correct: h.status === 'correct', hintsUsed: h.hintsUsed, difficulty: h.difficulty }))
  const gradeOf = (id: string) => skill(id)?.grade ?? learner.grade
  const replay = replayMonth(history.filter((h) => skill(h.skillId)), startAt, learner.grade, gradeOf)

  const subjects: ReportSubjectDTO[] = SUBJECT_ORDER.map((subject) => {
    const practiced = [...replay.entries()].filter(([id, r]) => skill(id)?.subject === subject && r.monthTotal > 0)
    const answers = practiced.reduce((a, [, r]) => a + r.monthTotal, 0)
    const right = practiced.reduce((a, [, r]) => a + r.monthRight, 0)
    const avg = (pick: (r: { before: GateState; after: GateState }) => number) =>
      practiced.length ? Math.round((practiced.reduce((a, [, r]) => a + pick(r), 0) / practiced.length) * 10) / 10 : null
    const highlights = practiced
      .map(([id, r]) => ({ title: skill(id)?.titleId || skill(id)?.title || id, from: r.before.stars, to: r.after.stars }))
      .filter((h) => h.to > h.from)
      .sort((a, b) => b.to - b.from - (a.to - a.from) || a.title.localeCompare(b.title))
      .slice(0, 3)
    return {
      subject,
      label: SUBJECT_ID_LABEL[subject],
      answers,
      accuracyPct: answers > 0 ? Math.round((100 * right) / answers) : null,
      skillsPracticed: practiced.length,
      starsUp: practiced.filter(([, r]) => r.after.stars > r.before.stars).length,
      newlyMastered: practiced.filter(([, r]) => r.after.gate === 'mastered' && r.before.gate !== 'mastered').length,
      starsBefore: avg((r) => r.before.stars),
      starsAfter: avg((r) => r.after.stars),
      sessions: sessionsBySubject.get(subject) ?? 0,
      highlights,
    }
  })

  const states = new Map<string, { stars: number; answers: number }>()
  for (const [id, r] of replay) states.set(id, { stars: r.after.stars, answers: r.after.answers })
  const map = cambridgeMap()
  const coverage = map ? SUBJECT_ORDER.map((s) => coverageFor(map, s, learner.grade, states, (id) => skill(id)?.subject)) : []

  const hasData = minutes > 0 || sessions > 0 || subjects.some((s) => s.answers > 0)
  const weak = selectWeak(await skillSnapshots(tx, learnerId)).map((w) => ({ title: w.title, subject: w.subject }))

  return {
    learnerId,
    name: learner.name,
    grade: learner.grade,
    month,
    monthLabel: monthLabel(month),
    months: recentMonths(today),
    minutes,
    activeDays,
    daysInMonth: days,
    sessions,
    subjects,
    coverage,
    coverageNote: COVERAGE_NOTE,
    next: nextMonthAdvice({ name: learner.name, activeDays, minutes, weakTitles: weak, coverage, hasData }),
    hasData,
    emptyNote: `Belum ada kegiatan belajar ${learner.name} di ${monthLabel(month)}. Rapor akan terisi setelah ia belajar. Sambil menunggu, pilih bulan lain di atas atau buka Pelatih untuk kegiatan 10 menit di rumah.`,
  }
}

export async function parentReportDTO(actor: Actor, learnerParam: string | null, monthParam: string | null, today: IsoDate = jakartaDate()): Promise<ReportPageDTO> {
  const month = monthParam && isMonth(monthParam) ? monthParam : today.slice(0, 7)
  return withFamilyAdmin(actor, async (tx, scope) => {
    const children = await linkedChildren(tx)
    const child = chooseChild(children, learnerParam)
    if (!child) return { children, selectedId: null, report: null }
    await scope.assertParentOf(child.id)
    return { children, selectedId: child.id, report: await monthlyReportFor(tx, child.id, month, today) }
  })
}

