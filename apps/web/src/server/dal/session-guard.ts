import { guardSet } from '@kira/content'
import type { Tx } from '../db'
import { content, resolveItems } from './content'
import { spokenClipRefs } from './tts'

type Entry = { ref: string; difficulty: number; position: number }

const NO_FEEDBACK_MODES = new Set(['tes', 'simulasi', 'kertas'])

/**
 * Buang soal dengar dan eja yang klipnya belum ada: di mode tanpa kunci di perangkat soal itu tidak bisa diputar. Bila semua
 * soal terbuang, set dibiarkan dan layar menampilkan pesan, supaya sesi tidak kosong. Nomor urut dihitung ulang.
 */
export async function dropUnplayableAudio<T extends { ref: string; position: number }>(tx: Tx, items: readonly T[]): Promise<T[]> {
  const resolved = await resolveItems(tx, items.map((i) => i.ref))
  const kept: T[] = []
  for (const it of items) {
    const item = resolved.get(it.ref)
    const spoken = item ? await spokenClipRefs(item) : null
    if (!spoken || spoken.ready) kept.push(it)
  }
  if (kept.length === 0 || kept.length === items.length) return [...items]
  return kept.map((e, i) => ({ ...e, position: i + 1 }))
}

/**
 * Pintu tunggal untuk semua pembuat sesi: tidak ada dua soal yang sama dalam satu set (tanda tampilan, operan Math
 * yang sama, dan hampir kembar bila bank cukup). Soal yang bentrok diganti dari tingkat tetangga atau skill saudara,
 * dan bila tidak ada pengganti, set dipendekkan. Nomor urut dihitung ulang.
 */
export async function guardAttemptItems<T extends Entry>(tx: Tx, items: readonly T[], o: { seed: string; mode?: string; avoid?: ReadonlySet<string> }): Promise<T[]> {
  const playable = o.mode && NO_FEEDBACK_MODES.has(o.mode) ? await dropUnplayableAudio(tx, items) : items
  if (playable.length < 2) return [...playable]
  const resolved = await resolveItems(tx, playable.map((i) => i.ref))
  const r = guardSet(playable, {
    index: content(),
    items: resolved,
    seed: o.seed,
    ...(o.mode ? { mode: o.mode } : {}),
    ...(o.avoid ? { avoid: o.avoid } : {}),
  })
  return r.entries.map((e, i) => ({ ...e, position: i + 1 }))
}
