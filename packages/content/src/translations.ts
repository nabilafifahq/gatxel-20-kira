import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * Terjemahan bahasa Indonesia untuk penjelasan (pelajaran, ulasan, pembahasan). Isi bahasa Inggris tetap apa adanya.
 *
 *   content/translations/id/<mapel>/g<kelas>/<berkas>.json   { "entries": { "<hash>": { "en": "...", "id": "..." } } }
 *   content/translations/id/_shared.json                     kalimat tetap buatan kode (langkah pembahasan turunan)
 *
 * Kuncinya hash dari teks Inggris yang PERSIS. Teks Inggris yang berubah otomatis tidak menemukan terjemahannya, jadi anak
 * tetap membaca bahasa Inggris dan laporan mencatatnya sebagai usang. Tidak ada terjemahan yang keliru pasangan.
 * Modul ini memakai node:fs, jadi hanya untuk server dan skrip.
 */

export const TRANSLATION_DIR = 'translations/id'

/** Hash teks sumber. Teks tidak dirapikan: satu spasi yang berubah berarti teks baru. */
export function translationHash(en: string): string {
  return createHash('sha256').update(en, 'utf8').digest('hex').slice(0, 20)
}

export type TranslationEntry = { en: string; id: string }
export type TranslationFile = { entries: Record<string, TranslationEntry> }
/** Hash teks Inggris ke teks Indonesia. */
export type TranslationMap = ReadonlyMap<string, string>

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .sort()
    .flatMap((f) => {
      const p = join(dir, f)
      return statSync(p).isDirectory() ? jsonFiles(p) : p.endsWith('.json') ? [p] : []
    })
}

export function readTranslationFile(path: string): TranslationFile {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<TranslationFile>
  return { entries: raw.entries ?? {} }
}

export type TranslationProblem = { file: string; message: string }

/** Semua terjemahan. Entri yang hash-nya tidak cocok dengan teks Inggrisnya tidak dimuat. Urutan berkas tetap, jadi hasilnya tetap. */
export function loadTranslations(contentDir: string): { map: Map<string, string>; problems: TranslationProblem[] } {
  const map = new Map<string, string>()
  const problems: TranslationProblem[] = []
  const root = join(contentDir, TRANSLATION_DIR)
  for (const path of jsonFiles(root)) {
    const file = relative(root, path).split(sep).join('/')
    let parsed: TranslationFile
    try {
      parsed = readTranslationFile(path)
    } catch {
      problems.push({ file, message: 'Berkas terjemahan tidak bisa dibaca' })
      continue
    }
    for (const [hash, e] of Object.entries(parsed.entries)) {
      if (!e || typeof e.en !== 'string' || typeof e.id !== 'string' || !e.id.trim()) {
        problems.push({ file, message: `Entri ${hash} kosong atau bentuknya salah` })
        continue
      }
      if (translationHash(e.en) !== hash) {
        problems.push({ file, message: `Hash ${hash} tidak cocok dengan teks Inggrisnya` })
        continue
      }
      if (!map.has(hash)) map.set(hash, e.id)
    }
  }
  return { map, problems }
}

/**
 * Terjemahan teks Inggris yang persis ini, atau pola generatornya (kata sama persis, hanya angka yang berbeda).
 * Null bila belum ada: anak tetap membaca bahasa Inggris.
 */
export function lookupTranslation(map: TranslationMap, en: string | null | undefined): string | null {
  if (!en) return null
  const exact = map.get(translationHash(en))
  if (exact) return exact
  const { template, values } = templateOf(en)
  if (values.length === 0) return null
  const pattern = map.get(translationHash(template))
  return pattern ? fillTemplate(pattern, values) : null
}

/** Satu teks yang boleh diterjemahkan, dengan konteks untuk penerjemah. */
export type SourceText = { en: string; kind: 'lesson' | 'explanation' | 'solution' | 'why' | 'tip'; context?: string }
/**
 * Terjemahan yang tidak dibuatkan klip suara: suara Indonesia membaca kata Inggris dengan bunyi Indonesia, dan anak tidak boleh
 * belajar pelafalan yang salah. Teksnya tetap tampil; tombol suaranya tersembunyi hanya pada langkah itu. Isinya hash teks Indonesia.
 */
export const VOICE_HELD_FILE = '_voice-held.json'

export function loadVoiceHeld(contentDir: string): Set<string> {
  const path = join(contentDir, TRANSLATION_DIR, VOICE_HELD_FILE)
  if (!existsSync(path)) return new Set()
  return new Set((JSON.parse(readFileSync(path, 'utf8')) as { held?: string[] }).held ?? [])
}

const WORD_RE = /[A-Za-z']+/g
const NEVER_ENGLISH = new Set(['rp', 'cm', 'mm', 'km', 'kg', 'ml', 'tv'])

/**
 * Kata Inggris di luar kurung pada teks Indonesia: kata yang juga ada di teks sumber, bukan nama, bukan satuan.
 * Di luar mapel English, kata yang dikenal kamus Indonesia tidak dihitung (planet, magnet). Di mapel English semua kata yang sama dengan
 * sumbernya dihitung, karena itulah kata yang sedang diajarkan, termasuk yang kebetulan juga kata Indonesia (cat, dan).
 */
export function englishOutsideBrackets(id: string, en: string, opts: { strict: boolean; notIndonesian: ReadonlySet<string>; names: ReadonlySet<string> }): string[] {
  const source = new Set((en.match(WORD_RE) ?? []).map((w) => w.toLowerCase()))
  const outside = id.replace(/\([^()]*\)/g, ' ').match(WORD_RE) ?? []
  return outside.filter((w) => {
    const l = w.toLowerCase()
    if (l.length < 2 || NEVER_ENGLISH.has(l) || !source.has(l) || opts.names.has(l)) return false
    return opts.strict || opts.notIndonesian.has(l)
  })
}

/** Berkas pola teks generator. Awalan _ berarti bukan pasangan berkas konten. */
export const GENERATOR_FILE = '_generator.json'
export type SourceFile = { subject: string; grade: number; file: string; texts: SourceText[] }

type RawItem = {
  prompt?: unknown
  explanation?: unknown
  tip?: unknown
  solution?: { say?: unknown }[]
  options?: { why?: unknown; text?: unknown }[]
  parts?: RawItem[]
  lang?: unknown
}

function itemTexts(it: RawItem, kinds: ReadonlySet<SourceText['kind']>): SourceText[] {
  // Soal berbahasa Indonesia tidak perlu diterjemahkan.
  if (it.lang === 'id') return []
  const prompt = typeof it.prompt === 'string' ? it.prompt.slice(0, 160) : undefined
  const ctx = prompt ? { context: prompt } : {}
  const out: SourceText[] = []
  if (kinds.has('explanation') && typeof it.explanation === 'string') out.push({ en: it.explanation, kind: 'explanation', ...ctx })
  if (kinds.has('solution')) for (const s of it.solution ?? []) if (typeof s.say === 'string') out.push({ en: s.say, kind: 'solution', ...ctx })
  if (kinds.has('tip') && typeof it.tip === 'string') out.push({ en: it.tip, kind: 'tip', ...ctx })
  if (kinds.has('why')) for (const o of it.options ?? []) if (typeof o.why === 'string') out.push({ en: o.why, kind: 'why', ...ctx, ...(typeof o.text === 'string' ? { context: `${prompt ?? ''} | opsi: ${o.text}` } : {}) })
  return out
}

/**
 * Teks sumber per berkas konten. Nama berkas terjemahan sama dengan nama berkas pelajaran dan soal pada mapel dan kelas itu.
 * Bawaan: semua yang tampil sebagai penjelasan.
 */
export function collectSourceTexts(contentDir: string, kinds: ReadonlySet<SourceText['kind']> = new Set(['lesson', 'explanation', 'solution', 'why', 'tip'])): SourceFile[] {
  const files = new Map<string, SourceFile>()
  const at = (top: string, path: string): SourceFile | null => {
    const m = /^([a-z]+)\/g(\d)\/(.+)\.json$/.exec(relative(join(contentDir, top), path).split(sep).join('/'))
    if (!m) return null
    const key = `${m[1]}/g${m[2]}/${m[3]}`
    const f = files.get(key) ?? { subject: m[1]!, grade: Number(m[2]), file: m[3]!, texts: [] }
    files.set(key, f)
    return f
  }
  for (const path of jsonFiles(join(contentDir, 'lessons'))) {
    const f = at('lessons', path)
    if (!f) continue
    const j = JSON.parse(readFileSync(path, 'utf8')) as { title?: string; steps?: { say?: unknown; show?: unknown }[]; check?: RawItem[] }
    if (kinds.has('lesson')) {
      for (const s of j.steps ?? []) {
        if (typeof s.say !== 'string') continue
        const show = typeof s.show === 'string' ? ` | di papan: ${s.show.slice(0, 80)}` : ''
        f.texts.push({ en: s.say, kind: 'lesson', context: `${j.title ?? ''}${show}` })
      }
    }
    for (const it of j.check ?? []) f.texts.push(...itemTexts(it, kinds))
  }
  for (const path of jsonFiles(join(contentDir, 'items'))) {
    const f = at('items', path)
    if (!f) continue
    const j = JSON.parse(readFileSync(path, 'utf8')) as { items?: RawItem[] } | RawItem[]
    const list = Array.isArray(j) ? j : (j.items ?? [])
    for (const it of list) {
      f.texts.push(...itemTexts(it, kinds))
      if (Array.isArray(it.parts)) for (const part of it.parts) f.texts.push(...itemTexts(part, kinds))
    }
  }
  return [...files.values()].sort((a, b) => `${a.subject}/${a.grade}/${a.file}`.localeCompare(`${b.subject}/${b.grade}/${b.file}`))
}

export type TranslationCoverage = {
  kind: SourceText['kind']
  total: number
  translated: number
}

export type TranslationReport = {
  coverage: TranslationCoverage[]
  /** Entri yang teks Inggrisnya sudah tidak ada di konten (terjemahan usang). */
  stale: { file: string; hash: string; en: string }[]
  problems: TranslationProblem[]
}

/** Cakupan per jenis teks dan entri usang. Dipakai content:check dan laporan. */
export function translationReport(contentDir: string): TranslationReport {
  const { map, problems } = loadTranslations(contentDir)
  const sources = collectSourceTexts(contentDir)
  const counts = new Map<SourceText['kind'], TranslationCoverage>()
  const live = new Set<string>()
  for (const f of sources) {
    for (const t of f.texts) {
      const hash = translationHash(t.en)
      live.add(hash)
      const row = counts.get(t.kind) ?? { kind: t.kind, total: 0, translated: 0 }
      row.total++
      if (map.has(hash)) row.translated++
      counts.set(t.kind, row)
    }
  }
  const stale: TranslationReport['stale'] = []
  const root = join(contentDir, TRANSLATION_DIR)
  for (const path of jsonFiles(root)) {
    const file = relative(root, path).split(sep).join('/')
    if (file.startsWith('_')) continue
    let parsed: TranslationFile
    try {
      parsed = readTranslationFile(path)
    } catch {
      continue
    }
    for (const [hash, e] of Object.entries(parsed.entries)) if (!live.has(hash)) stale.push({ file, hash, en: e?.en ?? '' })
  }
  return { coverage: [...counts.values()], stale, problems }
}

/**
 * Pola teks buatan generator: angka diganti {0}, {1}, dan seterusnya, supaya satu terjemahan berlaku untuk semua soal dari
 * generator yang sama. Hanya angka yang boleh berbeda; kata lain harus sama persis dengan polanya.
 */
export function templateOf(text: string): { template: string; values: string[] } {
  const values: string[] = []
  const template = text.replace(/\d+(?:[.,:/]\d+)*/g, (m) => `{${values.push(m) - 1}}`)
  return { template, values }
}

/** Isi kembali angka ke terjemahan pola. Null bila terjemahan memakai nomor yang tidak ada. */
export function fillTemplate(id: string, values: readonly string[]): string | null {
  let ok = true
  const out = id.replace(/\{(\d+)\}/g, (_, i: string) => {
    const v = values[Number(i)]
    if (v === undefined) ok = false
    return v ?? ''
  })
  return ok ? out : null
}
