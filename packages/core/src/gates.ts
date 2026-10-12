/**
 * Gerbang penguasaan skill.
 * Kurang dari 10 jawaban: new, 0 bintang.
 * Akurasi 20 jawaban terakhir >= 85% dan theta >= 0,5: mastered, 3 bintang.
 * 70% sampai 84%: review, 2 bintang.
 * Di bawah 70%: reteach, 1 bintang.
 * Jawaban benar dengan hint dihitung 0,6 benar.
 */

export type Gate = 'new' | 'reteach' | 'review' | 'mastered'

export type GateResult = { gate: Gate; stars: 0 | 1 | 2 | 3; accuracy: number | null }

export const GATE_MIN_ANSWERS = 10
export const GATE_WINDOW = 20

export function recentAccuracy(recentScores: readonly number[]): number | null {
  const window = recentScores.slice(-GATE_WINDOW)
  if (window.length === 0) return null
  return window.reduce((a, b) => a + b, 0) / window.length
}

export function computeGate(input: { nAnswers: number; recentScores: readonly number[]; theta: number }): GateResult {
  const accuracy = recentAccuracy(input.recentScores)
  if (input.nAnswers < GATE_MIN_ANSWERS || accuracy === null) return { gate: 'new', stars: 0, accuracy }
  if (accuracy >= 0.85 && input.theta >= 0.5) return { gate: 'mastered', stars: 3, accuracy }
  if (accuracy >= 0.7) return { gate: 'review', stars: 2, accuracy }
  return { gate: 'reteach', stars: 1, accuracy }
}

/** Simpan paling banyak GATE_WINDOW skor terakhir. */
export function pushRecent(recent: readonly number[], score: number): number[] {
  const out = [...recent, score]
  return out.length > GATE_WINDOW ? out.slice(out.length - GATE_WINDOW) : out
}
