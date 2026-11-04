import { createRng } from '@kira/core/rng'

/**
 * Memilih soal untuk lembar kerja: tanpa pengulangan dalam satu lembar, naik dari mudah ke sulit, dan sama persis
 * setiap kali dibuka ulang (seed = id lembar). Soal repo dan soal org dipakai lebih dulu, sisanya dari generator.
 */

export const WORKSHEET_LENGTHS = [
  { id: 'short', label: 'Pendek, 6 soal', count: 6 },
  { id: 'medium', label: 'Sedang, 10 soal', count: 10 },
  { id: 'long', label: 'Panjang, 15 soal', count: 15 },
] as const

export const WORKSHEET_PER_DAY = 10

export type StaticCandidate = { ref: string; difficulty: number; sig: string }
export type GenSpec = { skillId: string; levels: readonly number[] }

/** Rentang kesulitan menurut bintang anak di skill itu: lembar tidak mulai terlalu sulit. */
export function difficultyBand(stars: number): [number, number] {
  return stars >= 3 ? [3, 5] : stars === 2 ? [2, 4] : [1, 3]
}

export function normalizePrompt(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

export type Picked = { ref: string; difficulty: number }

export function chooseWorksheetRefs(input: {
  count: number
  stars: number
  seed: string
  statics: readonly StaticCandidate[]
  gen: GenSpec | null
  /** Tanda pengenal instans generator (instanceSignature) dan pembuat ref; disuntik supaya modul ini murni. */
  genRef: (skillId: string, level: number, seed: string) => string
  genSig: (ref: string) => string
}): Picked[] {
  const rng = createRng(`lembar:${input.seed}`)
  const [lo, hi] = difficultyBand(input.stars)
  const seen = new Set<string>()
  const out: Picked[] = []

  const distance = (d: number) => (d < lo ? lo - d : d > hi ? d - hi : 0)
  const shuffled = rng.shuffle([...input.statics])
  // Soal dalam rentang lebih dulu, lalu yang terdekat dengan rentang. Urutan acak dipertahankan di dalam kelompok.
  const ordered = shuffled.map((s, i) => ({ s, i })).sort((a, b) => distance(a.s.difficulty) - distance(b.s.difficulty) || a.i - b.i)
  // Bila generator ada, soal repo hanya mengisi separuh supaya lembar tetap segar dan bervariasi.
  const staticLimit = input.gen ? Math.ceil(input.count / 2) : input.count
  for (const { s } of ordered) {
    if (out.length >= staticLimit) break
    if (seen.has(s.sig)) continue
    seen.add(s.sig)
    out.push({ ref: s.ref, difficulty: s.difficulty })
  }

  if (input.gen) {
    const levels = input.gen.levels.filter((l) => l >= lo && l <= hi)
    const useLevels = levels.length > 0 ? levels : [...input.gen.levels]
    let guard = 0
    while (out.length < input.count && guard++ < input.count * 40) {
      const level = useLevels[(out.length + guard) % useLevels.length]!
      const ref = input.genRef(input.gen.skillId, level, rng.int(0, 2 ** 31 - 1).toString(36))
      const sig = input.genSig(ref)
      if (seen.has(sig)) continue
      seen.add(sig)
      out.push({ ref, difficulty: level })
    }
  }
  // Bila generator tidak cukup (atau tidak ada), isi dari sisa soal repo.
  if (out.length < input.count) {
    for (const { s } of ordered) {
      if (out.length >= input.count) break
      if (seen.has(s.sig)) continue
      seen.add(s.sig)
      out.push({ ref: s.ref, difficulty: s.difficulty })
    }
  }
  // Naik dari mudah ke sulit; urutan sama untuk kesulitan yang sama.
  return out.map((p, i) => ({ p, i })).sort((a, b) => a.p.difficulty - b.p.difficulty || a.i - b.i).map((x) => x.p)
}
