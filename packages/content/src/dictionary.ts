import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { dictEntryProblems, lookupWord, NO_LOOKUP_SKILLS, type DictFile } from '@kira/core/dictionary'
import type { Problem } from './load'

/**
 * Kamus Ketuk di sisi server dan pemeriksa konten. Berkas sumber: content/dictionary/en-id.json (lihat
 * scripts/dictionary). Server memuatnya sekali per proses; client memuat salinan ringkas dari public/dict.
 */

const FILE = ['dictionary', 'en-id.json']

let cached: { dir: string; dict: DictFile } | null = null

export function loadDictionary(contentDir: string): DictFile {
  if (cached && cached.dir === contentDir) return cached.dict
  const dict = JSON.parse(readFileSync(join(contentDir, ...FILE), 'utf8')) as DictFile
  cached = { dir: contentDir, dict }
  return dict
}

const SKIP_KEYS = new Set(['id', 'skill', 'type', 'tags', 'lang', 'kind', 'figure', 'subject', 'source', 'sourceId', 'strand', 'titleId', 'gen', 'seed'])

function* jsonFiles(dir: string): Generator<string> {
  if (!existsSync(dir)) return
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) yield* jsonFiles(p)
    else if (n.endsWith('.json')) yield p
  }
}

function collectWords(v: unknown, key: string, into: Map<string, { n: number; cap: number }>): void {
  if (typeof v === 'string') {
    if (SKIP_KEYS.has(key)) return
    for (const m of v.replace(/[‘’]/g, "'").matchAll(/[A-Za-z]+(?:'[A-Za-z]+)?/g)) {
      const lower = m[0].toLowerCase()
      const e = into.get(lower) ?? { n: 0, cap: 0 }
      e.n++
      if (m[0][0] !== lower[0]) e.cap++
      into.set(lower, e)
    }
    return
  }
  if (Array.isArray(v)) {
    for (const x of v) collectWords(x, key, into)
    return
  }
  if (v && typeof v === 'object') {
    if ((v as { lang?: unknown }).lang === 'id') return
    for (const [k, x] of Object.entries(v)) if (!SKIP_KEYS.has(k)) collectWords(x, k, into)
  }
}

/** Kata di konten yang dipakai paling sering tetapi tidak ketemu di kamus (bukan nama). */
export function missingContentWords(contentDir: string, dict: DictFile, minCount: number): { word: string; n: number }[] {
  const words = new Map<string, { n: number; cap: number }>()
  for (const sub of ['items', 'lessons', 'passages']) {
    for (const f of jsonFiles(join(contentDir, sub))) {
      try {
        collectWords(JSON.parse(readFileSync(f, 'utf8')), '', words)
      } catch {
        // JSON rusak dilaporkan oleh pemuat konten.
      }
    }
  }
  const out: { word: string; n: number }[] = []
  for (const [w, e] of words) {
    if (e.n < minCount || w.length < 3 || e.cap / e.n >= 0.5) continue
    if (!lookupWord(dict, w)) out.push({ word: w, n: e.n })
  }
  return out.sort((a, b) => b.n - a.n)
}

export const DICT_MIN_ENTRIES = 4500

/** content:check untuk kamus: bentuk tiap entri, peta bentuk, kata dasar yang hilang, dan cakupan kata yang sering dipakai. */
export function checkDictionary(contentDir: string, skillStrands?: ReadonlyMap<string, string>): Problem[] {
  const file = 'dictionary/en-id.json'
  const errors: Problem[] = []
  if (!existsSync(join(contentDir, ...FILE))) return [{ file, message: 'berkas kamus tidak ada' }]
  let dict: DictFile
  try {
    dict = JSON.parse(readFileSync(join(contentDir, ...FILE), 'utf8')) as DictFile
  } catch (e) {
    return [{ file, message: `JSON tidak valid: ${(e as Error).message}` }]
  }
  if (dict.v !== 1) errors.push({ file, message: 'versi kamus harus 1' })
  if (!dict.meta?.attribution || !dict.meta.licence) errors.push({ file, message: 'meta.attribution dan meta.licence wajib (lisensi Wiktionary CC BY-SA)' })
  const words = Object.keys(dict.entries ?? {})
  if (words.length < DICT_MIN_ENTRIES) errors.push({ file, message: `hanya ${words.length} entri, minimal ${DICT_MIN_ENTRIES}` })
  for (const w of words) {
    for (const p of dictEntryProblems(w, dict.entries[w])) errors.push({ file, message: `${w}: ${p}` })
  }
  for (const [f, l] of Object.entries(dict.forms ?? {})) {
    if (!dict.entries[l]) errors.push({ file, message: `bentuk ${f} menunjuk ke ${l} yang tidak ada` })
    if (dict.entries[f]) errors.push({ file, message: `bentuk ${f} juga entri sendiri` })
  }
  const missing = missingContentWords(contentDir, dict, 6)
  if (missing.length > 60) errors.push({ file, message: `${missing.length} kata yang muncul 6 kali atau lebih tidak ada di kamus: ${missing.slice(0, 20).map((m) => m.word).join(', ')}` })
  if (skillStrands) {
    const expected = [...skillStrands].filter(([id, strand]) => id.startsWith('e') && ['Rv', 'Wv', 'Rw', 'Ww'].includes(strand)).map(([id]) => id).sort()
    const have = [...NO_LOOKUP_SKILLS].sort()
    const a = expected.filter((x) => !have.includes(x))
    const b = have.filter((x) => !expected.includes(x))
    if (a.length) errors.push({ file, message: `skill kosakata belum ada di NO_LOOKUP_SKILLS: ${a.join(', ')}` })
    if (b.length) errors.push({ file, message: `NO_LOOKUP_SKILLS memuat skill yang bukan kosakata: ${b.join(', ')}` })
  }
  return errors
}
