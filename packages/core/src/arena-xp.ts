/**
 * XP arena (Quick Maths dan Quiz Arena). Tanpa batas bermain, tetapi XP menyusut setelah banyak ronde
 * dalam satu hari belajar supaya arena tidak bisa dipakai untuk menggiling level.
 *
 * Ronde ke-1 sampai ke-6 hari itu 100 persen, ke-7 sampai ke-12 50 persen, ke-13 sampai ke-20 25 persen,
 * sesudahnya 10 persen. Ronde yang selesai dengan XP mentah di atas 0 tidak pernah memberi kurang dari 1.
 */

export const FULL_XP_ROUNDS = 6

const STEPS: readonly { upTo: number; factor: number }[] = [
  { upTo: FULL_XP_ROUNDS, factor: 1 },
  { upTo: 12, factor: 0.5 },
  { upTo: 20, factor: 0.25 },
  { upTo: Number.POSITIVE_INFINITY, factor: 0.1 },
]

/** `roundsBefore` = ronde arena yang sama yang sudah selesai pada hari belajar ini. */
export function diminishingFactor(roundsBefore: number): number {
  const n = Math.max(0, Math.floor(roundsBefore)) + 1
  return STEPS.find((s) => n <= s.upTo)?.factor ?? 0.1
}

export function applyDiminishing(rawXp: number, roundsBefore: number): number {
  if (rawXp <= 0) return 0
  return Math.max(1, Math.round(rawXp * diminishingFactor(roundsBefore)))
}

/** XP Quick Maths per jawaban benar menurut level (1 sampai 8). */
export function qmAnswerXp(level: number): number {
  const l = Math.max(1, Math.min(8, Math.floor(level)))
  return 1 + Math.floor((l - 1) / 2)
}

export const QUIZ_ANSWER_XP = 2
export const LEARN_CARD_XP = 1
export const LEARN_DECK_MAX_XP = 10
export const ROUND_FINISH_BONUS = 5
export const ROUND_PERFECT_BONUS = 5
export const PERFECT_MIN_ANSWERED = 10
export const FINISH_MIN_ANSWERED = 8
export const STRATEGY_XP = 10
export const MISSION_BONUS_XP = 25

/** XP mentah satu ronde sebelum penyusutan harian. */
export function roundRawXp(input: { perCorrectXp: number[]; answered: number; correct: number }): number {
  const sum = input.perCorrectXp.reduce((a, b) => a + b, 0)
  let bonus = 0
  if (input.answered >= FINISH_MIN_ANSWERED) bonus += ROUND_FINISH_BONUS
  if (input.answered >= PERFECT_MIN_ANSWERED && input.correct === input.answered) bonus += ROUND_PERFECT_BONUS
  return sum + bonus
}
