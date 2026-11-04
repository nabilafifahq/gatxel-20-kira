import 'server-only'
import type { Tx } from '../db'
import { resolveItems } from './content'
import { guardAttemptItems } from './session-guard'

/**
 * Penjaga soal ganda untuk sesi Latihan Bebas dan Ulasan singkat: lewat pintu pusat guardAttemptItems
 * (session-guard.ts), sama dengan semua pembuat sesi lain. Mengembalikan ref yang lolos, urutan tetap.
 * buildQuestItems sudah menjaga set-nya sendiri; pemeriksaan ini lapis kedua bila pemanggil menggabung sumber.
 */
export async function guardPracticeRefs(tx: Tx, learnerId: string, refs: string[]): Promise<string[]> {
  if (refs.length < 2) return refs
  const resolved = await resolveItems(tx, refs)
  const entries = refs.filter((r) => resolved.has(r)).map((ref, i) => ({ ref, difficulty: resolved.get(ref)!.difficulty, position: i + 1 }))
  const kept = await guardAttemptItems(tx, entries, { seed: `${learnerId}:practice:${refs.join('|').length}`, mode: 'latihan' })
  const keep = new Set(kept.map((k) => k.ref))
  return refs.filter((r) => keep.has(r))
}
