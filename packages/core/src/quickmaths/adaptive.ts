/**
 * Level adaptif Quick Maths. Naik bila akurasi di atas 90 persen dan kecepatan tidak turun dari ronde
 * sebelumnya di level itu; turun bila akurasi di bawah 60 persen. Perlu sedikitnya 8 jawaban supaya tidak
 * bergeser karena satu ronde pendek.
 */
import { QM_MAX_LEVEL, QM_MIN_LEVEL, QM_OPS, type QmLevels, type QmOp } from './types'

export const ADAPT_MIN_ANSWERED = 8
export const ADAPT_UP_ACCURACY = 0.9
export const ADAPT_DOWN_ACCURACY = 0.6
/** Kecepatan boleh turun sedikit (5 persen) dari ronde sebelumnya dan tetap dihitung naik. */
export const ADAPT_SPEED_TOLERANCE = 0.95

export type OpRoundStat = { answered: number; correct: number; totalMs: number }

/** Jawaban benar per menit dari waktu menjawab. */
export function perMinute(correct: number, totalMs: number): number {
  if (totalMs <= 0) return 0
  return Math.round(((correct * 60000) / totalMs) * 10) / 10
}

export function nextLevel(input: { level: number; answered: number; correct: number; ppm: number; prevPpm: number | null; max?: number }): { level: number; change: -1 | 0 | 1 } {
  const max = input.max ?? QM_MAX_LEVEL
  const level = Math.max(QM_MIN_LEVEL, Math.min(max, Math.floor(input.level)))
  if (input.answered < ADAPT_MIN_ANSWERED) return { level, change: 0 }
  const accuracy = input.correct / input.answered
  const speedOk = input.prevPpm === null || input.prevPpm <= 0 || input.ppm >= input.prevPpm * ADAPT_SPEED_TOLERANCE
  if (accuracy > ADAPT_UP_ACCURACY && speedOk && level < max) return { level: level + 1, change: 1 }
  if (accuracy < ADAPT_DOWN_ACCURACY && level > QM_MIN_LEVEL) return { level: level - 1, change: -1 }
  return { level, change: 0 }
}

export type LevelChange = { op: QmOp; from: number; to: number }

/** Perbarui level semua operasi yang dimainkan dalam satu ronde otomatis. */
export function updateLevels(
  levels: QmLevels,
  perOp: Partial<Record<QmOp, OpRoundStat>>,
  prevPpm: Partial<Record<QmOp, number>>,
): { levels: QmLevels; ppm: Partial<Record<QmOp, number>>; changes: LevelChange[] } {
  const out: QmLevels = { ...levels }
  const ppm: Partial<Record<QmOp, number>> = {}
  const changes: LevelChange[] = []
  for (const op of QM_OPS) {
    const s = perOp[op]
    if (!s || s.answered === 0) continue
    const speed = perMinute(s.correct, s.totalMs)
    ppm[op] = speed
    const r = nextLevel({ level: levels[op], answered: s.answered, correct: s.correct, ppm: speed, prevPpm: prevPpm[op] ?? null })
    if (r.change !== 0) {
      out[op] = r.level
      changes.push({ op, from: levels[op], to: r.level })
    }
  }
  return { levels: out, ppm, changes }
}

/** Level Flash Anzan dan sempoa: naik pada 80 persen benar, turun pada 35 persen atau kurang. */
export function nextSimpleLevel(level: number, correct: number, total: number, max: number): number {
  if (total <= 0) return level
  const ratio = correct / total
  if (ratio >= 0.8 && level < max) return level + 1
  if (ratio <= 0.35 && level > 1) return level - 1
  return level
}

/** Level awal menurut kelas learner. */
export function initialQmLevels(grade: number): QmLevels {
  if (grade <= 1) return { add: 2, sub: 2, mul: 1, div: 1 }
  if (grade === 2) return { add: 3, sub: 3, mul: 2, div: 1 }
  if (grade === 3) return { add: 4, sub: 4, mul: 3, div: 3 }
  return { add: 5, sub: 5, mul: 4, div: 4 }
}
