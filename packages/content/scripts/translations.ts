/**
 * Alat kerja terjemahan bahasa Indonesia.
 *
 *   tsx packages/content/scripts/translations.ts extract --out <dir> --kinds lesson [--subject math] [--grades 1,2,3] [--max-words 4000]
 *   tsx packages/content/scripts/translations.ts validate --in <batch.in.json> --out <batch.out.json>
 *   tsx packages/content/scripts/translations.ts merge --work <dir> [--dry]
 *   tsx packages/content/scripts/translations.ts report
 *
 * extract menulis berkas batch <dir>/<mapel>-g<kelas>-<nn>.in.json: daftar { k, en, kind, ctx } tanpa duplikat dan tanpa teks yang
 * sudah diterjemahkan. Penerjemah menulis <nama>.out.json: { "<k>": "teks Indonesia" }. Pembaca kedua boleh menulis <nama>.fix.json
 * dengan bentuk yang sama, yang menimpa out. merge menggabungkan semuanya ke content/translations/id dan menolak yang tidak lolos.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { findContentDir } from '../src/load'
import { collectSourceTexts, GENERATOR_FILE, readTranslationFile, TRANSLATION_DIR, translationHash, translationReport, type SourceText, type TranslationEntry } from '../src/translations'
import { splitSentences } from '../src/walkthrough'

const [cmd, ...rest] = process.argv.slice(2)
const { values } = parseArgs({
  args: rest,
  options: {
    out: { type: 'string' },
    in: { type: 'string' },
    work: { type: 'string' },
    kinds: { type: 'string' },
    subject: { type: 'string' },
    grades: { type: 'string' },
    'max-words': { type: 'string', default: '4000' },
    share: { type: 'string' },
    dry: { type: 'boolean', default: false },
    unreviewed: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
  },
})

const contentDir = findContentDir()
const words = (s: string) => s.trim().split(/\s+/).length

type BatchRow = { k: string; en: string; kind: SourceText['kind'] | 'template'; ctx?: string }

/** Bilangan di teks, supaya angka tidak berubah saat diterjemahkan. */
const numbersOf = (s: string) => (s.match(/\d+(?:[.,:/]\d+)*/g) ?? []).sort()

/** Masalah satu terjemahan. Masalah `hard` ditolak merge; `warn` hanya dilaporkan untuk dibaca pembaca kedua. */
export function checkTranslation(en: string, id: string): { hard: string[]; warn: string[] } {
  const hard: string[] = []
  const warn: string[] = []
  if (!id || !id.trim()) hard.push('kosong')
  // gtx-ignore-next-line dash
  if (/[–—]/.test(id)) hard.push('ada tanda pisah panjang')
  if (id !== id.trim()) hard.push('spasi di awal atau akhir')
  if (/\bAnda\b/.test(id)) warn.push('memakai Anda, seharusnya kamu')
  if (/\s{2,}/.test(id)) warn.push('spasi ganda')
  const a = numbersOf(en).join(' ')
  const b = numbersOf(id).join(' ')
  if (a !== b) warn.push(`angka berbeda: [${a}] jadi [${b}]`)
  const sa = splitSentences(en).length
  const sb = splitSentences(id).length
  if (sa !== sb) warn.push(`jumlah kalimat ${sa} jadi ${sb}`)
  for (const m of en.matchAll(/["'‘“]([^"'’”]{1,40})["'’”]/g)) {
    const q = m[1]!
    if (/\d|[A-Za-z]/.test(q) && !id.includes(q)) warn.push(`kutipan hilang: ${q}`)
  }
  return { hard, warn }
}

function readJson<T>(p: string): T {
  return JSON.parse(readFileSync(p, 'utf8')) as T
}

function outOf(inPath: string, suffix: string): string {
  return inPath.replace(/\.in\.json$/, suffix)
}

if (cmd === 'extract') {
  const out = values.out
  if (!out || !values.kinds) throw new Error('--out dan --kinds wajib')
  const kinds = new Set(values.kinds.split(',') as SourceText['kind'][])
  const grades = values.grades ? new Set(values.grades.split(',').map(Number)) : null
  const maxWords = Number(values['max-words'])
  mkdirSync(out, { recursive: true })
  const already = new Set<string>()
  for (const name of existsSync(join(contentDir, TRANSLATION_DIR)) ? translationHashes() : []) already.add(name)
  const seen = new Set<string>()
  const groups = new Map<string, BatchRow[]>()
  for (const f of collectSourceTexts(contentDir, kinds)) {
    if (values.subject && f.subject !== values.subject) continue
    if (grades && !grades.has(f.grade)) continue
    const key = `${f.subject}-g${f.grade}`
    const list = groups.get(key) ?? []
    groups.set(key, list)
    for (const t of f.texts) {
      const hash = translationHash(t.en)
      if (already.has(hash) || seen.has(hash)) continue
      seen.add(hash)
      list.push({ k: hash.slice(0, 10), en: t.en, kind: t.kind, ...(t.context ? { ctx: t.context } : {}) })
    }
  }
  let total = 0
  let totalWords = 0
  const names: string[] = []
  for (const [key, list] of groups) {
    let batch: BatchRow[] = []
    let n = 0
    let w = 0
    const flush = () => {
      if (batch.length === 0) return
      n++
      const name = `${key}-${String(n).padStart(2, '0')}.in.json`
      writeFileSync(join(out, name), JSON.stringify(batch, null, 0).replace(/\},\{/g, '},\n{') + '\n')
      names.push(`${name} ${batch.length} teks, ${w} kata`)
      batch = []
      w = 0
    }
    for (const r of list) {
      const rw = words(r.en)
      if (w + rw > maxWords) flush()
      batch.push(r)
      w += rw
      total++
      totalWords += rw
    }
    flush()
  }
  console.log(names.join('\n'))
  console.log(`Jumlah: ${total} teks unik, ${totalWords} kata, ${names.length} batch`)
} else if (cmd === 'extract-templates') {
  // Pola generator dari gen-templates-audit: --in daftar pola, --out folder batch, --share bagian kemunculan yang dicakup.
  if (!values.in || !values.out) throw new Error('--in dan --out wajib')
  const list = readJson<{ t: string; n: number; example: string }[]>(values.in)
  const total = list.reduce((a, r) => a + r.n, 0)
  const share = Number(values.share ?? '0.9')
  const maxWords = Number(values['max-words'])
  mkdirSync(values.out, { recursive: true })
  const already = new Set(translationHashes())
  let acc = 0
  let n = 0
  let w = 0
  let batch: BatchRow[] = []
  let count = 0
  let wordsAll = 0
  const flush = () => {
    if (batch.length === 0) return
    n++
    writeFileSync(join(values.out!, `pola-${String(n).padStart(2, '0')}.in.json`), JSON.stringify(batch).replace(/\},\{/g, '},\n{') + '\n')
    batch = []
    w = 0
  }
  for (const r of list) {
    if (acc / total >= share) break
    acc += r.n
    const hash = translationHash(r.t)
    if (already.has(hash)) continue
    const rw = words(r.t)
    if (w + rw > maxWords) flush()
    batch.push({ k: hash.slice(0, 10), en: r.t, kind: 'template', ctx: r.example.slice(0, 160) })
    w += rw
    count++
    wordsAll += rw
  }
  flush()
  console.log(`${count} pola, ${wordsAll} kata, ${n} batch, mencakup ${((acc / total) * 100).toFixed(1)}% kemunculan`)
} else if (cmd === 'validate') {
  if (!values.in) throw new Error('--in wajib')
  const rows = readJson<BatchRow[]>(values.in)
  const outPath = values.out ?? outOf(values.in, '.out.json')
  const fixPath = outOf(values.in, '.fix.json')
  const done = { ...readJson<Record<string, string>>(outPath), ...(existsSync(fixPath) ? readJson<Record<string, string>>(fixPath) : {}) }
  let hard = 0
  let warn = 0
  const keys = new Set(rows.map((r) => r.k))
  for (const k of Object.keys(done)) {
    if (!keys.has(k)) {
      console.log(`ASING ${k}: kunci ini tidak ada di batch`)
      hard++
    }
  }
  for (const r of rows) {
    const id = done[r.k]
    if (typeof id !== 'string') {
      console.log(`KURANG ${r.k}: ${r.en.slice(0, 80)}`)
      hard++
      continue
    }
    const p = checkTranslation(r.en, id)
    for (const m of p.hard) {
      console.log(`GAGAL ${r.k}: ${m}\n  en: ${r.en}\n  id: ${id}`)
      hard++
    }
    for (const m of p.warn) {
      console.log(`CEK ${r.k}: ${m}\n  en: ${r.en}\n  id: ${id}`)
      warn++
    }
  }
  console.log(`${rows.length} teks: ${hard} gagal, ${warn} perlu dicek`)
  if (hard > 0) process.exitCode = 1
} else if (cmd === 'merge') {
  if (!values.work) throw new Error('--work wajib')
  const byHash = new Map<string, string>()
  const walk = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.in.json') ? [join(d, e.name)] : []))
  let rejected = 0
  let accepted = 0
  let waiting = 0
  let batches = 0
  const templates: Record<string, TranslationEntry> = {}
  for (const inPath of walk(values.work).sort()) {
    const outPath = outOf(inPath, '.out.json')
    // Hanya batch yang sudah dibaca pembaca kedua, kecuali --unreviewed.
    if (!existsSync(outPath) || (!values.unreviewed && !existsSync(outOf(inPath, '.fix.json')))) {
      waiting++
      continue
    }
    batches++
    const fixPath = outOf(inPath, '.fix.json')
    const done = { ...readJson<Record<string, string>>(outPath), ...(existsSync(fixPath) ? readJson<Record<string, string>>(fixPath) : {}) }
    for (const r of readJson<BatchRow[]>(inPath)) {
      const id = done[r.k]
      if (typeof id !== 'string') continue
      if (checkTranslation(r.en, id).hard.length > 0) {
        rejected++
        continue
      }
      if (r.kind === 'template') templates[translationHash(r.en)] = { en: r.en, id }
      else byHash.set(translationHash(r.en), id)
      accepted++
    }
  }
  // Tiap berkas sumber mendapat semua teksnya yang punya terjemahan, termasuk terjemahan yang sudah ada sebelumnya.
  const root = join(contentDir, TRANSLATION_DIR)
  let written = 0
  let entriesTotal = 0
  for (const f of collectSourceTexts(contentDir)) {
    const path = join(root, f.subject, `g${f.grade}`, `${f.file}.json`)
    const prev = existsSync(path) ? readTranslationFile(path).entries : {}
    const entries: Record<string, TranslationEntry> = {}
    for (const t of f.texts) {
      const hash = translationHash(t.en)
      const id = byHash.get(hash) ?? prev[hash]?.id
      if (id) entries[hash] = { en: t.en, id }
    }
    if (Object.keys(entries).length === 0) continue
    entriesTotal += Object.keys(entries).length
    const body = JSON.stringify({ entries }, null, 1) + '\n'
    if (!values.dry) {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, body)
    }
    written++
  }
  if (Object.keys(templates).length > 0 && !values.dry) {
    const path = join(root, GENERATOR_FILE)
    const prev = existsSync(path) ? readTranslationFile(path).entries : {}
    writeFileSync(path, JSON.stringify({ entries: { ...prev, ...templates } }, null, 1) + '\n')
  }
  console.log(`Batch dipakai ${batches}, menunggu ${waiting}. Diterima ${accepted}, ditolak ${rejected}. Berkas ${written}, entri ${entriesTotal}.`)
  if (rejected > 0) process.exitCode = 1
} else if (cmd === 'report') {
  const r = translationReport(contentDir)
  if (values.json) console.log(JSON.stringify({ coverage: r.coverage, stale: r.stale.length, problems: r.problems.length }))
  else {
    for (const c of r.coverage) console.log(`${c.kind.padEnd(12)} ${String(c.translated).padStart(6)} / ${String(c.total).padStart(6)}  ${((c.translated / Math.max(1, c.total)) * 100).toFixed(1)}%`)
    console.log(`usang ${r.stale.length}, masalah ${r.problems.length}`)
  }
} else {
  throw new Error('Perintah: extract, validate, merge, report')
}

function translationHashes(): string[] {
  const root = join(contentDir, TRANSLATION_DIR)
  const out: string[] = []
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name))
      else if (e.name.endsWith('.json')) out.push(...Object.keys(readTranslationFile(join(d, e.name)).entries))
    }
  }
  walk(root)
  return out
}
