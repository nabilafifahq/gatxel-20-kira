/**
 * PRNG deterministik (mulberry32) untuk generator soal dan pemilih soal.
 * Seed yang sama selalu menghasilkan soal yang sama, jadi kunci jawaban bisa
 * dihitung ulang di server dari (generator, seed, tingkat).
 */

export type Rng = {
  next(): number
  int(min: number, max: number): number
  pick<T>(list: readonly T[]): T
  shuffle<T>(list: readonly T[]): T[]
  chance(p: number): boolean
  sample<T>(list: readonly T[], n: number): T[]
}

export function hashSeed(input: string): number {
  // FNV-1a 32 bit
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function createRng(seed: number | string): Rng {
  let a = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (min: number, max: number) => {
    if (max < min) throw new Error(`rng.int: max ${max} < min ${min}`)
    return min + Math.floor(next() * (max - min + 1))
  }
  const pick = <T>(list: readonly T[]): T => {
    if (list.length === 0) throw new Error('rng.pick: empty list')
    return list[Math.floor(next() * list.length)] as T
  }
  const shuffle = <T>(list: readonly T[]): T[] => {
    const out = list.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      ;[out[i], out[j]] = [out[j] as T, out[i] as T]
    }
    return out
  }
  const chance = (p: number) => next() < p
  const sample = <T>(list: readonly T[], n: number): T[] => shuffle(list).slice(0, Math.min(n, list.length))
  return { next, int, pick, shuffle, chance, sample }
}
