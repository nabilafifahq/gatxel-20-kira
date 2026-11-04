import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { findContentDir } from '../src/load'
import { itemSchema } from '../src/schema'
import { withWalkthrough } from '../src/walkthrough'

/**
 * Menulis pembahasan bergerak ke berkas JSON soal olimpiade (oly-*.json): langkah yang sudah ada diberi
 * gerakan (anim, mark) lewat penurun yang sama dengan runtime, lalu hasilnya disimpan sebagai data yang
 * bisa ditinjau. Hanya soal yang benar-benar mendapat gerakan atau langkah penutup yang diubah.
 * Jalankan: pnpm exec tsx packages/content/scripts/bake-olympiad-anim.ts
 */

const root = join(findContentDir(), 'items')
let files = 0
let changed = 0
let animated = 0

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') ? [p] : []
  })
}

for (const file of walk(root)) {
  if (!/[\\/]oly-[a-z0-9-]+\.json$/.test(file)) continue
  files++
  const text = readFileSync(file, 'utf8')
  const json = JSON.parse(text) as { items: Record<string, unknown>[] }
  let dirty = false
  for (const raw of json.items) {
    const parsed = itemSchema.safeParse(raw)
    if (!parsed.success) continue
    const out = withWalkthrough(parsed.data)
    if (!out.solution) continue
    const hasAnim = out.solution.some((s) => s.anim)
    if (hasAnim) animated++
    const before = JSON.stringify(raw.solution ?? null)
    const after = JSON.stringify(out.solution)
    if (hasAnim && before !== after) {
      raw.solution = out.solution
      dirty = true
      changed++
    }
  }
  if (dirty) writeFileSync(file, JSON.stringify(json, null, 2) + (text.endsWith('\n') ? '\n' : ''))
}
console.log(`Berkas ${files}, soal olimpiade ber-gerakan ${animated}, diubah ${changed}`)
