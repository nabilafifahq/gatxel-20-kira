import type { ActionResult, ConsoleShell, LearnerShell, Subject } from './dto'

/**
 * DTO pustaka paper, Buku Salah, program olimpiade, dan sumber soal (konsol tutor, bahasa Indonesia),
 * serta layar Buku Salah di sisi learner (en-GB). File terpisah dari dto.ts supaya cabang lain tidak bentrok.
 */

export type PustakaLearner = { id: string; name: string; grade: number }

// ---------------------------------------------------------------------------
// Pustaka paper

export type PaperLibraryRowDTO = {
  id: string
  title: string
  subject: Subject
  grade: number
  competition: string | null
  year: number | null
  section: string
  minutes: number
  items: number
  source: string
  /** Sudah pernah dipilih untuk learner terpilih. */
  picked: boolean
}

export type PaperPickRowDTO = {
  id: string
  date: string
  subject: Subject
  kind: 'mini' | 'full'
  title: string
  minutes: number
  origin: 'official' | 'kira-made'
  /** "18 dari 24 benar" bila hasilnya sudah ada. */
  result: string | null
  /** Perbandingan dengan batas medali bila datanya diketahui. */
  medal: string | null
}

export type MedalRowDTO = { competition: string; year: number; grades: string; bands: string; verified: boolean; source: string }

export type PaperLibraryDTO = {
  shell: ConsoleShell
  learner: PustakaLearner | null
  entries: PaperLibraryRowDTO[]
  /** Jumlah soal yang tersedia untuk Paper gaya lomba buatan Kira, per mapel (grade learner terpilih). */
  kiraMade: { subject: Subject; items: number }[]
  picks: PaperPickRowDTO[]
  medals: MedalRowDTO[]
}

// ---------------------------------------------------------------------------
// Buku Salah

export type MistakeType = 'blank' | 'rushed' | 'slow' | 'careless' | 'concept'

export type MistakeReportDTO = {
  shell: ConsoleShell
  learner: PustakaLearner | null
  open: number
  cleared: number
  byType: { type: MistakeType; label: string; count: number; percent: number; advice: string }[]
  bySkill: { skillId: string; title: string; subject: Subject; count: number }[]
  items: { ref: string; skillTitle: string; subject: Subject; typeLabel: string; wrongOn: string; prompt: string }[]
  redo: { date: string; correct: number; total: number }[]
}

/** Layar learner (en-GB). */
export type FixItDTO = {
  shell: LearnerShell
  open: number
  /** Soal yang akan muncul di sesi berikutnya (paling banyak 10). */
  sessionSize: number
  /** Sabtu: sesi Buku Salah disarankan. */
  saturday: boolean
  /** Ringkasan per mapel untuk anak. */
  bySubject: { subject: Subject; label: string; count: number }[]
  canStart: boolean
}

// ---------------------------------------------------------------------------
// Program olimpiade

export type ProgramCardDTO = {
  id: string
  title: string
  subject: Subject
  grade: number
  summary: string
  competitions: string[]
  phases: { name: string; weeks: string; focus: string; summary: string }[]
  simulationNote: string
}

export type ProgramRunDTO = {
  id: string
  programId: string
  title: string
  startDate: string
  endDate: string
  status: 'active' | 'cancelled'
  slots: number
}

export type ProgramsDTO = {
  shell: ConsoleShell
  learner: PustakaLearner | null
  programs: ProgramCardDTO[]
  runs: ProgramRunDTO[]
  /** Tanggal paling awal yang bisa dipilih (hari ini, atau besok bila quest hari ini sudah dibuat). */
  minStart: string
}

export type ProgramStartResult = { runId: string; slots: number; restDaysSkipped: number; conflictsSkipped: number; simulations: number }

export type ProgramActions = {
  startProgram(input: { learnerId: string; programId: string; startDate: string }): Promise<ActionResult<ProgramStartResult>>
  cancelProgram(input: { runId: string }): Promise<ActionResult<{ removed: number }>>
}

// ---------------------------------------------------------------------------
// Sumber soal

export type SourceRowDTO = {
  id: string
  name: string
  site: string
  licenseId: string
  licenseLabel: string
  licenseNote: string | null
  access: 'auto' | 'manual-upload' | 'listed'
  accessLabel: string
  subjects: string
  grades: string
  years: string
  attribution: string
  /** Boleh jadi JSON konten di repo (lisensi permisif). */
  committable: boolean
  enabled: boolean
  lastRun: string | null
  lastResult: string | null
  counts: { published: number; queued: number; rejected: number; unmapped: number; imported: number }
  notes: string | null
}

export type SourcesDTO = {
  shell: ConsoleShell
  sources: SourceRowDTO[]
  weekly: { lastRun: string | null; lastResult: string | null }
}

export type SourcesActions = {
  setSourceEnabled(input: { sourceId: string; enabled: boolean }): Promise<ActionResult>
}
