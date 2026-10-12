/**
 * Model kemampuan per skill: logistik satu parameter (Rasch).
 * P(benar) = 1 / (1 + e^-(theta - b)).
 * Tingkat kesulitan soal 1 sampai 5 dipetakan ke b = -1,5 sampai 1,5.
 * Setelah menjawab: theta += K * (s - p), K = 0,4 untuk 10 jawaban pertama lalu 0,2.
 * s = 1 untuk benar, 0,6 untuk benar dengan hint, 0 untuk belum tepat.
 */

export type Difficulty = 1 | 2 | 3 | 4 | 5

const B_MAP: Record<Difficulty, number> = { 1: -1.5, 2: -0.75, 3: 0, 4: 0.75, 5: 1.5 }

export function difficultyToB(d: number): number {
  const k = Math.min(5, Math.max(1, Math.round(d))) as Difficulty
  return B_MAP[k]
}

export function pCorrect(theta: number, b: number): number {
  return 1 / (1 + Math.exp(-(theta - b)))
}

export type Outcome = { correct: boolean; hintsUsed: number }

export function outcomeScore(o: Outcome): number {
  if (!o.correct) return 0
  return o.hintsUsed > 0 ? 0.6 : 1
}

export function learningRate(answersSoFar: number): number {
  return answersSoFar < 10 ? 0.4 : 0.2
}

export const THETA_MIN = -4
export const THETA_MAX = 4

export function updateTheta(theta: number, answersSoFar: number, b: number, s: number): number {
  const p = pCorrect(theta, b)
  const next = theta + learningRate(answersSoFar) * (s - p)
  return Math.min(THETA_MAX, Math.max(THETA_MIN, next))
}

/** Tebakan awal theta dari grade learner relatif ke grade skill. */
export function initialTheta(learnerGrade: number, skillGrade: number): number {
  const diff = learnerGrade - skillGrade
  return Math.min(1.5, Math.max(-1.5, diff * 0.75))
}
