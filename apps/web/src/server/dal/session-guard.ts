import { guardSet } from '@kira/content'
import type { Tx } from '../db'
import { content, resolveItems } from './content'

type Entry = { ref: string; difficulty: number; position: number }

/**
 * Pintu tunggal untuk semua pembuat sesi: tidak ada dua soal yang sama dalam satu set (tanda tampilan, operan Math
 * yang sama, dan hampir kembar bila bank cukup). Soal yang bentrok diganti dari tingkat tetangga atau skill saudara,
 * dan bila tidak ada pengganti, set dipendekkan. Nomor urut dihitung ulang.
 */
export async function guardAttemptItems<T extends Entry>(tx: Tx, items: readonly T[], o: { seed: string; mode?: string; avoid?: ReadonlySet<string> }): Promise<T[]> {
  if (items.length < 2) return [...items]
  const resolved = await resolveItems(tx, items.map((i) => i.ref))
  const r = guardSet(items, {
    index: content(),
    items: resolved,
    seed: o.seed,
    ...(o.mode ? { mode: o.mode } : {}),
    ...(o.avoid ? { avoid: o.avoid } : {}),
  })
  return r.entries.map((e, i) => ({ ...e, position: i + 1 }))
}
