import type { Rng } from '@kira/core/rng'
import type { ItemInput } from '../schema'

export type Level = 1 | 2 | 3 | 4 | 5

export type GenContext = { rng: Rng; level: Level }

/** Isi soal tanpa id, skill, dan difficulty (diisi oleh kerangka generator). */
export type GeneratedItem = DistributiveOmit<ItemInput, 'id' | 'skill' | 'difficulty'>

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

export type Generator = {
  /** Id skill, misalnya "m2.arrays". */
  skill: string
  /** Tingkat yang didukung, 1 (paling mudah) sampai 5. */
  levels: readonly Level[]
  generate(ctx: GenContext): GeneratedItem
}
