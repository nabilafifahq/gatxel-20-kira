/**
 * Ringkasan ronde arena yang sudah dihapus retensi 90 hari (kolom arena_state.rolled, diisi kira_retention).
 * Rekor, jumlah ronde, dan lencana tetap dihitung dari rincian yang masih ada ditambah ringkasan ini.
 */
export type ArenaRolled = {
  rounds: number
  bestSprintPpm: number | null
  perfectSprint: boolean
  bestTargetMs: number | null
  speedBest: number
  perfectQuiz: boolean
}

export const EMPTY_ROLLED: ArenaRolled = { rounds: 0, bestSprintPpm: null, perfectSprint: false, bestTargetMs: null, speedBest: 0, perfectQuiz: false }

const num = (v: unknown, max: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : null)

export function normaliseRolled(v: unknown): ArenaRolled {
  if (typeof v !== 'object' || v === null) return { ...EMPTY_ROLLED }
  const o = v as Record<string, unknown>
  return {
    rounds: Math.floor(num(o.rounds, 1_000_000) ?? 0),
    bestSprintPpm: num(o.bestSprintPpm, 1000),
    perfectSprint: o.perfectSprint === true,
    bestTargetMs: num(o.bestTargetMs, 3_600_000),
    speedBest: Math.floor(num(o.speedBest, 1000) ?? 0),
    perfectQuiz: o.perfectQuiz === true,
  }
}

const maxOrNull = (a: number | null, b: number | null): number | null => (a === null ? b : b === null ? a : Math.max(a, b))
const minOrNull = (a: number | null, b: number | null): number | null => (a === null ? b : b === null ? a : Math.min(a, b))

/** Gabungkan rekor Quick Maths dari ronde yang masih ada dengan ringkasan lama. */
export function mergeQmRecords<T extends { rounds: number; bestSprintPpm: number | null; bestTargetSec: number | null }>(stats: T, rolled: ArenaRolled): T {
  return {
    ...stats,
    rounds: stats.rounds + rolled.rounds,
    bestSprintPpm: maxOrNull(stats.bestSprintPpm, rolled.bestSprintPpm),
    bestTargetSec: minOrNull(stats.bestTargetSec, rolled.bestTargetMs === null ? null : Math.round(rolled.bestTargetMs / 100) / 10),
  }
}
