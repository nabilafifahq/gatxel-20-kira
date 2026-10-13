/**
 * Kontrak data untuk arena (Quick Maths dan Quiz Arena), jalur XP, dan aksesori avatar.
 * Berkas terpisah dari dto.ts supaya perubahan arena tidak bentrok dengan DTO lain.
 * Teks learner berbahasa Inggris (en-GB); teks tutor berbahasa Indonesia.
 */

import type { AccessoryId, QmMode, QmPrompt, QmReviewRow, SorobanStage, StrategyId, XpTrack } from '@kira/core'
import type { KAnswer, KClientQuestion, LearnCard, Pic, RoundTopic, TopicId } from '@kira/content/knowledge'
import type { ActionResult, LearnerShell } from './dto'

// ---------------------------------------------------------------------------
// Jalur XP dan aksesori

export type XpTrackDTO = {
  track: XpTrack
  /** "Learning", "Quick Maths", "Quiz". */
  name: string
  levelLabel: string
  xp: number
  level: number
  into: number
  span: number
  toNext: number
  percent: number
  /** "40 of 200 XP to level 3". */
  line: string
}

export type AccessoryDTO = { id: AccessoryId; label: string; earned: boolean; howToEarn: string }

// ---------------------------------------------------------------------------
// Bagian bersama ronde

export type ArenaBadgeDTO = { id: string; title: string; description: string; glyph: string }

/** Hasil akhir ronde: XP, level naik, lencana, aksesori. Teks sudah siap tampil. */
export type ArenaRewardDTO = {
  xp: number
  /** Catatan bila XP menyusut karena banyak ronde hari ini. */
  xpNote: string | null
  trackLabel: string
  levelUp: { level: number; label: string } | null
  badges: ArenaBadgeDTO[]
  accessories: { id: AccessoryId; label: string }[]
  tracks: XpTrackDTO[]
}

// ---------------------------------------------------------------------------
// Quick Maths

export type QmModeCard = { mode: QmMode; title: string; blurb: string; timed: boolean }

export type QmLevelRow = { op: 'add' | 'sub' | 'mul' | 'div'; label: string; level: number; description: string }

export type QmStrategyRow = { id: StrategyId; title: string; summary: string; done: boolean }

export type QmMissionStep = { id: 'warmup' | 'sprint' | 'flash' | 'tables'; title: string; minutes: number; done: boolean; mode: QmMode }

export type QmStatsDTO = {
  rounds: number
  accuracy: number | null
  ppm: number | null
  bestSprintPpm: number | null
  bestTargetSec: number | null
  bestAccuracyRound: { correct: number; answered: number } | null
  week: { date: string; label: string; rounds: number; correct: number; ppm: number }[]
  slowest: { fact: string; label: string; avgSec: number; accuracy: number; n: number }[]
}

export type QmHubDTO = {
  shell: LearnerShell
  tracks: XpTrackDTO[]
  modes: QmModeCard[]
  levels: QmLevelRow[]
  flash: { level: number; description: string; cleared: number }
  soroban: { read: number; set: number; anzan: number }
  strategies: QmStrategyRow[]
  mission: { steps: QmMissionStep[]; done: boolean; table: number; minutes: number; streak: number; bonusXp: number }
  stats: QmStatsDTO
  roundsToday: number
  /** "Rounds from now on give a little less XP" bila banyak ronde sudah dimainkan hari ini. */
  xpNote: string | null
  limitReached: boolean
}

export type QmStartInput = {
  mode: QmMode
  op: 'add' | 'sub' | 'mul' | 'div' | 'mixed'
  digits: 1 | 2 | 3 | 'mixed'
  carry: boolean
  auto: boolean
  table: number
  division: boolean
  flashLevel: number | null
  sorobanStage: SorobanStage
  sorobanLevel: number | null
  focus: StrategyId | null
  mission: 'warmup' | 'sprint' | 'flash' | 'tables' | null
}

export type QmResultDTO = {
  answered: number
  correct: number
  accuracy: number
  ppm: number
  durationSec: number
  title: string
  lines: string[]
  review: QmReviewRow[]
  reward: ArenaRewardDTO
  /** Pelajaran strategi yang baru selesai. */
  strategyDone: { id: StrategyId; title: string } | null
  mission: { step: string; stepsDone: number; stepsTotal: number; complete: boolean; bonusXp: number } | null
  /** Level adaptif yang berubah, misalnya "Adding is now level 4". */
  levelNotes: string[]
  nextHref: string
}

export type QmRoundDTO = {
  shell: LearnerShell
  id: string
  mode: QmMode
  title: string
  subtitle: string
  timed: boolean
  limitSec: number | null
  /** Detik yang sudah lewat menurut jam server. */
  elapsedSec: number
  prompts: QmPrompt[]
  /** Jawaban yang sudah masuk (untuk melanjutkan setelah muat ulang). */
  done: { i: number; ok: boolean | null }[]
  right: number
  hints: boolean
  mission: { step: string; title: string } | null
  focus: { id: StrategyId; title: string } | null
  finished: QmResultDTO | null
  exitHref: string
  /** Pengaturan untuk main lagi; null untuk ronde misi harian. */
  again: QmStartInput | null
}

export type QmAnswerResult = {
  correct: boolean
  /** Hanya untuk mode tanpa waktu setelah jawaban salah. */
  answer?: number
  hint?: { title: string; steps: string[] }
}

export type QmActions = {
  start(input: QmStartInput): Promise<ActionResult<{ redirectTo: string }>>
  answer(input: { roundId: string; index: number; answer: number | null; ms: number }): Promise<ActionResult<QmAnswerResult>>
  hint(input: { roundId: string; index: number }): Promise<ActionResult<{ title: string; steps: string[] }>>
  finish(roundId: string): Promise<ActionResult<QmResultDTO>>
}

export type QmLessonDTO = {
  shell: LearnerShell
  id: StrategyId
  title: string
  summary: string
  cards: { title: string; text: string; example?: string[] }[]
  done: boolean
  /** Pelajaran berikutnya yang belum selesai. */
  nextHref: string | null
  backHref: string
}

// ---------------------------------------------------------------------------
// Quiz Arena

export type QuizTopicCard = {
  id: TopicId
  title: string
  blurb: string
  pic: Pic
  known: number
  total: number
  seen: number
  pictures: boolean
}

export type QuizHubDTO = {
  shell: LearnerShell
  tracks: XpTrackDTO[]
  topics: QuizTopicCard[]
  roundsToday: number
  xpNote: string | null
  limitReached: boolean
  speedBest: number
}

export type QuizTopicDTO = {
  shell: LearnerShell
  topic: QuizTopicCard
  tracks: XpTrackDTO[]
  /** Tingkat soal yang sudah terbuka (1 sampai 3) dan jumlah negara atau fakta per tingkat bila bertahap. */
  tiers: { open: 1 | 2 | 3; gated: boolean }
  limitReached: boolean
  xpNote: string | null
}

export type QuizStartInput = { topic: RoundTopic; mode: 'learn' | 'quiz' | 'speed' }

export type QuizResultDTO = {
  mode: 'learn' | 'quiz' | 'speed'
  topicTitle: string
  answered: number
  correct: number
  accuracy: number
  durationSec: number
  title: string
  lines: string[]
  review: { i: number; prompt: string; yours: string; answer: string; ok: boolean; pic?: Pic }[]
  reward: ArenaRewardDTO
  nextHref: string
}

export type QuizRoundDTO = {
  shell: LearnerShell
  id: string
  mode: 'learn' | 'quiz' | 'speed'
  topic: RoundTopic
  topicTitle: string
  timed: boolean
  limitSec: number | null
  elapsedSec: number
  /** Kuis dan speed quiz: soal tanpa kunci. Learn: kartu. */
  questions: KClientQuestion[]
  cards: LearnCard[]
  done: { i: number; ok: boolean | null }[]
  right: number
  finished: QuizResultDTO | null
  exitHref: string
  restartHref: string
}

export type QuizAnswerResult = {
  correct: boolean
  /** Hanya untuk kuis tanpa waktu. */
  explain?: string
  answerLabel?: string
}

export type QuizActions = {
  start(input: QuizStartInput): Promise<ActionResult<{ redirectTo: string }>>
  answer(input: { roundId: string; index: number; answer: KAnswer | null; ms: number }): Promise<ActionResult<QuizAnswerResult>>
  finish(roundId: string): Promise<ActionResult<QuizResultDTO>>
}

// ---------------------------------------------------------------------------
// Avatar: aksesori

export type AccessoryActions = { change(accessory: AccessoryId | null): Promise<ActionResult> }

// ---------------------------------------------------------------------------
// Laporan tutor (Indonesia)

export type ArenaTutorDTO = {
  tracks: { track: XpTrack; nama: string; xp: number; level: number }[]
  hitung: {
    ronde: number
    akurasi: number | null
    soalPerMenit: number | null
    rekorSprint: number | null
    rekorTarget: number | null
    minggu: { tanggal: string; label: string; ronde: number; benar: number; soalPerMenit: number }[]
    terlambat: { jenis: string; rataDetik: number; akurasi: number; jumlah: number }[]
    level: { operasi: string; level: number }[]
    flashLevel: number
    strategi: number
    misiHari: number
  }
  pengetahuan: {
    ronde: number
    topik: { judul: string; dikenal: number; total: number }[]
    rekorSpeed: number
  }
}
