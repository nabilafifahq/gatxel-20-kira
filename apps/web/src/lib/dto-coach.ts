import type { Subject } from '@/lib/dto'

/** DTO Pelatih Orang Tua: kegiatan mingguan, lembar kerja, dan rapor bulanan. Semua teks untuk orang tua dalam bahasa Indonesia. */

export type CoachActivityDTO = {
  id: string
  title: string
  minutes: number
  materials: string[]
  steps: string[]
  ask: string
  easier: string
}

export type CoachWeakDTO = {
  skillId: string
  subject: Subject
  subjectLabel: string
  title: string
  /** Artinya skill ini dalam kata sehari-hari. */
  plain: string
  accuracyLine: string
  /** Sudah cukup kuat; Pelatih menyebut skill ini hanya karena relatif paling lemah. */
  solid: boolean
  activity: CoachActivityDTO | null
}

export type CoachDTO = {
  learnerId: string
  name: string
  grade: number
  weekLabel: string
  state: 'empty' | 'thin' | 'ok'
  /** Penjelasan jujur tentang jumlah data; kosong bila data cukup. */
  note: string
  weak: CoachWeakDTO[]
  /** Kegiatan ringan untuk keluarga yang datanya belum cukup. */
  starter: (CoachActivityDTO & { subjectLabel: string }) | null
  strength: { title: string; subjectLabel: string; line: string } | null
  praise: string
  minutesThisWeek: number
}

export type CoachChild = { id: string; name: string; grade: number }

export type CoachPageDTO = {
  children: CoachChild[]
  selectedId: string | null
  coach: CoachDTO | null
}

export type WorksheetLength = 'short' | 'medium' | 'long'

export type WorksheetSkillOption = { id: string; subject: Subject; title: string; titleId: string; grade: number; available: number }

export type WorksheetPageDTO = {
  children: CoachChild[]
  selectedId: string | null
  /** Skill yang punya soal cetak untuk kelas anak terpilih (dan satu kelas di bawahnya). */
  skills: WorksheetSkillOption[]
  limit: { perDay: number; usedToday: number }
  lengths: { id: WorksheetLength; label: string; count: number }[]
}

export type ReportSubjectDTO = {
  subject: Subject
  label: string
  answers: number
  accuracyPct: number | null
  skillsPracticed: number
  starsUp: number
  newlyMastered: number
  starsBefore: number | null
  starsAfter: number | null
  sessions: number
  highlights: { title: string; from: number; to: number }[]
}

export type ReportCoverageDTO = {
  subject: Subject
  label: string
  frameworkTitle: string
  stage: number
  total: number
  strong: number
  inProgress: number
  notYet: number
  noSkill: number
}

export type MonthlyReportDTO = {
  learnerId: string
  name: string
  grade: number
  monthLabel: string
  month: string
  /** Bulan yang tersedia di pemilih. */
  months: { value: string; label: string }[]
  minutes: number
  activeDays: number
  daysInMonth: number
  sessions: number
  subjects: ReportSubjectDTO[]
  coverage: ReportCoverageDTO[]
  coverageNote: string
  next: string[]
  hasData: boolean
  emptyNote: string
}

export type ReportPageDTO = { children: CoachChild[]; selectedId: string | null; report: MonthlyReportDTO | null }
