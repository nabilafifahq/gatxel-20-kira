import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { itemFileSchema, type Item } from '../../packages/content/src/schema'

export const ROOT = fileURLToPath(new URL('../..', import.meta.url))

/** Semua soal di content/items, sudah lewat skema Zod (default terisi). */
export function allItems(): Item[] {
  const out: Item[] = []
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (f.endsWith('.json')) out.push(...itemFileSchema.parse(JSON.parse(readFileSync(p, 'utf8'))).items)
    }
  }
  walk(join(ROOT, 'content', 'items'))
  return out
}
