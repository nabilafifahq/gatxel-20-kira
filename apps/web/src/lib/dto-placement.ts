import type { ClientItem } from '@kira/content/present'
import type { AvatarName, Jenjang, Subject } from './dto'

/** Kartu hari pertama di Today: tes penempatan yang menunggu anak. */
export type PlacementCardDTO = {
  subjects: { subject: Subject; label: string; status: 'ready' | 'in_progress'; answered: number }[]
}

export type PlacementStepDTO = {
  runId: string
  subject: Subject
  subjectLabel: string
  jenjang: Jenjang
  avatar: AvatarName
  /** Nomor soal yang sedang tampil, mulai dari 1. */
  number: number
  /** Perkiraan jumlah soal (bukan janji): tes berhenti saat perkiraan stabil. */
  about: number
  item: ClientItem
  /** Mapel lain yang masih menunggu setelah ini. */
  more: number
}

export type PlacementAnswerResultDTO =
  | { done: false; step: PlacementStepDTO }
  | { done: true; subject: Subject; subjectLabel: string; nextSubject: Subject | null; jenjang: Jenjang; avatar: AvatarName }

export type PlacementEntryDTO =
  | { kind: 'step'; step: PlacementStepDTO; first: boolean }
  | { kind: 'nothing'; jenjang: Jenjang; avatar: AvatarName }
  | { kind: 'pick'; jenjang: Jenjang; avatar: AvatarName; subjects: PlacementCardDTO['subjects'] }

/** Hasil satu mapel untuk orang tua. Semua teks sudah dalam bahasa Indonesia yang hangat. */
export type PlacementResultDTO = {
  runId: string
  subject: Subject
  label: string
  finishedAt: string
  answered: number
  /** Contoh: "sekitar kelas 3" */
  levelText: string
  level: number
  /** Kalimat perbandingan dengan kelas yang disebut orang tua. */
  vsGrade: string
  confidenceText: string
  groups: { id: string; label: string; status: 'kuat' | 'cukup' | 'perlu' | 'belum'; statusText: string; asked: number; correct: number }[]
  strengths: { title: string; grade: number }[]
  focus: { title: string; grade: number }[]
  next: string[]
}

export type ParentPlacementSubjectDTO = {
  subject: Subject
  label: string
  state: 'belum' | 'siap' | 'berjalan' | 'selesai' | 'dilewati'
  result: PlacementResultDTO | null
  /** Orang tua boleh menyiapkan tes (atau tes ulang) sekarang. */
  canRequest: boolean
  /** Alasan bila belum boleh, mis. tanggal tes ulang berikutnya. */
  requestNote: string | null
}

export type ParentPlacementDTO = {
  enabled: boolean
  subjects: ParentPlacementSubjectDTO[]
  disclaimer: string
}
