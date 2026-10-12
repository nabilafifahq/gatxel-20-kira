import 'server-only'
import { eq, isNull, sql } from 'drizzle-orm'
import { tables } from '@kira/db'
import { answerText, ITEM_TYPES, itemSchema, SKILL_ID, type ClientItem, type Item, type ItemType } from '@kira/content'
import { GENERATORS, generateItem, genRef, parseGenRef, type Level } from '@kira/content/math'
import type { ContentIndex } from '@kira/content/load'
import type { BankItemRow, ItemBankDTO, Subject } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import type { Tx } from '../db'
import { inOrg } from '../db'
import { log } from '../log'
import type { SearchParams } from '../params'
import { spEnum, spInt, spString } from '../params'
import { accuracyPct, SUBJECT_ORDER } from './console-common'
import { shellIn } from './console-shell'
import { content, promptPreview, toClient } from './content'

/**
 * T07 Bank soal dan kolam soal penyusun paper (T04).
 * Baris bank: soal repo (content/), soal privat org (org_item), dan satu baris per tingkat
 * generator (`gen:<skill>:<level>`, pratinjau dari instans ber-seed tetap). Daftar dibangun
 * di memori sekali per permintaan; statistik diambil dengan dua query ber-GROUP BY.
 */

const { response, problemReport, orgItem } = tables

export const BANK_PAGE_SIZE = 25
export const BANK_SOURCES = ['kira-original', 'imported', 'ai-draft', 'tutor', 'generator'] as const satisfies readonly BankItemRow['source'][]
const SUBJECTS: readonly Subject[] = ['math', 'english', 'science']

/** Seed tetap untuk pratinjau generator. Instans ini juga yang masuk paper lewat Tambah ke paper. */
export const PREVIEW_SEED = 'bank'

export type BankBase = Omit<BankItemRow, 'attempts' | 'accuracy' | 'reports'>

export type BankEntry = {
  row: BankBase
  /** Soal untuk pratinjau; untuk generator: instans ber-seed tetap. */
  item: Item
  /** Kunci statistik: ref soal, atau `gen:<skill>:<level>` untuk semua instans generator. */
  statKey: string
  /** Teks pencarian huruf kecil: ref, teks soal, judul skill. */
  haystack: string
  sort: [number, number, number, number, number, string]
}

export type BankStats = Map<string, { attempts: number; correct: number; graded: number; reports: number }>

export type BankData = { entries: BankEntry[]; byRef: Map<string, BankEntry>; stats: BankStats }

export type BankFilters = ItemBankDTO['filters']

const SOURCE_RANK: Record<BankItemRow['source'], number> = { 'kira-original': 0, imported: 1, tutor: 2, 'ai-draft': 3, generator: 4 }

function skillInfo(index: ContentIndex, skillId: string) {
  const s = index.skills.get(skillId)
  return { title: s?.title ?? skillId, titleId: s?.titleId ?? '', order: s?.order ?? 999 }
}

function subjectOf(skillId: string): Subject {
  return skillId[0] === 'm' ? 'math' : skillId[0] === 'e' ? 'english' : 'science'
}

function entryFor(index: ContentIndex, item: Item, ref: string, source: BankItemRow['source'], statKey: string, tags: string[], subject = subjectOf(item.skill), grade = Number(item.skill[1])): BankEntry {
  const sk = skillInfo(index, item.skill)
  return {
    row: {
      ref,
      subject,
      grade,
      skillId: item.skill,
      skillTitle: sk.title,
      type: item.type,
      difficulty: item.difficulty,
      promptPreview: promptPreview(item),
      source,
      tags,
    },
    item,
    statKey,
    haystack: `${ref} ${item.prompt} ${sk.title} ${sk.titleId}`.toLowerCase(),
    sort: [SUBJECT_ORDER.indexOf(subject), grade, sk.order, SOURCE_RANK[source], item.difficulty, ref],
  }
}

/** Ref instans generator yang dipakai pratinjau bank dan kolam paper. */
export function previewGenRef(skillId: string, level: number): string {
  return genRef(skillId, level as Level, PREVIEW_SEED)
}

/** `gen:<skill>:<level>` untuk ref instans generator, selain itu null. */
export function genCandidate(ref: string): string | null {
  const p = parseGenRef(ref)
  return p ? `gen:${p.skill}:${p.level}` : null
}

const g = globalThis as unknown as { __kiraBankStatic?: { index: ContentIndex; entries: BankEntry[] } }

/** Soal repo dan tingkat generator. Dibangun sekali per indeks konten (konten dimuat sekali per proses). */
function staticEntries(): BankEntry[] {
  const index = content()
  if (g.__kiraBankStatic?.index === index) return g.__kiraBankStatic.entries
  const out: BankEntry[] = []
  for (const item of index.items.values()) {
    // Soal cek pelajaran (<skill>.9NN) hanya dipakai di pelajaran, tidak masuk bank.
    if (/\.9\d\d$/.test(item.id)) continue
    out.push(entryFor(index, item, item.id, item.source, item.id, item.tags))
  }
  for (const [skillId, gen] of GENERATORS) {
    for (const level of gen.levels) {
      try {
        const inst = generateItem(previewGenRef(skillId, level))
        const cand = `gen:${skillId}:${level}`
        out.push(entryFor(index, inst, cand, 'generator', cand, inst.tags))
      } catch (e) {
        log.error('pratinjau generator gagal dibangun', { skillId, level, error: e })
      }
    }
  }
  sortEntries(out)
  g.__kiraBankStatic = { index, entries: out }
  return out
}

function sortEntries(list: BankEntry[]) {
  list.sort((a, b) => {
    for (let i = 0; i < 5; i++) {
      const d = (a.sort[i] as number) - (b.sort[i] as number)
      if (d !== 0) return d
    }
    return a.sort[5] < b.sort[5] ? -1 : a.sort[5] > b.sort[5] ? 1 : 0
  })
}

const STAT_KEY = sql<string>`case when ${response.itemRef} like 'gen:%' then split_part(${response.itemRef}, ':', 1) || ':' || split_part(${response.itemRef}, ':', 2) || ':' || split_part(${response.itemRef}, ':', 3) else ${response.itemRef} end`
const REPORT_KEY = sql<string>`case when ${problemReport.itemRef} like 'gen:%' then split_part(${problemReport.itemRef}, ':', 1) || ':' || split_part(${problemReport.itemRef}, ':', 2) || ':' || split_part(${problemReport.itemRef}, ':', 3) else ${problemReport.itemRef} end`

/** Dipakai (jawaban pertama) dan ketepatan jawaban pertama per soal, plus laporan terbuka. */
export async function bankStats(tx: Tx): Promise<BankStats> {
  const used = await tx
    .select({
      key: STAT_KEY,
      attempts: sql<number>`count(*) filter (where ${response.attemptNo} = 1)::int`,
      correct: sql<number>`count(*) filter (where ${response.attemptNo} = 1 and ${response.status} = 'correct')::int`,
      graded: sql<number>`count(*) filter (where ${response.attemptNo} = 1 and ${response.status} in ('correct', 'wrong'))::int`,
    })
    .from(response)
    .groupBy(sql`1`)
  const reports = await tx
    .select({ key: REPORT_KEY, n: sql<number>`count(*)::int` })
    .from(problemReport)
    .where(eq(problemReport.status, 'open'))
    .groupBy(sql`1`)
  const out: BankStats = new Map()
  for (const u of used) out.set(u.key, { attempts: u.attempts, correct: u.correct, graded: u.graded, reports: 0 })
  for (const r of reports) {
    const cur = out.get(r.key) ?? { attempts: 0, correct: 0, graded: 0, reports: 0 }
    out.set(r.key, { ...cur, reports: r.n })
  }
  return out
}

/** Soal privat org yang belum dipensiunkan, dalam bentuk baris bank. */
async function orgEntries(tx: Tx): Promise<BankEntry[]> {
  const index = content()
  const rows = await tx
    .select({ id: orgItem.id, skillId: orgItem.skillId, subject: orgItem.subject, grade: orgItem.grade, body: orgItem.body, source: orgItem.source, tags: orgItem.tags })
    .from(orgItem)
    .where(isNull(orgItem.retiredAt))
  const out: BankEntry[] = []
  for (const r of rows) {
    const ref = `org:${r.id}`
    const parsed = itemSchema.safeParse({ ...(r.body as object), id: ref })
    if (!parsed.success) {
      log.warn('soal org tidak valid, dilewati di bank soal', { id: r.id })
      continue
    }
    out.push(entryFor(index, parsed.data, ref, r.source, ref, r.tags, r.subject, r.grade))
  }
  return out
}

/** Semua baris bank untuk org ini, terurut mapel, grade, urutan kurikulum, sumber. */
export async function bankData(tx: Tx): Promise<BankData> {
  const [org, stats] = [await orgEntries(tx), await bankStats(tx)]
  const entries = [...staticEntries(), ...org]
  if (org.length) sortEntries(entries)
  return { entries, byRef: new Map(entries.map((e) => [e.row.ref, e])), stats }
}

export function withStats(row: BankBase, statKey: string, stats: BankStats): BankItemRow {
  const s = stats.get(statKey)
  return { ...row, attempts: s?.attempts ?? 0, accuracy: s ? accuracyPct(s.correct, s.graded) : null, reports: s?.reports ?? 0 }
}

/** Opsi pilihan ganda kembali ke urutan asli supaya huruf sama dengan kunci (answerText) dan LJK. */
export function presentForConsole(item: Item, opts: { ref: string; seed: string; withKey: boolean }): ClientItem {
  const c = toClient(item, { ref: opts.ref, seed: opts.seed, includeKey: opts.withKey, includeHints: opts.withKey })
  return c.options ? { ...c, options: [...c.options].sort((a, b) => a.i - b.i) } : c
}

// ---------------------------------------------------------------------------
// Filter dan pencarian

export function bankParams(sp: SearchParams): { filters: BankFilters; page: number; soal: string | null } {
  const skill = spString(sp, 'skill', 60)
  return {
    filters: {
      subject: spEnum(sp, 'mapel', SUBJECTS),
      grade: spInt(sp, 'grade', 1, 6),
      skillId: skill && SKILL_ID.test(skill) ? skill : null,
      type: spEnum(sp, 'tipe', ITEM_TYPES as readonly ItemType[]),
      difficulty: spInt(sp, 'kesulitan', 1, 5),
      source: spEnum(sp, 'sumber', BANK_SOURCES),
      q: (spString(sp, 'q', 80) ?? '').replace(/\s+/g, ' '),
    },
    page: spInt(sp, 'halaman', 1, 100000) ?? 1,
    soal: spString(sp, 'soal', 120),
  }
}

/** Kata kunci dipisah spasi; semua kata harus ada di ref, teks soal, atau judul skill. */
export function matchesQuery(haystack: string, q: string): boolean {
  const words = q.toLowerCase().split(' ').filter(Boolean)
  return words.every((w) => haystack.includes(w))
}

export function filterEntries(entries: readonly BankEntry[], f: BankFilters): BankEntry[] {
  // Laporan soal menyimpan ref instans generator (gen:<skill>:<level>:<seed>); barisnya di bank gen:<skill>:<level>.
  const q = f.q ? (genCandidate(f.q.trim()) ?? f.q) : ''
  return entries.filter(
    (e) =>
      (!f.subject || e.row.subject === f.subject) &&
      (!f.grade || e.row.grade === f.grade) &&
      (!f.skillId || e.row.skillId === f.skillId) &&
      (!f.type || e.row.type === f.type) &&
      (!f.difficulty || e.row.difficulty === f.difficulty) &&
      (!f.source || e.row.source === f.source) &&
      (!q || matchesQuery(e.haystack, q)),
  )
}

/** Skill yang punya soal di bank, untuk pilihan filter Skill. */
export function skillFacets(entries: readonly BankEntry[]): ItemBankDTO['facets']['skills'] {
  const seen = new Map<string, ItemBankDTO['facets']['skills'][number]>()
  for (const e of entries) if (!seen.has(e.row.skillId)) seen.set(e.row.skillId, { id: e.row.skillId, title: e.row.skillTitle, subject: e.row.subject, grade: e.row.grade })
  return [...seen.values()]
}

/** T07: satu halaman bank soal dengan filter, jumlah, faset skill, dan pratinjau. */
export async function itemBankDTO(actor: Actor, p: { learner: string | null; filters: BankFilters; page: number; soal: string | null }): Promise<ItemBankDTO> {
  return inOrg(orgCtx(actor), async (tx) => {
    const { shell } = await shellIn(tx, actor, p.learner)
    const bank = await bankData(tx)
    const matched = filterEntries(bank.entries, p.filters)
    const pages = Math.max(1, Math.ceil(matched.length / BANK_PAGE_SIZE))
    const page = Math.min(Math.max(1, p.page), pages)
    const slice = matched.slice((page - 1) * BANK_PAGE_SIZE, page * BANK_PAGE_SIZE)
    const rows = slice.map((e) => withStats(e.row, e.statKey, bank.stats))
    const sel = (p.soal ? (bank.byRef.get(p.soal) ?? bank.byRef.get(genCandidate(p.soal) ?? '')) : undefined) ?? slice[0]
    let preview: ItemBankDTO['preview'] = null
    if (sel) {
      const item = sel.item
      preview = {
        row: withStats(sel.row, sel.statKey, bank.stats),
        item: presentForConsole(item, { ref: item.id, seed: 'bank', withKey: true }),
        answerText: answerText(item),
        explanation: item.explanation,
        hints: item.hints,
      }
    }
    return { shell, rows, total: matched.length, page, pageSize: BANK_PAGE_SIZE, filters: p.filters, facets: { skills: skillFacets(bank.entries) }, preview }
  })
}
