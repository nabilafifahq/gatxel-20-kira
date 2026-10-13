import { MINI_PAPER_COUNT, type Rng } from '@kira/core'
import type { Subject } from '@/lib/dto'

/**
 * Logika murni pemilih paper harian (rencana 10.4 dan 10.5). Tidak menyentuh database;
 * daily-paper.ts menyiapkan data lalu memanggil fungsi di sini, dan tes unit memanggilnya langsung.
 *
 * Aturan:
 * - Hanya bagian paper yang belum dikerjakan learner (tumpang tindih soal dengan pilihan sebelumnya di bawah separuh).
 * - Lomba bergiliran: lomba yang paling lama tidak muncul didahulukan.
 * - Tahun 2021 ke atas didahulukan, lalu yang lebih baru.
 * - Hari Sabtu memakai paper penuh (paper utuh, atau semua bagian satu paper digabung).
 * - Pustaka tipis atau habis: "Paper gaya lomba buatan Kira" dari soal olimpiade dan draf AI yang sudah disetujui.
 */

export const PREFERRED_FROM_YEAR = 2021
export const KIRA_MADE_LABEL_ID = 'Paper gaya lomba buatan Kira'
export const KIRA_MADE_LABEL_EN = 'Kira-made contest-style paper'
/** Paper mini: 8 soal dalam 15 menit (rencana bagian 4), sama dengan sesi Paper harian di packages/core/src/session.ts. */
export const MINI_COUNT = MINI_PAPER_COUNT
export const FULL_COUNT = 24
export const MIN_PAPER_ITEMS = 5
const MINUTES_PER_ITEM = 1.5
/** Bagian paper dianggap sudah dikerjakan bila separuh soalnya atau lebih sudah pernah dipilih. */
export const SEEN_FRACTION = 0.5

export type LibraryEntry = {
  id: string
  competition: string | null
  year: number | null
  subject: Subject
  grade: number
  /** A, B, C, dan seterusnya, atau "penuh". */
  section: string
  title: string
  minutes: number
  source: string
  itemRefs: string[]
}

export type PickRecord = {
  competition: string | null
  year: number | null
  /** Tanggal belajar (YYYY-MM-DD). */
  date: string
  itemRefs: string[]
}

export type Candidate = {
  key: string
  libraryId: string | null
  competition: string | null
  year: number | null
  title: string
  minutes: number
  source: string
  itemRefs: string[]
  /** Urutan bagian di dalam satu paper (A sebelum B), untuk memutus seri. */
  order: number
}

export function minutesFor(count: number): number {
  return Math.max(5, Math.ceil(count * MINUTES_PER_ITEM))
}

export function sectionOrder(section: string): number {
  if (section === 'penuh') return 1000
  if (/^\d+$/.test(section)) return Number(section)
  return section.toUpperCase().charCodeAt(0) - 64
}

/** "IKMC 2023, Grade 2, part A" untuk learner (en-GB) dan konsol. */
export function paperTitle(p: { competition: string | null; year: number | null; grade: number; section: string; name?: string | null }): string {
  const part = p.section === 'penuh' ? 'full paper' : `part ${p.section.toUpperCase()}`
  // Tanpa lomba di katalog, nama paket (misalnya "Bebras Indonesia 2020 SD") yang dipakai; nama itu sudah memuat tahunnya.
  const own = p.competition ? null : p.name?.replace(/\.pdf$/i, '').replace(/\s+/g, ' ').trim() || null
  if (own) return `${own}, Grade ${p.grade}, ${part}`
  const name = p.competition ? p.competition.toUpperCase() : 'Contest paper'
  return `${name}${p.year ? ` ${p.year}` : ''}, Grade ${p.grade}, ${part}`
}

function toCandidate(e: LibraryEntry): Candidate {
  return { key: `lib:${e.id}`, libraryId: e.id, competition: e.competition, year: e.year, title: e.title, minutes: e.minutes, source: e.source, itemRefs: e.itemRefs, order: sectionOrder(e.section) }
}

/** Bagian paper (bukan paper penuh) untuk pilihan harian. */
export function miniCandidates(entries: readonly LibraryEntry[]): Candidate[] {
  return entries.filter((e) => e.section !== 'penuh' && e.itemRefs.length >= 3).map(toCandidate)
}

/**
 * Paper penuh: baris bersection "penuh", ditambah paper yang punya dua bagian atau lebih tanpa baris penuh
 * (bagian digabung berurutan, waktu dijumlahkan).
 */
export function fullCandidates(entries: readonly LibraryEntry[]): Candidate[] {
  const out: Candidate[] = entries.filter((e) => e.section === 'penuh' && e.itemRefs.length >= 3).map(toCandidate)
  const groups = new Map<string, LibraryEntry[]>()
  for (const e of entries) {
    if (e.section === 'penuh' || !e.competition) continue
    const k = `${e.competition}|${e.year ?? 'x'}|${e.grade}`
    groups.set(k, [...(groups.get(k) ?? []), e])
  }
  for (const [k, list] of groups) {
    const hasFull = entries.some((e) => e.section === 'penuh' && e.competition === list[0]!.competition && e.year === list[0]!.year && e.grade === list[0]!.grade)
    if (hasFull || list.length < 2) continue
    const sorted = [...list].sort((a, b) => sectionOrder(a.section) - sectionOrder(b.section))
    const refs = sorted.flatMap((e) => e.itemRefs)
    if (refs.length < MIN_PAPER_ITEMS) continue
    const first = sorted[0]!
    out.push({
      key: `grp:${k}`,
      libraryId: null,
      competition: first.competition,
      year: first.year,
      title: paperTitle({ competition: first.competition, year: first.year, grade: first.grade, section: 'penuh' }),
      minutes: sorted.reduce((s, e) => s + e.minutes, 0),
      source: first.source,
      itemRefs: refs,
      order: 1000,
    })
  }
  return out
}

function overlap(c: Candidate, seen: ReadonlySet<string>): number {
  if (c.itemRefs.length === 0) return 1
  return c.itemRefs.filter((r) => seen.has(r)).length / c.itemRefs.length
}

export type ChooseOptions = {
  /** Paper penuh di Sabtu minggu simulasi program: utamakan durasi di rentang ini. */
  window?: { min: number; max: number } | null
}

/** Pilih satu kandidat yang belum dikerjakan, atau null bila tidak ada. */
export function choosePaper(candidates: readonly Candidate[], picks: readonly PickRecord[], opts: ChooseOptions = {}): Candidate | null {
  const seen = new Set(picks.flatMap((p) => p.itemRefs))
  const eligible = candidates.filter((c) => overlap(c, seen) < SEEN_FRACTION)
  if (eligible.length === 0) return null
  // Hari terakhir setiap lomba dipilih; lomba yang belum pernah muncul diurutkan paling depan ('' lebih kecil dari tanggal).
  const lastUsed = new Map<string, string>()
  for (const p of picks) if (p.competition && p.date > (lastUsed.get(p.competition) ?? '')) lastUsed.set(p.competition, p.date)
  const rank = (c: Candidate) => {
    const inWindow = opts.window && c.minutes >= opts.window.min && c.minutes <= opts.window.max ? 0 : 1
    const preferred = c.year !== null && c.year >= PREFERRED_FROM_YEAR ? 0 : 1
    return { inWindow, preferred }
  }
  return [...eligible].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    return (
      ra.inWindow - rb.inWindow ||
      ra.preferred - rb.preferred ||
      (a.competition ? (lastUsed.get(a.competition) ?? '') : '').localeCompare(b.competition ? (lastUsed.get(b.competition) ?? '') : '') ||
      (b.year ?? 0) - (a.year ?? 0) ||
      overlap(a, seen) - overlap(b, seen) ||
      a.order - b.order ||
      a.key.localeCompare(b.key)
    )
  })[0]!
}

export type PoolItem = { ref: string; skillId: string; difficulty: number }

/**
 * Paper gaya lomba buatan Kira: soal yang belum pernah dipilih, bergiliran antar-skill supaya tersebar,
 * diurutkan dari kesulitan terendah seperti paper lomba. Null bila soal yang tersedia kurang dari MIN_PAPER_ITEMS.
 */
export function assembleKiraPaper(pool: readonly PoolItem[], count: number, picks: readonly PickRecord[], rng: Rng): { refs: string[]; minutes: number } | null {
  const seen = new Set(picks.flatMap((p) => p.itemRefs))
  const bySkill = new Map<string, PoolItem[]>()
  const unique = new Map<string, PoolItem>()
  for (const p of pool) if (!unique.has(p.ref)) unique.set(p.ref, p)
  // Soal baru lebih dulu; soal yang pernah muncul hanya mengisi kekurangan.
  const fresh = [...unique.values()].filter((p) => !seen.has(p.ref))
  const stale = [...unique.values()].filter((p) => seen.has(p.ref))
  const take = (items: readonly PoolItem[], limit: number): PoolItem[] => {
    bySkill.clear()
    for (const it of items) bySkill.set(it.skillId, [...(bySkill.get(it.skillId) ?? []), it])
    const queues = rng.shuffle([...bySkill.values()].map((q) => rng.shuffle(q)))
    const out: PoolItem[] = []
    while (out.length < limit && queues.some((q) => q.length > 0)) {
      for (const q of queues) {
        const x = q.shift()
        if (x && out.length < limit) out.push(x)
      }
    }
    return out
  }
  const chosen = take(fresh, count)
  if (chosen.length < count) chosen.push(...take(stale, count - chosen.length))
  if (chosen.length < MIN_PAPER_ITEMS) return null
  chosen.sort((a, b) => a.difficulty - b.difficulty || a.ref.localeCompare(b.ref))
  return { refs: chosen.map((c) => c.ref), minutes: minutesFor(chosen.length) }
}
