import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { programSchema, programSkillIds, type Program } from './programs'
import { medalFileSchema, type MedalEntry } from './medals'
import { registrySchema, type Registry } from './sources'
import { skillGrade, skillSubject } from './schema'
import type { ContentIndex, Problem } from './load'

/**
 * Berkas konten di luar skill dan soal: registri sumber (content/sources/registry.json),
 * program olimpiade (content/programs/*.json), dan batas medali (content/competitions/medals.json).
 * Dibaca sekali per proses; kesalahan dikembalikan sebagai daftar masalah, tidak dilempar.
 */

function readJson(file: string, errors: Problem[], rel: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    errors.push({ file: rel, message: `JSON tidak valid: ${(e as Error).message}` })
    return undefined
  }
}

function zodText(e: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return e.issues
    .slice(0, 6)
    .map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`)
    .join('; ')
}

export function loadRegistry(dir: string): { registry: Registry | null; errors: Problem[] } {
  const errors: Problem[] = []
  const rel = 'sources/registry.json'
  const file = join(dir, rel)
  if (!existsSync(file)) return { registry: null, errors }
  const raw = readJson(file, errors, rel)
  if (raw === undefined) return { registry: null, errors }
  const parsed = registrySchema.safeParse(raw)
  if (!parsed.success) {
    errors.push({ file: rel, message: zodText(parsed.error) })
    return { registry: null, errors }
  }
  return { registry: parsed.data, errors }
}

export function loadPrograms(dir: string): { programs: Program[]; errors: Problem[] } {
  const errors: Problem[] = []
  const programs: Program[] = []
  const folder = join(dir, 'programs')
  if (!existsSync(folder)) return { programs, errors }
  for (const name of readdirSync(folder).sort()) {
    if (!name.endsWith('.json')) continue
    const rel = `programs/${name}`
    const raw = readJson(join(folder, name), errors, rel)
    if (raw === undefined) continue
    const parsed = programSchema.safeParse(raw)
    if (!parsed.success) errors.push({ file: rel, message: zodText(parsed.error) })
    else if (name !== `${parsed.data.id}.json`) errors.push({ file: rel, message: `Nama berkas harus ${parsed.data.id}.json` })
    else programs.push(parsed.data)
  }
  return { programs, errors }
}

export function loadMedals(dir: string): { entries: MedalEntry[]; errors: Problem[] } {
  const errors: Problem[] = []
  const rel = 'competitions/medals.json'
  const file = join(dir, rel)
  if (!existsSync(file)) return { entries: [], errors }
  const raw = readJson(file, errors, rel)
  if (raw === undefined) return { entries: [], errors }
  const parsed = medalFileSchema.safeParse(raw)
  if (!parsed.success) {
    errors.push({ file: rel, message: zodText(parsed.error) })
    return { entries: [], errors }
  }
  return { entries: parsed.data.entries, errors }
}

const BANNED_CHARS = /[—–]/

/** Pemeriksaan silang untuk content:check: skill program ada dan cocok mapel dan grade, id lomba ada di katalog. */
export function checkExtras(dir: string, index: ContentIndex): Problem[] {
  const out: Problem[] = []
  const competitionIds = new Set(index.competitions.map((c) => c.id))

  const { registry, errors: regErrors } = loadRegistry(dir)
  out.push(...regErrors)
  for (const s of registry?.sources ?? []) {
    if (s.competition && !competitionIds.has(s.competition)) out.push({ file: 'sources/registry.json', message: `${s.id}: lomba ${s.competition} tidak ada di katalog` })
    for (const t of [s.name, s.attribution, s.notes ?? '', s.licenseNote ?? '']) if (BANNED_CHARS.test(t)) out.push({ file: 'sources/registry.json', message: `${s.id}: ada em dash atau en dash` })
  }

  const { programs, errors: progErrors } = loadPrograms(dir)
  out.push(...progErrors)
  const seen = new Set<string>()
  for (const p of programs) {
    const file = `programs/${p.id}.json`
    if (seen.has(p.id)) out.push({ file, message: `id program kembar: ${p.id}` })
    seen.add(p.id)
    for (const c of p.competitions) if (!competitionIds.has(c)) out.push({ file, message: `lomba ${c} tidak ada di katalog` })
    for (const id of programSkillIds(p)) {
      if (!index.skills.has(id)) out.push({ file, message: `skill ${id} tidak ada` })
      else if (skillSubject(id) !== p.subject || skillGrade(id) !== p.grade) out.push({ file, message: `skill ${id} bukan ${p.subject} Grade ${p.grade}` })
    }
    for (const t of [p.title, p.summary, ...p.phases.flatMap((ph) => [ph.name, ph.focus, ph.summary, ph.note ?? ''])]) {
      if (BANNED_CHARS.test(t)) out.push({ file, message: 'ada em dash atau en dash' })
    }
  }

  const { entries, errors: medalErrors } = loadMedals(dir)
  out.push(...medalErrors)
  for (const e of entries) if (!competitionIds.has(e.competition)) out.push({ file: 'competitions/medals.json', message: `lomba ${e.competition} tidak ada di katalog` })
  return out
}
