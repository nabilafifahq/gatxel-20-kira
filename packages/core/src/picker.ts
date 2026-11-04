import { difficultyToB, pCorrect } from './ability'
import type { Rng } from './rng'

/**
 * Pemilih soal adaptif. Target peluang benar 0,75 sampai 0,85 untuk soal inti
 * dan 0,55 sampai 0,70 untuk soal tantangan. Soal yang pernah dilihat baru dipakai lagi setelah bank soal skill habis, yang paling lama dilihat lebih dulu.
 * Kandidat `unlimited` (generator Math) boleh dipilih lebih dari sekali dengan seed berbeda.
 */

export type Band = readonly [number, number]

export const CORE_BAND: Band = [0.75, 0.85]
export const LEARN_BAND: Band = [0.8, 0.9]
export const CHALLENGE_BAND: Band = [0.55, 0.7]
/** Latihan harian: soal mudah, peluang benar 85 sampai 95 persen. */
export const EASY_BAND: Band = [0.85, 0.95]
/** Tes harian: soal sedang sampai sulit, peluang benar 55 sampai 75 persen. */
export const TEST_BAND: Band = [0.55, 0.75]

export type Candidate = {
  ref: string
  difficulty: number
  unlimited?: boolean
  /** Berapa hari sejak terakhir dilihat learner; undefined berarti belum pernah. */
  seenDaysAgo?: number
}

export type Picked<C extends Candidate> = { candidate: C; p: number }

export function bandDistance(p: number, band: Band): number {
  if (p < band[0]) return band[0] - p
  if (p > band[1]) return p - band[1]
  return 0
}

/**
 * Soal yang pernah dilihat learner tidak muncul lagi selama masih ada soal yang belum pernah dilihat:
 * penalti 10 jauh di atas jarak pita (di bawah 1). Bila bank skill habis, soal dengan penglihatan
 * paling lama (seenDaysAgo terbesar) dipakai lebih dulu. Generator (unlimited) tidak dihukum.
 */
export const SEEN_TIER = 10

function seenPenalty(c: Candidate): number {
  if (c.unlimited || c.seenDaysAgo === undefined) return 0
  return SEEN_TIER + 1 / (1 + c.seenDaysAgo)
}

/** Kandidat yang belum pernah dilihat learner (generator selalu dianggap baru). */
export function unseenOnly<C extends Candidate>(candidates: readonly C[]): C[] {
  return candidates.filter((c) => c.unlimited || c.seenDaysAgo === undefined)
}

export function pickItems<C extends Candidate>(input: {
  candidates: readonly C[]
  theta: number
  count: number
  band: Band
  rng: Rng
  exclude?: ReadonlySet<string>
}): Picked<C>[] {
  const { candidates, theta, count, band, rng } = input
  const exclude = input.exclude ?? new Set<string>()
  const scored = candidates
    .filter((c) => !exclude.has(c.ref))
    .map((c) => {
      const p = pCorrect(theta, difficultyToB(c.difficulty))
      return { c, p, score: bandDistance(p, band) + seenPenalty(c) + rng.next() * 0.01 }
    })
    .sort((a, b) => a.score - b.score)

  const out: Picked<C>[] = []
  const used = new Set<string>()
  for (const s of scored) {
    if (out.length >= count) break
    if (used.has(s.c.ref)) continue
    used.add(s.c.ref)
    out.push({ candidate: s.c, p: s.p })
  }
  // Generator boleh dipakai berulang untuk mengisi sisa slot.
  if (out.length < count) {
    const unlimited = scored.filter((s) => s.c.unlimited)
    let i = 0
    while (out.length < count && unlimited.length > 0) {
      const s = unlimited[i % unlimited.length]!
      out.push({ candidate: s.c, p: s.p })
      i++
    }
  }
  return out
}
