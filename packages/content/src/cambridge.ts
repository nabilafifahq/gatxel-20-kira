import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { SUBJECTS, type Subject } from './schema'
import type { ContentIndex, Problem } from './load'

/**
 * Pemetaan skill Kira ke kode kerangka Cambridge Primary (Math 0096, English 0058, Science 0097).
 * Berkas content/curriculum/cambridge-map.json hanya memuat kode dan catatan pendek buatan sendiri,
 * bukan teks kerangka. Setiap skill wajib punya entri. Daftar `gaps` diturunkan dari pemetaan
 * dan harus sama persis dengan hasil hitung ulang, supaya tidak ada yang basi.
 */

export const MATCH_LEVELS = ['direct', 'partial', 'enrichment'] as const

const code = z.string().regex(/^[1-6][A-Za-z]{1,5}\.\d{2}$/)

export const cambridgeMapSchema = z
  .object({
    schema: z.literal(1),
    note: z.string(),
    frameworks: z.record(
      z.string(),
      z.object({ code: z.string(), title: z.string(), version: z.string(), published: z.string(), obtained: z.string() }).strict(),
    ),
    objectives: z.record(z.string(), z.record(z.string(), z.array(code))),
    skills: z.record(
      z.string(),
      z
        .object({
          match: z.enum(MATCH_LEVELS),
          direct: z.array(code),
          partial: z.array(code),
          stage: z.enum(['ahead', 'behind']).optional(),
          note: z.string().max(200).optional(),
        })
        .strict(),
    ),
    gapNotes: z.record(code, z.string().max(120)),
    gaps: z.record(z.string(), z.record(z.string(), z.array(code))),
  })
  .strict()

export type CambridgeMap = z.infer<typeof cambridgeMapSchema>

export function loadCambridgeMap(dir: string): { map: CambridgeMap | null; errors: Problem[] } {
  const rel = 'curriculum/cambridge-map.json'
  const file = join(dir, rel)
  if (!existsSync(file)) return { map: null, errors: [{ file: rel, message: 'berkas pemetaan Cambridge tidak ada' }] }
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    return { map: null, errors: [{ file: rel, message: `JSON tidak valid: ${(e as Error).message}` }] }
  }
  const parsed = cambridgeMapSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.issues
      .slice(0, 6)
      .map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    return { map: null, errors: [{ file: rel, message: msg }] }
  }
  return { map: parsed.data, errors: [] }
}

/** Objektif tanpa skill (langsung atau sebagian), per mapel dan tahap. */
export function computeGaps(map: CambridgeMap, subjectOf: (skillId: string) => Subject | undefined): Record<string, Record<string, string[]>> {
  const covered: Record<string, Set<string>> = {}
  for (const s of SUBJECTS) covered[s] = new Set()
  for (const [id, m] of Object.entries(map.skills)) {
    const subj = subjectOf(id)
    if (!subj) continue
    for (const c of [...m.direct, ...m.partial]) covered[subj]!.add(c)
  }
  const out: Record<string, Record<string, string[]>> = {}
  for (const s of SUBJECTS) {
    out[s] = {}
    for (const [stage, codes] of Object.entries(map.objectives[s] ?? {})) out[s]![stage] = codes.filter((c) => !covered[s]!.has(c))
  }
  return out
}

export function checkCambridgeMap(dir: string, index: ContentIndex): Problem[] {
  const rel = 'curriculum/cambridge-map.json'
  const { map, errors } = loadCambridgeMap(dir)
  if (!map) return errors
  const out: Problem[] = []
  const valid: Record<string, Set<string>> = {}
  for (const s of SUBJECTS) valid[s] = new Set(Object.values(map.objectives[s] ?? {}).flat())
  for (const s of SUBJECTS) {
    for (const [stage, codes] of Object.entries(map.objectives[s] ?? {})) {
      for (const c of codes) if (c[0] !== stage) out.push({ file: rel, message: `${s}: kode ${c} ada di tahap ${stage}` })
    }
  }
  for (const [id, skill] of index.skills) {
    const m = map.skills[id]
    if (!m) {
      out.push({ file: rel, message: `skill ${id} belum dipetakan ke kerangka Cambridge` })
      continue
    }
    const all = [...m.direct, ...m.partial]
    for (const c of all) if (!valid[skill.subject]!.has(c)) out.push({ file: rel, message: `${id}: kode ${c} tidak ada di kerangka ${skill.subject}` })
    const expected = all.length === 0 ? 'enrichment' : m.direct.length > 0 ? 'direct' : 'partial'
    if (m.match !== expected) out.push({ file: rel, message: `${id}: match ${m.match} tidak cocok dengan kode (seharusnya ${expected})` })
    if (m.match === 'enrichment' && all.length > 0) out.push({ file: rel, message: `${id}: skill enrichment tidak boleh punya kode` })
  }
  for (const id of Object.keys(map.skills)) if (!index.skills.has(id)) out.push({ file: rel, message: `entri ${id} tidak punya skill` })
  const gaps = computeGaps(map, (id) => index.skills.get(id)?.subject)
  if (JSON.stringify(gaps) !== JSON.stringify(map.gaps)) out.push({ file: rel, message: 'daftar gaps tidak sama dengan hasil hitung ulang, jalankan: pnpm tsx packages/content/scripts/cambridge-map.ts --write' })
  for (const c of Object.keys(map.gapNotes)) if (!Object.values(valid).some((s) => s.has(c))) out.push({ file: rel, message: `gapNotes: kode ${c} tidak dikenal` })
  for (const t of [map.note, ...Object.values(map.gapNotes), ...Object.values(map.skills).map((s) => s.note ?? '')]) {
    if (new RegExp("[\u2013\u2014]").test(t)) out.push({ file: rel, message: "ada em dash atau en dash" })
  }
  return out
}
