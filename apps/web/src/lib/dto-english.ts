import type { LearnerShell } from './dto'

/**
 * DTO halaman English Skills dan Spelling Bee (rencana bagian 12). Teks learner en-GB.
 * Dipisah dari dto.ts supaya tidak bentrok dengan perubahan DTO lain.
 */

export type EnglishCardArea = 'listening' | 'speaking' | 'writing' | 'spelling' | 'reading'

export type EnglishCardDTO = {
  area: EnglishCardArea
  title: string
  blurb: string
  /** Misalnya "6 questions, about 6 minutes". */
  detail: string
  /** Kemajuan: "3 of 12 skills mastered" atau "2 sessions done". Null bila belum ada apa pun. */
  progress: string | null
  href: string
  cta: string
  /** Soal belum tersedia untuk kelas ini. */
  unavailable: boolean
}

export type EnglishLadderDTO = { name: string; cefr: string; grades: string; current: boolean }

export type EnglishSkillsDTO = {
  shell: LearnerShell
  levelName: string
  cefr: string
  ladder: EnglishLadderDTO[]
  cards: EnglishCardDTO[]
}

export type SpellingWordDTO = { id: string; word: string; sentence: string }

export type SpellingRoundDTO = {
  shell: LearnerShell
  levelName: string
  words: SpellingWordDTO[]
  /** XP yang masih bisa didapat dari Spelling Bee hari ini. */
  xpLeftToday: number
}

export type SpellingAnswerInput = { id: string; typed: string; tries: 1 | 2 }
export type SpellingResultDTO = { correct: number; total: number; xp: number; xpLeftToday: number }
