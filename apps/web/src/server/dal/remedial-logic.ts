import { createRng } from '@kira/core'
import { genRef, instanceSignature, newSeed } from '@kira/content/math'
import type { Item } from '@kira/content'
import type { PoolCandidate } from './content'

export type SiblingInput = { wrong: Item; pool: readonly PoolCandidate[]; takenRefs: ReadonlySet<string>; seed: string }

/**
 * Pilih ref soal saudara. Generator dipakai bila ada (angka baru di tingkat yang sama atau terdekat, dan
 * instansnya belum ada di sesi); selain itu soal bank skill yang sama dengan tingkat
 * terdekat. Tidak pernah memilih ref yang sudah ada di sesi. Null bila tidak ada kandidat.
 */
export function pickSibling({ wrong, pool, takenRefs, seed }: SiblingInput): string | null {
  const rng = createRng(seed)
  const sigs = new Set<string>()
  for (const r of takenRefs) sigs.add(r.startsWith('gen:') ? instanceSignature(r) : r)
  const gens = pool.filter((c) => c.unlimited)
  if (gens.length > 0) {
    const best = [...gens].sort((x, y) => Math.abs(x.difficulty - wrong.difficulty) - Math.abs(y.difficulty - wrong.difficulty) || x.difficulty - y.difficulty)[0]!
    const m = /^gen:([mes][1-6]\.[a-z0-9-]+):([1-5])$/.exec(best.ref)
    if (m) {
      for (let i = 0; i < 40; i++) {
        const ref = genRef(m[1]!, Number(m[2]) as 1 | 2 | 3 | 4 | 5, newSeed(rng))
        if (takenRefs.has(ref)) continue
        if (sigs.has(instanceSignature(ref))) continue
        return ref
      }
    }
  }
  const bank = pool.filter((c) => !c.unlimited && !c.manual && !takenRefs.has(c.ref))
  if (bank.length === 0) return null
  const scored = bank.map((c) => ({ c, d: Math.abs(c.difficulty - wrong.difficulty), r: rng.int(0, 1_000_000) }))
  scored.sort((x, y) => x.d - y.d || x.r - y.r)
  return scored[0]!.c.ref
}
