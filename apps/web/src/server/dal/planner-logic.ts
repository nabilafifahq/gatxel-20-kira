import 'server-only'
import { addDays, daysBetween, estimateMinutes, weekDates, weekStart, weekdayNameId, type Gate, type IsoDate } from '@kira/core'
import type { PlannerDTO, Subject } from '@/lib/dto'
import { daysLeftLabel, shortDateId, SUBJECT_ORDER, weekLabelId } from './console-common'

/**
 * Logika murni perencana mingguan (T03): rentang minggu, label hari, menit per hari,
 * hari istirahat, dan usulan slot. Tidak menyentuh database; DAL `console-planner.ts`
 * menyiapkan data lalu memanggil fungsi di sini, dan tes unit memanggilnya langsung.
 */

export type PlanMode = 'belajar' | 'latihan' | 'tes' | 'kertas'

/** Usulan hanya memakai lomba dalam jarak ini. */
export const COMPETITION_HORIZON_DAYS = 45
/** Skill review dianggap perlu diulang setelah tidak dilatih selama ini. */
export const REVIEW_STALE_DAYS = 7
export const QUESTION_COUNT_MIN = 4
export const QUESTION_COUNT_MAX = 30

// ---------------------------------------------------------------------------
// Minggu dan hari

/** Senin dari tanggal apa pun; tanpa parameter memakai minggu ini. */
export function normaliseWeek(param: IsoDate | null, today: IsoDate): IsoDate {
  return weekStart(param ?? today)
}

/** "Senin 19 Okt" */
export function dayLabelId(date: IsoDate): string {
  return `${weekdayNameId(date)} ${shortDateId(date)}`
}

/** "Senin 19 sampai Minggu 25 Oktober 2026", lintas bulan dan tahun ditulis lengkap. */
export function weekLabelLong(monday: IsoDate): string {
  return `Senin ${weekLabelId(monday).replace(' sampai ', ' sampai Minggu ')}`
}

/** Sama dengan isRestDay di learner-core: baris rest_day menimpa hari istirahat mingguan. */
export function isRestDate(date: IsoDate, restWeekdays: readonly number[], overrides: ReadonlyMap<IsoDate, boolean>): boolean {
  const o = overrides.get(date)
  if (o !== undefined) return o
  return restWeekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay())
}

/**
 * Tanggal pertama yang masih berpengaruh: quest dibuat saat tablet membuka Today pertama kali
 * di hari itu, jadi hari ini hanya bisa diubah selama quest hari ini belum dibuat.
 */
export function firstPlannableDate(today: IsoDate, todayQuestsCreated: boolean): IsoDate {
  return todayQuestsCreated ? addDays(today, 1) : today
}

/** Jumlah soal yang dibuat Today untuk mode itu (sama dengan questLength di learner-today). */
export function defaultQuestionCount(mode: PlanMode, grade: number): number {
  if (mode === 'belajar') return 6
  return grade <= 1 ? 8 : 10
}

/** Menit slot: paper memakai menit paper, skill memakai perkiraan 1,5 menit per soal. */
export function slotMinutes(slot: { questionCount: number; paperMinutes?: number | null }): number {
  return slot.paperMinutes != null && slot.paperMinutes > 0 ? slot.paperMinutes : estimateMinutes(slot.questionCount)
}

export function plannerDays(
  week: readonly IsoDate[],
  rest: ReadonlySet<IsoDate>,
  slots: readonly { date: IsoDate; minutes: number }[],
  screenLimitMin: number,
): PlannerDTO['days'] {
  return week.map((date) => {
    const isRest = rest.has(date)
    const total = isRest ? 0 : slots.filter((s) => s.date === date).reduce((a, s) => a + s.minutes, 0)
    return { date, label: dayLabelId(date), rest: isRest, totalMinutes: total, overLimit: !isRest && total > screenLimitMin }
  })
}

export function weekOf(monday: IsoDate): IsoDate[] {
  return weekDates(monday)
}

// ---------------------------------------------------------------------------
// Usulan

export type SkillMeta = {
  id: string
  subject: Subject
  grade: number
  title: string
  order: number
  strand: string
  prerequisites: readonly string[]
  competitions: readonly string[]
  hasLesson: boolean
}

export type SkillStateLite = {
  gate: Gate
  stars: number
  recent: readonly number[]
  nAnswers: number
  lastPracticed: IsoDate | null
}

export type UpcomingCompetition = { name: string; date: IsoDate; competitionId: string | null; subjects: readonly string[] }

export type ExistingSlot = { date: IsoDate; subject: Subject; kind: 'quest' | 'bonus'; skillId: string | null; minutes: number }

export type SuggestInput = {
  today: IsoDate
  /** Lihat firstPlannableDate. */
  firstPlannable: IsoDate
  days: readonly { date: IsoDate; rest: boolean }[]
  learnerGrade: number
  screenLimitMin: number
  /** Skill di grade learner (semua mapel), dipakai untuk skill baru berikutnya dan persiapan lomba. */
  curriculum: readonly SkillMeta[]
  /** Semua skill yang dikenal, untuk skill_state dari grade lain dan prasyarat lintas grade. */
  skills: ReadonlyMap<string, SkillMeta>
  states: ReadonlyMap<string, SkillStateLite>
  slots: readonly ExistingSlot[]
  competitions: readonly UpcomingCompetition[]
}

export type SuggestionKind = 'reteach' | 'review' | 'new' | 'competition'

export type Suggestion = {
  id: string
  date: IsoDate
  subject: Subject
  skillId: string
  title: string
  reason: string
  kind: SuggestionKind
  mode: PlanMode
  questionCount: number
}

type Candidate = { skill: SkillMeta; kind: SuggestionKind; reason: string }

const OLYMPIAD_STRAND = 'Oly'

/** Rata-rata skor jendela gerbang (benar dengan hint dihitung 0,6), dalam persen. */
export function recentPct(recent: readonly number[]): number | null {
  if (recent.length === 0) return null
  return Math.round((100 * recent.reduce((a, b) => a + b, 0)) / recent.length)
}

function competitionsFor(subject: Subject, input: SuggestInput): UpcomingCompetition[] {
  return input.competitions
    .filter((c) => c.date >= input.today && daysBetween(input.today, c.date) <= COMPETITION_HORIZON_DAYS)
    .filter((c) => c.subjects.length === 0 || c.subjects.includes(subject))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function compNote(c: UpcomingCompetition | undefined, today: IsoDate): string | null {
  return c ? `Masuk materi ${c.name}, ${daysLeftLabel(daysBetween(today, c.date))}.` : null
}

/** Prasyarat terpenuhi: di grade learner harus review atau dikuasai; dari grade lain cukup tidak sedang ajar ulang. */
function prerequisitesMet(skill: SkillMeta, gradeIds: ReadonlySet<string>, states: ReadonlyMap<string, SkillStateLite>): boolean {
  return skill.prerequisites.every((p) => {
    const gate = states.get(p)?.gate
    if (gradeIds.has(p)) return gate === 'review' || gate === 'mastered'
    return gate !== 'reteach'
  })
}

function newSkillReason(skill: SkillMeta, input: SuggestInput): string {
  const st = input.states.get(skill.id)
  if (st && st.nAnswers > 0) return `Baru ${st.nAnswers} soal dikerjakan. Status skill muncul setelah 10 soal.`
  const pres = skill.prerequisites.map((p) => input.skills.get(p)).filter((p): p is SkillMeta => Boolean(p))
  const done = pres.filter((p) => {
    const g = input.states.get(p.id)?.gate
    return g === 'review' || g === 'mastered'
  })
  const pick = [...(done.length > 0 ? done : pres)].sort((a, b) => b.grade - a.grade || b.order - a.order)[0]
  if (pick) return pick.grade === skill.grade ? `Lanjutan dari ${pick.title}.` : `Lanjutan dari ${pick.title} di Grade ${pick.grade}.`
  return `Skill berikutnya di urutan Grade ${skill.grade}.`
}

function candidatesFor(subject: Subject, input: SuggestInput, scheduled: ReadonlySet<string>): Candidate[] {
  const comps = competitionsFor(subject, input)
  const compOf = (s: SkillMeta) => comps.find((c) => c.competitionId !== null && s.competitions.includes(c.competitionId))
  const compRank = (s: SkillMeta) => {
    const c = compOf(s)
    return c ? daysBetween(input.today, c.date) : Number.POSITIVE_INFINITY
  }
  const withState = [...input.states.entries()]
    .map(([id, st]) => ({ skill: input.skills.get(id), st }))
    .filter((x): x is { skill: SkillMeta; st: SkillStateLite } => Boolean(x.skill) && x.skill!.subject === subject && !scheduled.has(x.skill!.id))

  const out: Candidate[] = []

  // 1. Ajar ulang: akurasi terendah dulu, skill untuk lomba terdekat paling depan.
  const reteach = withState
    .filter((x) => x.st.gate === 'reteach')
    .sort((a, b) => compRank(a.skill) - compRank(b.skill) || (recentPct(a.st.recent) ?? 0) - (recentPct(b.st.recent) ?? 0) || a.skill.order - b.skill.order)
  for (const x of reteach) {
    const pct = recentPct(x.st.recent) ?? 0
    const base = `Akurasi ${pct}% di ${x.st.recent.length} soal terakhir.`
    out.push({ skill: x.skill, kind: 'reteach', reason: [base, compNote(compOf(x.skill), input.today)].filter(Boolean).join(' ') })
  }

  // 2. Review yang tidak dilatih 7 hari atau lebih: yang paling lama dulu.
  const staleDays = (st: SkillStateLite) => (st.lastPracticed ? daysBetween(st.lastPracticed, input.today) : Number.POSITIVE_INFINITY)
  const review = withState
    .filter((x) => x.st.gate === 'review' && staleDays(x.st) >= REVIEW_STALE_DAYS)
    .sort((a, b) => compRank(a.skill) - compRank(b.skill) || staleDays(b.st) - staleDays(a.st) || a.skill.order - b.skill.order)
  for (const x of review) {
    const d = staleDays(x.st)
    const base = Number.isFinite(d) ? `Belum dilatih ${d} hari.` : 'Belum dilatih ulang sejak masuk review.'
    out.push({ skill: x.skill, kind: 'review', reason: [base, compNote(compOf(x.skill), input.today)].filter(Boolean).join(' ') })
  }

  // 3. Satu skill baru berikutnya di urutan kurikulum grade learner yang prasyaratnya terpenuhi.
  const gradeIds = new Set(input.curriculum.map((s) => s.id))
  const fresh = input.curriculum
    .filter((s) => s.subject === subject && s.strand !== OLYMPIAD_STRAND && !scheduled.has(s.id))
    .filter((s) => (input.states.get(s.id)?.gate ?? 'new') === 'new')
    .sort((a, b) => a.order - b.order)
    .find((s) => prerequisitesMet(s, gradeIds, input.states))
  if (fresh) out.push({ skill: fresh, kind: 'new', reason: newSkillReason(fresh, input) })

  // 4. Persiapan lomba terdekat: satu skill olimpiade grade learner yang ditandai untuk lomba itu.
  for (const c of comps) {
    if (c.competitionId === null) continue
    const tagged = input.curriculum.filter((s) => s.subject === subject && s.strand === OLYMPIAD_STRAND && s.competitions.includes(c.competitionId!))
    if (tagged.length === 0 || tagged.some((s) => scheduled.has(s.id))) continue
    const pick = tagged
      .filter((s) => input.states.get(s.id)?.gate !== 'mastered' && !out.some((o) => o.skill.id === s.id))
      .sort((a, b) => (input.states.get(a.id)?.lastPracticed ?? '').localeCompare(input.states.get(b.id)?.lastPracticed ?? '') || a.order - b.order)[0]
    if (pick) {
      out.push({ skill: pick, kind: 'competition', reason: `Persiapan ${c.name}, ${daysLeftLabel(daysBetween(input.today, c.date))}.` })
      break
    }
  }
  return out
}

function modeFor(c: Candidate): PlanMode {
  if (c.kind === 'reteach') return 'belajar'
  if (c.kind === 'new') return c.skill.hasLesson ? 'belajar' : 'latihan'
  return 'latihan'
}

/**
 * Usulan slot quest untuk satu minggu. Paling banyak satu usulan per mapel per hari yang
 * bukan hari istirahat, belum lewat, dan belum punya slot quest mapel itu. Urutan isi:
 * ajar ulang, review yang lama tidak dilatih, satu skill baru berikutnya, persiapan lomba.
 * Skill yang sudah terjadwal minggu ini tidak diusulkan lagi. Id berbentuk <tanggal>:<mapel>:<skill>:
 * usulan yang tidak terpengaruh perubahan rencana tetap ber-id sama, dan applySuggestions hanya
 * menerapkan id yang masih ada setelah dihitung ulang.
 */
export function suggestWeek(input: SuggestInput): Suggestion[] {
  const scheduled = new Set(input.slots.map((s) => s.skillId).filter((x): x is string => Boolean(x)))
  const filled = new Set(input.slots.filter((s) => s.kind === 'quest').map((s) => `${s.date}:${s.subject}`))
  const minutes = new Map<IsoDate, number>()
  for (const s of input.slots) minutes.set(s.date, (minutes.get(s.date) ?? 0) + s.minutes)
  const open = input.days.filter((d) => !d.rest && d.date >= input.firstPlannable).map((d) => d.date)

  const out: Suggestion[] = []
  for (const subject of SUBJECT_ORDER) {
    const queue = candidatesFor(subject, input, scheduled)
    let next = 0
    for (const date of open) {
      if (filled.has(`${date}:${subject}`)) continue
      const c = queue[next++]
      if (!c) break
      const mode = modeFor(c)
      const questionCount = defaultQuestionCount(mode, input.learnerGrade)
      const total = (minutes.get(date) ?? 0) + estimateMinutes(questionCount)
      const limitNote = total > input.screenLimitMin ? `${weekdayNameId(date)} jadi ${total} menit kalau ditambah.` : null
      out.push({
        id: `${date}:${subject}:${c.skill.id}`,
        date,
        subject,
        skillId: c.skill.id,
        title: c.skill.title,
        reason: [c.reason, limitNote].filter(Boolean).join(' '),
        kind: c.kind,
        mode,
        questionCount,
      })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject))
}
