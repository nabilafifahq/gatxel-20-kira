import 'server-only'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { tables } from '@kira/db'
import { answerText, itemSchema, MANUAL_TYPES, presentItem, skillGrade, skillSubject, STRAND_NAMES, type ClientItem, type Item, type Lesson, type Passage, type Preset, type Skill, type Subject } from '@kira/content'
import { GENERATORS, generateItem, isGenRef } from '@kira/content/math'
import { loadContent, type ContentIndex } from '@kira/content/load'
import type { Tx } from '../db'
import { log } from '../log'

/**
 * Konten repo dimuat sekali per proses dari folder content/ (KIRA_CONTENT_DIR).
 * Soal privat org (impor, draf AI yang disetujui) dibaca dari tabel org_item dengan ref "org:<uuid>".
 */
const g = globalThis as unknown as { __kiraContent?: ContentIndex }

export function content(): ContentIndex {
  if (g.__kiraContent) return g.__kiraContent
  const started = Date.now()
  const { index, errors } = loadContent()
  if (errors.length > 0) log.error('konten repo punya error, soal yang rusak dilewati', { count: errors.length, first: errors.slice(0, 5) })
  log.info('konten dimuat', { skills: index.skills.size, items: index.items.size, lessons: index.lessons.size, ms: Date.now() - started })
  g.__kiraContent = index
  return index
}

export function skill(id: string): Skill | undefined {
  return content().skills.get(id)
}

export function skillsFor(subject: Subject, grade: number): Skill[] {
  return content().skillsByKey.get(`${subject}:${grade}`) ?? []
}

export function lesson(skillId: string): Lesson | undefined {
  return content().lessons.get(skillId)
}

export function passage(id: string | undefined): Passage | undefined {
  return id ? content().passages.get(id) : undefined
}

export function presets(): Preset[] {
  return content().presets
}

export function preset(id: string): Preset | undefined {
  return content().presets.find((p) => p.id === id)
}

export function competitions() {
  return content().competitions
}

export function strandName(code: string): string {
  return STRAND_NAMES[code]?.en ?? code
}

export function strandNameId(code: string): string {
  return STRAND_NAMES[code]?.id ?? code
}

export const ORG_REF = /^org:([0-9a-f-]{36})$/

/** Ambil soal dari ref apa pun. Soal org butuh transaksi tenant. */
export async function resolveItems(tx: Tx, refs: readonly string[]): Promise<Map<string, Item>> {
  const out = new Map<string, Item>()
  const orgIds: string[] = []
  for (const ref of refs) {
    if (out.has(ref)) continue
    if (isGenRef(ref)) {
      try {
        out.set(ref, generateItem(ref))
      } catch (e) {
        log.error('soal generator gagal dibangun', { ref, error: e })
      }
      continue
    }
    const m = ORG_REF.exec(ref)
    if (m) {
      orgIds.push(m[1]!)
      continue
    }
    const item = content().items.get(ref) ?? lessonCheckItem(ref)
    if (item) out.set(ref, item)
  }
  if (orgIds.length > 0) {
    const rows = await tx
      .select({ id: tables.orgItem.id, body: tables.orgItem.body })
      .from(tables.orgItem)
      .where(and(inArray(tables.orgItem.id, orgIds), isNull(tables.orgItem.retiredAt)))
    for (const r of rows) {
      const parsed = itemSchema.safeParse({ ...(r.body as object), id: `org:${r.id}` })
      if (parsed.success) out.set(`org:${r.id}`, parsed.data)
      else log.warn('soal org tidak valid', { id: r.id })
    }
  }
  return out
}

function lessonCheckItem(ref: string): Item | undefined {
  const skillId = ref.split('.').slice(0, 2).join('.')
  return lesson(skillId)?.check.find((c) => c.id === ref)
}

/** Soal untuk perangkat learner. includeKey hanya untuk mode latihan. */
export function toClient(item: Item, opts: { ref: string; seed: string; includeKey: boolean; includeHints: boolean }): ClientItem {
  return presentItem(item, {
    ref: opts.ref,
    seed: opts.seed,
    includeKey: opts.includeKey,
    includeHints: opts.includeHints,
    answerText: answerText(item),
    ...(item.passage && passage(item.passage) ? { passage: passage(item.passage)! } : {}),
  })
}

export type PoolCandidate = { ref: string; difficulty: number; unlimited?: boolean; manual?: boolean }

/** Kandidat soal untuk satu skill: soal repo, soal org, dan tingkat generator. */
export async function poolForSkill(tx: Tx, orgId: string, skillId: string, opts: { allowManual: boolean }): Promise<PoolCandidate[]> {
  const out: PoolCandidate[] = []
  for (const item of content().itemsBySkill.get(skillId) ?? []) {
    const manual = MANUAL_TYPES.includes(item.type)
    if (manual && !opts.allowManual) continue
    if (item.type === 'draw') continue
    if (item.lang === 'id' && !item.tags.includes('esmo') && !item.tags.includes('kmnr')) continue
    out.push({ ref: item.id, difficulty: item.difficulty, manual })
  }
  const orgRows = await tx
    .select({ id: tables.orgItem.id, body: tables.orgItem.body })
    .from(tables.orgItem)
    .where(and(eq(tables.orgItem.orgId, orgId), eq(tables.orgItem.skillId, skillId), isNull(tables.orgItem.retiredAt)))
  for (const r of orgRows) {
    const body = r.body as { difficulty?: number; type?: string }
    if (body.type && MANUAL_TYPES.includes(body.type as Item['type']) && !opts.allowManual) continue
    out.push({ ref: `org:${r.id}`, difficulty: body.difficulty ?? 3 })
  }
  const gen = GENERATORS.get(skillId)
  if (gen) for (const level of gen.levels) out.push({ ref: `gen:${skillId}:${level}`, difficulty: level, unlimited: true })
  return out
}

export function subjectOfSkill(skillId: string): Subject {
  return skillSubject(skillId)
}

export function gradeOfSkill(skillId: string): number {
  return skillGrade(skillId)
}

export function itemTitle(item: Item): string {
  const s = skill(item.skill)
  return s?.title ?? item.skill
}

export function promptPreview(item: Item, max = 90): string {
  const flat = item.prompt.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}
