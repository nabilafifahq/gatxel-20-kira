import 'server-only'
import { LATIHAN_COUNT, TES_COUNT, addDays, daysBetween, estimateMinutes, weekDates, weekStart, weekdayNameId, type DayTemplate, type Gate, type IsoDate, type SessionType } from '@kira/core'
import type { PlannerDay, Subject } from '@/lib/dto'
import { invalid } from '../errors'
import { daysLeftLabel, shortDateId, SUBJECT_ID_LABEL, SUBJECT_ORDER, weekLabelId } from './console-common'

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

/** Jumlah soal bawaan sesi: Latihan 10, Tes 8 (Belajar lama 6). Sama untuk semua grade. */
export function defaultQuestionCount(mode: PlanMode, _grade?: number): number {
  if (mode === 'belajar') return 6
  return mode === 'tes' ? TES_COUNT : LATIHAN_COUNT
}

/** Nama sesi di konsol (Indonesia). */
export const SESSION_LABEL_ID: Record<SessionType, string> = {
  latihan: 'Latihan',
  tes: 'Tes',
  paper: 'Paper',
  lesson: 'Pelajaran',
  simulation: 'Simulasi lomba',
  esmo: 'Paket ESMO',
  review: 'Ulang kartu',
  'quick-maths': 'Hitung Cepat',
  knowledge: 'Kuis Pengetahuan',
  'english-skill': 'Tugas English',
  reading: 'Membaca',
}

/** Nama template hari di konsol (Indonesia). */
export const TEMPLATE_LABEL_ID: Record<DayTemplate, string> = {
  school: 'Hari sekolah',
  saturday: 'Sabtu paper penuh',
  light: 'Hari ringan',
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
): Pick<PlannerDay, 'date' | 'label' | 'rest' | 'totalMinutes' | 'overLimit'>[] {
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

export type ExistingSlot = {
  date: IsoDate
  subject: Subject
  kind: 'quest' | 'bonus'
  skillId: string | null
  minutes: number
  /** Jenis sesi dan wajib atau tidak; kosong berarti Latihan wajib (slot lama). */
  session?: SessionType
  required?: boolean
  /** Sesi dasar dari template tanpa slot: ikut menghitung menit, tidak mengisi sel usulan. */
  auto?: boolean
}

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

/** Usulan selalu Latihan 10 soal; pelajaran skill baru ditawarkan di pembuka sesi, bukan sebagai mode lain. */
function modeFor(_c: Candidate): PlanMode {
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
  // Sel terisi bila tutor sudah menetapkan Latihan wajib untuk mapel itu; sesi lain dan sesi dasar tidak mengisinya.
  const filled = new Set(
    input.slots.filter((s) => s.kind === 'quest' && !s.auto && (s.session ?? 'latihan') === 'latihan' && (s.required ?? true)).map((s) => `${s.date}:${s.subject}`),
  )
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
      const total = minutes.get(date) ?? 0
      const limitNote = total > input.screenLimitMin ? `${weekdayNameId(date)} sudah ${total} menit, lewat batas ${input.screenLimitMin}.` : null
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

// ---------------------------------------------------------------------------
// Validasi slot

export type NormaliseSlotInput = {
  session: SessionType
  subject: Subject
  required: boolean
  skillId: string | null
  mode: PlanMode
  questionCount: number
  paperKind: 'mini' | 'full' | null
  config: { presetId?: string | undefined; task?: string | undefined; perQuestionSec?: number | undefined } | null
  /** Skill dari konten repo bila skillId diisi, atau null bila tidak ada. */
  skill: { id: string; subject: Subject; title: string } | null
  skillHasLesson: boolean
  /** Mapel preset bila config.presetId diisi dan preset itu ada. */
  presetSubject: Subject | null
}

export type NormalisedSlot = {
  session: SessionType
  subject: Subject
  required: boolean
  skillId: string | null
  mode: PlanMode
  questionCount: number
  paperKind: 'mini' | 'full' | null
  config: Record<string, string | number> | null
}

const CORE: readonly SessionType[] = ['latihan', 'tes', 'paper']
const TASKS = ['listening', 'reading', 'writing', 'speaking']
export const PER_QUESTION_MIN = 30
export const PER_QUESTION_MAX = 180

function fail(field: string, message: string): never {
  throw invalid(message, { [field]: message })
}

/**
 * Aturan slot per jenis sesi. Latihan dan Tes butuh skill (Tes boleh kosong: mengikuti Latihan hari itu),
 * Paper butuh jenis mini atau penuh, Pelajaran butuh skill yang punya pelajaran, Simulasi butuh preset,
 * Tugas English butuh jenis tugas. Hanya Latihan, Tes, dan Paper yang boleh wajib; sesi lain selalu opsional.
 */
export function normaliseSlot(i: NormaliseSlotInput): NormalisedSlot {
  const out: NormalisedSlot = {
    session: i.session,
    subject: i.subject,
    required: CORE.includes(i.session) ? i.required : false,
    skillId: null,
    mode: i.session === 'tes' ? 'tes' : 'latihan',
    questionCount: LATIHAN_COUNT,
    paperKind: null,
    config: null,
  }
  const needSkill = i.session === 'latihan' || i.session === 'reading' || i.session === 'lesson'
  if (i.skillId !== null && i.skill === null) fail('skillId', 'Skill itu tidak ada di konten Kira. Pilih skill dari daftar.')
  if (i.skill && i.skill.subject !== i.subject) {
    fail('skillId', `${i.skill.title} bukan skill ${SUBJECT_ID_LABEL[i.subject]}. Pilih skill dari mapel ${SUBJECT_ID_LABEL[i.subject]}.`)
  }
  if (needSkill && !i.skill) fail('skillId', 'Pilih satu skill untuk sesi ini.')
  if (i.session === 'latihan' || i.session === 'tes' || i.session === 'reading') {
    const n = i.questionCount
    if (!Number.isInteger(n) || n < QUESTION_COUNT_MIN || n > QUESTION_COUNT_MAX) {
      fail('questionCount', `Jumlah soal harus angka bulat ${QUESTION_COUNT_MIN} sampai ${QUESTION_COUNT_MAX}.`)
    }
    out.questionCount = n
  }
  switch (i.session) {
    case 'latihan':
      out.skillId = i.skill!.id
      break
    case 'tes': {
      out.skillId = i.skill?.id ?? null
      const sec = i.config?.perQuestionSec
      if (sec !== undefined) {
        if (!Number.isInteger(sec) || sec < PER_QUESTION_MIN || sec > PER_QUESTION_MAX) {
          fail('perQuestionSec', `Waktu per soal harus ${PER_QUESTION_MIN} sampai ${PER_QUESTION_MAX} detik.`)
        }
        if (sec !== 75) out.config = { perQuestionSec: sec }
      }
      break
    }
    case 'reading':
      if (i.subject !== 'english') fail('subject', 'Sesi Membaca hanya untuk English.')
      out.skillId = i.skill!.id
      break
    case 'lesson':
      if (!i.skillHasLesson) fail('skillId', 'Skill ini belum punya pelajaran. Pilih skill lain.')
      out.skillId = i.skill!.id
      break
    case 'paper':
      if (i.paperKind !== 'mini' && i.paperKind !== 'full') fail('paperKind', 'Pilih paper mini atau paper penuh.')
      out.paperKind = i.paperKind
      break
    case 'simulation': {
      const id = i.config?.presetId
      if (!id || i.presetSubject === null) fail('presetId', 'Pilih satu simulasi lomba dari daftar.')
      if (i.presetSubject !== i.subject) fail('presetId', `Simulasi itu untuk ${SUBJECT_ID_LABEL[i.presetSubject!]}. Pilih mapel yang sama.`)
      out.config = { presetId: id }
      break
    }
    case 'esmo':
      if (i.subject === 'science') fail('subject', 'Paket ESMO hanya untuk Math dan English.')
      break
    case 'english-skill': {
      if (i.subject !== 'english') fail('subject', 'Tugas English hanya untuk mapel English.')
      const task = i.config?.task
      if (!task || !TASKS.includes(task)) fail('task', 'Pilih jenis tugas: listening, reading, writing, atau speaking.')
      out.config = { task }
      break
    }
    case 'quick-maths':
      if (i.subject !== 'math') fail('subject', 'Tantangan Hitung Cepat hanya untuk Math.')
      break
    case 'review':
    case 'knowledge':
      break
  }
  return out
}
