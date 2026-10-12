import { createRng } from '@kira/core/rng'
import { itemSchema, SKILL_ID, type Item } from '../schema'
import type { Generator, Level } from './types'
import { generators as g1 } from './g1'
import { generators as g2 } from './g2'
import { generators as g3 } from './g3'
import { generators as g4 } from './g4'
import { generators as g5 } from './g5'
import { generators as g6 } from './g6'

export type { Generator, Level, GenContext, GeneratedItem } from './types'

const ALL: readonly Generator[] = [...g1, ...g2, ...g3, ...g4, ...g5, ...g6]

export const GENERATORS: ReadonlyMap<string, Generator> = new Map(ALL.map((g) => [g.skill, g]))

const GEN_REF = /^gen:([mes][1-6]\.[a-z0-9-]+):([1-5]):([a-z0-9]{1,16})$/

export function genRef(skill: string, level: Level, seed: string): string {
  return `gen:${skill}:${level}:${seed}`
}

export function isGenRef(ref: string): boolean {
  return ref.startsWith('gen:')
}

export function parseGenRef(ref: string): { skill: string; level: Level; seed: string } | null {
  const m = GEN_REF.exec(ref)
  if (!m || !SKILL_ID.test(m[1]!)) return null
  return { skill: m[1]!, level: Number(m[2]) as Level, seed: m[3]! }
}

/** Seed acak pendek base36 untuk instans baru. */
export function newSeed(rng: { int(min: number, max: number): number }): string {
  return rng.int(0, 2 ** 31 - 1).toString(36)
}

const cache = new Map<string, Item>()

/** Bangun ulang soal generator dari ref. Hasil selalu sama untuk ref yang sama. */
export function generateItem(ref: string): Item {
  const hit = cache.get(ref)
  if (hit) return hit
  const item = generateUncached(ref)
  if (cache.size > 5000) cache.clear()
  cache.set(ref, item)
  return item
}

/** Tanpa cache, dipakai pemeriksa determinisme. */
export function generateUncached(ref: string): Item {
  const parsed = parseGenRef(ref)
  if (!parsed) throw new Error(`Ref generator tidak valid: ${ref}`)
  const gen = GENERATORS.get(parsed.skill)
  if (!gen) throw new Error(`Generator tidak ada untuk skill ${parsed.skill}`)
  if (!gen.levels.includes(parsed.level)) throw new Error(`Generator ${parsed.skill} tidak punya tingkat ${parsed.level}`)
  const body = gen.generate({ rng: createRng(`${parsed.skill}:${parsed.level}:${parsed.seed}`), level: parsed.level })
  return itemSchema.parse({ ...body, id: ref, skill: parsed.skill, difficulty: parsed.level })
}
