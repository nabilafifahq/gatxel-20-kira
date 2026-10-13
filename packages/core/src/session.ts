import { daysBetween, weekStart, weekday, type IsoDate } from './time'
import { SUBJECTS, type Subject } from './quest'
import type { PresetRules, ScoringSection } from './scoring'

/**
 * Struktur harian (rencana Kira Juara, bagian 3): 9 sesi wajib per hari (Latihan, Tes, dan Paper untuk
 * setiap mapel) ditambah sampai 10 sesi opsional dari tutor. Modul ini murni: DAL memanggilnya untuk
 * menyusun sesi hari ini dan perencana konsol memakainya untuk menampilkan hari yang sama.
 */

export const SESSION_TYPES = [
  'latihan',
  'tes',
  'paper',
  'lesson',
  'simulation',
  'esmo',
  'review',
  'quick-maths',
  'knowledge',
  'english-skill',
  'reading',
] as const
export type SessionType = (typeof SESSION_TYPES)[number]

/** Tiga sesi wajib per mapel, dalam urutan Today. */
export const CORE_SESSIONS = ['latihan', 'tes', 'paper'] as const
export type CoreSession = (typeof CORE_SESSIONS)[number]

/** Sesi yang dikerjakan di runner Kira dengan soal pilihan mesin (selain paper). */
export function isSkillSession(s: SessionType): boolean {
  return s === 'latihan' || s === 'tes' || s === 'reading'
}

/** Sesi yang membuka halaman lain (pelajaran, simulasi, arena) dan ditandai selesai oleh halaman itu. */
export function isLinkSession(s: SessionType): boolean {
  return !(s === 'latihan' || s === 'tes' || s === 'paper' || s === 'reading')
}

export const ENGLISH_SKILL_KINDS = ['listening', 'reading', 'writing', 'speaking'] as const
export type EnglishSkillKind = (typeof ENGLISH_SKILL_KINDS)[number]

export const MAX_EXTRA_PER_DAY = 10

export const LATIHAN_COUNT = 10
export const TES_COUNT = 8
export const TES_SECONDS_PER_QUESTION = 75
export const MINI_PAPER_COUNT = 8
export const MINI_PAPER_MINUTES = 15

export type PaperKind = 'mini' | 'full'

/** Batas waktu Tes: 75 detik per soal. */
export function tesTimeLimitSec(questionCount: number, perQuestionSec = TES_SECONDS_PER_QUESTION): number {
  return Math.max(1, Math.round(questionCount * perQuestionSec))
}

// ---------------------------------------------------------------------------
// Template hari

export const DAY_TEMPLATES = ['school', 'saturday', 'light'] as const
export type DayTemplate = (typeof DAY_TEMPLATES)[number]

/** Senin sampai Jumat memakai "Hari sekolah", Sabtu memakai "Sabtu paper penuh". Minggu istirahat. */
export function defaultTemplate(date: IsoDate): DayTemplate {
  return weekday(date) === 6 ? 'saturday' : 'school'
}

/** Awal hitungan giliran Sabtu: Senin pertama tahun 2026. */
const ROTATION_ANCHOR: IsoDate = '2026-01-05'

/** Mapel yang mendapat paper penuh pada Sabtu di minggu tanggal itu; bergiliran Math, English, Science. */
export function saturdayFullSubject(date: IsoDate): Subject {
  const weeks = Math.floor(daysBetween(ROTATION_ANCHOR, weekStart(date)) / 7)
  const i = ((weeks % SUBJECTS.length) + SUBJECTS.length) % SUBJECTS.length
  return SUBJECTS[i]!
}

export type BaselineSession = { subject: Subject; session: CoreSession; paper: PaperKind | null }

/**
 * Sesi wajib dasar sebuah hari. Hari sekolah dan Sabtu punya 9 sesi; Hari ringan hanya satu Latihan
 * per mapel, jadi hari sakit atau hari sekolah yang berat tetap bisa lengkap dan tidak memutus streak.
 */
export function baselineSessions(template: DayTemplate, date: IsoDate): BaselineSession[] {
  const out: BaselineSession[] = []
  const fullSubject = template === 'saturday' ? saturdayFullSubject(date) : null
  for (const subject of SUBJECTS) {
    out.push({ subject, session: 'latihan', paper: null })
    if (template === 'light') continue
    out.push({ subject, session: 'tes', paper: null })
    out.push({ subject, session: 'paper', paper: subject === fullSubject ? 'full' : 'mini' })
  }
  return out
}

// ---------------------------------------------------------------------------
// Menyusun sesi satu hari dari template dan slot rencana

export type PlannedSlot = {
  id: string
  subject: Subject
  session: SessionType
  required: boolean
  /** Dipakai sesi paper tanpa paper tertentu. */
  paperKind: PaperKind | null
  /** Urutan pembuatan, supaya susunan stabil. */
  order: number
}

export type DayEntry = {
  /** Id slot, atau auto:<mapel>:<sesi>:<n> untuk sesi dari template tanpa slot. */
  key: string
  slotId: string | null
  subject: Subject
  session: SessionType
  required: boolean
  paper: PaperKind | null
  /** Nomor urut dalam kelompok (mapel, sesi, wajib atau opsional). */
  seq: number
}

/**
 * Slot wajib menggantikan sesi dasar yang mapel dan jenisnya sama. Slot wajib lain menjadi sesi wajib tambahan,
 * slot opsional menjadi sesi tambahan (paling banyak MAX_EXTRA_PER_DAY). Sesi dasar tanpa slot dipilih otomatis.
 */
export function composeDay(input: { template: DayTemplate; date: IsoDate; slots: readonly PlannedSlot[] }): DayEntry[] {
  const slots = [...input.slots].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  const used = new Set<string>()
  const seqOf = new Map<string, number>()
  const nextSeq = (subject: Subject, session: SessionType, required: boolean) => {
    const k = `${subject}:${session}:${required ? 'r' : 'o'}`
    const n = seqOf.get(k) ?? 0
    seqOf.set(k, n + 1)
    return n
  }
  const entries: DayEntry[] = []
  for (const b of baselineSessions(input.template, input.date)) {
    const slot = slots.find((s) => !used.has(s.id) && s.required && s.subject === b.subject && s.session === b.session)
    const seq = nextSeq(b.subject, b.session, true)
    if (slot) {
      used.add(slot.id)
      entries.push({ key: slot.id, slotId: slot.id, subject: b.subject, session: b.session, required: true, paper: b.session === 'paper' ? (slot.paperKind ?? b.paper) : null, seq })
    } else {
      entries.push({ key: `auto:${b.subject}:${b.session}:${seq}`, slotId: null, subject: b.subject, session: b.session, required: true, paper: b.paper, seq })
    }
  }
  for (const s of slots) {
    if (used.has(s.id) || !s.required) continue
    used.add(s.id)
    entries.push({ key: s.id, slotId: s.id, subject: s.subject, session: s.session, required: true, paper: s.session === 'paper' ? (s.paperKind ?? 'mini') : null, seq: nextSeq(s.subject, s.session, true) })
  }
  let extras = 0
  for (const s of slots) {
    if (used.has(s.id) || s.required) continue
    if (extras >= MAX_EXTRA_PER_DAY) break
    extras++
    used.add(s.id)
    entries.push({ key: s.id, slotId: s.id, subject: s.subject, session: s.session, required: false, paper: s.session === 'paper' ? (s.paperKind ?? 'mini') : null, seq: nextSeq(s.subject, s.session, false) })
  }
  return entries
}

export function requiredCount(entries: readonly DayEntry[]): number {
  return entries.filter((e) => e.required).length
}

// ---------------------------------------------------------------------------
// Perkiraan menit

/** Perkiraan menit satu sesi, dipakai Today dan meteran waktu layar di perencana. */
export function sessionMinutes(input: {
  session: SessionType
  questionCount?: number
  paper?: PaperKind | null
  /** Menit asli paper atau preset bila ada. */
  fixedMinutes?: number | null
  perQuestionSec?: number
}): number {
  const q = input.questionCount
  switch (input.session) {
    case 'latihan':
    case 'reading':
      return Math.max(3, Math.ceil(((q ?? LATIHAN_COUNT) * 0.7)))
    case 'tes':
      return Math.max(3, Math.ceil(((q ?? TES_COUNT) * (input.perQuestionSec ?? TES_SECONDS_PER_QUESTION)) / 60))
    case 'paper':
      return input.fixedMinutes && input.fixedMinutes > 0 ? input.fixedMinutes : input.paper === 'full' ? 75 : MINI_PAPER_MINUTES
    case 'simulation':
    case 'esmo':
      return input.fixedMinutes && input.fixedMinutes > 0 ? input.fixedMinutes : 30
    case 'lesson':
      return 8
    case 'review':
      return 5
    case 'quick-maths':
    case 'knowledge':
      return 5
    case 'english-skill':
      return 10
  }
}

// ---------------------------------------------------------------------------
// Skor paper mini

/**
 * Aturan skor untuk paper dengan n soal dari preset penuh. Jumlah soal tiap bagian dibagi sebanding
 * (sisa dibagi ke bagian terbesar dulu), poin dan pengurang per soal tetap, skor awal ikut diperkecil,
 * dan skala serta batas lulus tetap.
 */
export function scaleRulesToCount(rules: PresetRules, n: number, timeLimitMin?: number): PresetRules {
  const total = rules.sections.reduce((a, s) => a + (s.to - s.from + 1), 0)
  const target = Math.max(1, Math.min(n, total))
  if (target >= total) return { ...rules, ...(timeLimitMin ? { timeLimitMin } : {}) }
  const sizes = rules.sections.map((s) => s.to - s.from + 1)
  const exact = sizes.map((z) => (z * target) / total)
  const counts = exact.map((e) => Math.floor(e))
  let left = target - counts.reduce((a, b) => a + b, 0)
  const order = exact.map((e, i) => ({ i, frac: e - Math.floor(e), size: sizes[i]! })).sort((a, b) => b.frac - a.frac || b.size - a.size || a.i - b.i)
  for (const o of order) {
    if (left <= 0) break
    counts[o.i]!++
    left--
  }
  const sections: ScoringSection[] = []
  let pos = 1
  rules.sections.forEach((s, i) => {
    const c = counts[i]!
    if (c <= 0) return
    sections.push({ ...s, from: pos, to: pos + c - 1 })
    pos += c
  })
  return {
    ...rules,
    questionCount: target,
    timeLimitMin: timeLimitMin ?? rules.timeLimitMin,
    sections,
    ...(rules.startScore ? { startScore: Math.round((rules.startScore * target) / total) } : {}),
  }
}

/** Poin yang dipakai tiap nomor soal pada aturan itu, untuk memilih soal yang cocok. */
export function pointsByPosition(rules: PresetRules): Map<number, number> {
  const m = new Map<number, number>()
  for (const s of rules.sections) for (let p = s.from; p <= s.to; p++) m.set(p, s.points)
  return m
}

// ---------------------------------------------------------------------------
// Ulang sesi dan skor terbaik

export type ScoreLike = { raw: number | null; max: number | null; scaled: number | null }

/** Skor 0 sampai 1 untuk membandingkan percobaan sesi yang sama. */
export function scoreFraction(s: ScoreLike): number {
  if (s.max !== null && s.max > 0 && s.raw !== null) return Math.max(0, Math.min(1, s.raw / s.max))
  if (s.scaled !== null) return Math.max(0, Math.min(1, s.scaled / 100))
  return 0
}

/** Indeks percobaan dengan skor tertinggi; seri dimenangkan percobaan lebih awal. -1 bila kosong. */
export function bestIndex(scores: readonly ScoreLike[]): number {
  let best = -1
  let bestScore = -1
  scores.forEach((s, i) => {
    const f = scoreFraction(s)
    if (f > bestScore + 1e-9) {
      best = i
      bestScore = f
    }
  })
  return best
}

/** Percobaan ulang yang lebih baik dari semua percobaan sebelumnya. */
export function retryImproved(previous: readonly ScoreLike[], next: ScoreLike): boolean {
  if (previous.length === 0) return false
  const prevBest = Math.max(...previous.map(scoreFraction))
  return scoreFraction(next) > prevBest + 1e-9
}
