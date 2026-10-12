import type { ImportStoredItem } from '@kira/db'

/**
 * Pengurai teks paket soal resmi (hasil `pdftotext -layout`, satu string per halaman).
 * Bekerja tanpa AI. Mengenali:
 * - nomor soal `1.`, `1)`, `No. 1`, `Soal 1`, `Question 1`, berurutan (lompatan kecil boleh);
 * - opsi `A.`, `A)`, `(A)`, `a)` sampai E, satu per baris, sebaris, atau dua kolom;
 * - bagian kunci (`Kunci Jawaban`, `Kunci`, `Answer Key`, `Answers`, `Jawaban`) berbentuk
 *   `1. B`, `1) b`, `1 B`, `1 | B`, atau tabel baris nomor lalu baris huruf;
 * - kepala dan kaki halaman yang berulang serta nomor halaman, dibuang sebelum diurai.
 * Status per soal: needs-check (opsi kurang dari 2, opsi bolong, kunci di luar opsi, prompt
 * kosong atau terlalu panjang, atau menyebut gambar), leftover-key-text, broken-fraction, ok.
 * key-mismatch hanya diberikan oleh pemeriksaan AI terpisah.
 */

export type ImportParseResult = {
  items: ImportStoredItem[]
  keyFound: boolean
  keyEntries: number
}

type Line = { raw: string; page: number }
type Block = { number: number; page: number; firstRaw: string; pre: Line[]; lines: Line[] }

const LETTERS = 'ABCDE'
const PROMPT_MAX = 900

// ---------------------------------------------------------------------------
// Pembersihan halaman

const PAGE_NUMBER = /^\s*(?:(?:halaman|hal\.?|page)\s*\d{1,3}(?:\s*(?:dari|of|\/)\s*\d{1,3})?|[-\u2013\u2014(]?\s*\d{1,3}\s*[-\u2013\u2014)]?|\d{1,3}\s*\/\s*\d{1,3})\s*$/i

function normLine(s: string): string {
  return s.trim().toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ')
}

function looksStructural(s: string): boolean {
  return questionStart(s) !== null || optionMarkerAt(s.trimStart(), 0) !== null
}

/** Buang kepala/kaki halaman yang berulang di banyak halaman dan baris nomor halaman. */
export function cleanPages(pages: string[]): Line[] {
  const split = pages.map((p) => p.replace(/\r/g, '').replace(/\u00A0/g, ' ').replace(/\uFB01/g, 'fi').replace(/\uFB02/g, 'fl').split('\n'))
  const edgeIdx = (lines: string[]) => {
    const nonEmpty = lines.map((l, i) => (l.trim() ? i : -1)).filter((i) => i >= 0)
    return new Set([...nonEmpty.slice(0, 3), ...nonEmpty.slice(-3)])
  }
  const counts = new Map<string, number>()
  for (const lines of split) {
    const seen = new Set<string>()
    for (const i of edgeIdx(lines)) {
      const n = normLine(lines[i]!)
      if (n && !seen.has(n)) {
        seen.add(n)
        counts.set(n, (counts.get(n) ?? 0) + 1)
      }
    }
  }
  const threshold = Math.max(3, Math.ceil(split.length * 0.5))
  const out: Line[] = []
  split.forEach((lines, p) => {
    const edges = edgeIdx(lines)
    lines.forEach((raw, i) => {
      if (!raw.trim()) {
        out.push({ raw: '', page: p + 1 })
        return
      }
      if (edges.has(i) && !looksStructural(raw)) {
        if (split.length >= 3 && (counts.get(normLine(raw)) ?? 0) >= threshold) return
        if (PAGE_NUMBER.test(raw)) return
      }
      out.push({ raw: raw.replace(/\t/g, '    '), page: p + 1 })
    })
  })
  return out
}

// ---------------------------------------------------------------------------
// Nomor soal dan opsi

const Q_NUM = /^\s*(\d{1,3})\s*[.)](?:\s+(.*)|\s*)$/
const Q_WORD = /^\s*(?:no|nomor|soal|question)\s*\.?\s*(\d{1,3})\b\s*[.):]?\s*(.*)$/i

export function questionStart(raw: string): { n: number; rest: string } | null {
  const m = Q_NUM.exec(raw) ?? Q_WORD.exec(raw)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isInteger(n) || n < 1 || n > 200) return null
  return { n, rest: (m[2] ?? '').trim() }
}

type Marker = { letter: number; lower: boolean; start: number; end: number }

/** Penanda opsi tepat di posisi pos: "A. ", "A) ", "(A)", "a) ". */
function optionMarkerAt(s: string, pos: number): Marker | null {
  const re = /\(([A-Ea-e])\)\s*|([A-Ea-e])[.)](?:\s+|$)/y
  re.lastIndex = pos
  const m = re.exec(s)
  if (!m) return null
  const ch = (m[1] ?? m[2])!
  return { letter: LETTERS.indexOf(ch.toUpperCase()), lower: ch === ch.toLowerCase(), start: pos, end: pos + m[0].length }
}

/**
 * Cari semua penanda opsi di satu baris. Penanda pertama harus di awal baris (setelah spasi)
 * atau, bila `allowMid`, di tengah baris setelah minimal dua spasi. Penanda berikutnya diterima
 * bila hurufnya berikutnya dalam urutan (setelah spasi) atau belum terlihat (setelah dua spasi,
 * misalnya tata letak dua kolom A dan C sebaris).
 */
export function findMarkers(s: string, seen: Set<number>, expectLower: boolean | null, allowMid: boolean): Marker[] {
  const out: Marker[] = []
  const lead = s.length - s.trimStart().length
  let lower = expectLower
  const accept = (m: Marker | null): m is Marker => m !== null && !seen.has(m.letter) && !out.some((o) => o.letter === m.letter) && (lower === null || m.lower === lower)
  const first = optionMarkerAt(s, lead)
  if (accept(first)) {
    out.push(first)
    lower = first.lower
  } else if (!allowMid) return out
  for (let i = lead + 1; i < s.length; i++) {
    if (!/\s/.test(s[i - 1]!)) continue
    const m = optionMarkerAt(s, i)
    if (!accept(m)) continue
    const gap = /\s{2,}$/.test(s.slice(0, i))
    const prev = out.length ? out[out.length - 1]!.letter : null
    const inSequence = prev === null ? m.letter === 0 || (seen.size > 0 && m.letter === Math.max(...seen) + 1) : m.letter === prev + 1
    if (out.length === 0 && !gap && !inSequence) continue
    if (out.length > 0 && !inSequence && !gap) continue
    if (out.length === 0 && allowMid) {
      // Opsi di tengah baris hanya dipercaya bila diikuti penanda huruf berikutnya.
      const next = LETTERS[m.letter + 1]
      const n = m.lower ? next?.toLowerCase() : next
      if (!n || !new RegExp(`\\s(?:\\(${n}\\)|${n}[.)])\\s`).test(` ${s.slice(m.end)} `)) continue
    }
    out.push(m)
    lower = m.lower
    i = m.end - 1
  }
  return out
}

// ---------------------------------------------------------------------------
// Kunci jawaban

const KEY_HEADING = /^\s*(kunci\s+jawaban|kunci|answer\s+key|answers|jawaban|key)\b\s*[:.-]?\s*(.*)$/i
const KEY_ENTRY = /(?:^|[\s|;,])(\d{1,3})\s*(?:[.):=|-]\s*|\s+)\(?([A-Ea-e])\)?(?=$|[\s|;,.])/g
const LABEL_WORD = /^(no\.?|nomor|soal|number|question|jawaban|jwb\.?|kunci|answer|answers|key|ans\.?)$/i

function tableRow(raw: string): string[] {
  const tokens = raw.trim().split(/[\s|]+/).filter(Boolean)
  while (tokens.length && LABEL_WORD.test(tokens[0]!)) tokens.shift()
  return tokens
}

/** Entri kunci dari sekumpulan baris: nomor soal ke indeks opsi (A = 0). Entri pertama menang. */
export function parseKeyEntries(lines: string[], minTableColumns = 3): Map<number, number> {
  const key = new Map<number, number>()
  const used = new Set<number>()
  for (let i = 0; i < lines.length; i++) {
    if (used.has(i)) continue
    const nums = tableRow(lines[i]!)
    if (nums.length >= minTableColumns && nums.every((t) => /^\d{1,3}$/.test(t))) {
      let j = i + 1
      while (j < lines.length && !lines[j]!.trim()) j++
      const letters = j < lines.length ? tableRow(lines[j]!) : []
      if (letters.length === nums.length && letters.every((t) => /^[A-Ea-e]$/.test(t))) {
        nums.forEach((n, k) => {
          const num = Number(n)
          if (!key.has(num)) key.set(num, LETTERS.indexOf(letters[k]!.toUpperCase()))
        })
        used.add(j)
        continue
      }
    }
    for (const m of lines[i]!.matchAll(KEY_ENTRY)) {
      const num = Number(m[1])
      if (num >= 1 && num <= 200 && !key.has(num)) key.set(num, LETTERS.indexOf(m[2]!.toUpperCase()))
    }
  }
  return key
}

/** Baris yang isinya hanya entri kunci atau baris tabel nomor/huruf. */
function keyOnly(raw: string): boolean {
  const t = raw.trim()
  if (!t) return true
  const rest = t.replace(KEY_ENTRY, ' ').trim()
  if (/^[\s|;,.:]*$/.test(rest)) return true
  const tokens = tableRow(t)
  return tokens.length > 0 && (tokens.every((x) => /^\d{1,3}$/.test(x)) || tokens.every((x) => /^[A-Ea-e]$/.test(x)))
}

const KEY_LINE_START = /^\s*\d{1,3}\s*(?:[.):=|-]\s*|\s+)\(?[A-Ea-e]\)?(?=$|[\s|;,.])/

/**
 * Baris berurutan yang membentuk bagian kunci, mulai dari `from`. Entri boleh diikuti catatan
 * singkat ("1. B karena ..."); subjudul pendek ("Bagian B") dilewati; berhenti di baris lain.
 */
function keyRun(lines: Line[], from: number): number {
  let end = from
  let strays = 0
  for (let j = from; j < lines.length; j++) {
    const t = lines[j]!.raw.trim()
    if (!t || keyOnly(t) || KEY_LINE_START.test(t) || KEY_HEADING.test(t)) {
      end = j + 1
      strays = 0
      continue
    }
    if (t.length <= 30 && ++strays <= 2) continue
    break
  }
  return end
}

/** Letak bagian kunci: [start, end) baris (judul sampai entri terakhir) dan isinya. */
export function findKey(lines: Line[]): { start: number; end: number; key: Map<number, number> } | null {
  let best: { start: number; end: number; key: Map<number, number> } | null = null
  lines.forEach((l, i) => {
    const m = KEY_HEADING.exec(l.raw)
    if (!m || questionStart(l.raw)) return
    const rest = (m[2] ?? '').trim()
    if (rest && !keyOnly(rest) && (rest.length > 40 || /[?]$/.test(rest))) return
    const end = keyRun(lines, i + 1)
    const key = parseKeyEntries([rest, ...lines.slice(i + 1, end).map((x) => x.raw)], rest ? 3 : 1)
    // Judul yang berdiri sendiri ("Kunci Jawaban") cukup satu entri; judul dengan teks lain butuh tiga.
    const min = rest ? 3 : 1
    if (key.size >= min && (!best || key.size > best.key.size)) best = { start: i, end, key }
  })
  if (best) return best
  // Tanpa judul: blok di akhir dokumen yang isinya hanya entri kunci.
  let i = lines.length - 1
  while (i >= 0 && keyOnly(lines[i]!.raw)) i--
  const key = parseKeyEntries(lines.slice(i + 1).map((x) => x.raw))
  return key.size >= 3 ? { start: i + 1, end: lines.length, key } : null
}

// ---------------------------------------------------------------------------
// Pemeriksaan teks

const FIGURE = /\b(gambar|tabel|grafik|diagram|bagan|denah|peta|picture|figure|image|table|chart|graph)\b/i
const KEY_TEXT = /\b(kunci\s*(?:jawaban|:)|jawaban\s*[:=]|jwb\s*[:=]|answer\s*[:=]|ans\s*[:=])/i
// Karakter pengganti, area pribadi (font matematika tanpa peta Unicode), karakter kontrol, dan
// mojibake pecahan Latin-1 seperti "\u00C2\u00BD".
// eslint-disable-next-line no-control-regex -- karakter kontrol memang yang dicari di teks PDF
const MANGLED = /[\uFFFD\uE000-\uF8FF\u0001-\u0008\u000e-\u001f]|\u00C2[\u00BC-\u00BE]/

function digitColumns(s: string): number[] {
  return [...s.matchAll(/\d+/g)].map((m) => m.index!)
}

/** Tanda pecahan rusak: glif aneh, garis miring yatim, atau pembilang di atas penyebut pada baris terpisah. */
export function brokenFraction(texts: string[], raws: string[]): boolean {
  for (const t of texts) {
    if (MANGLED.test(t)) return true
    if (/\/\//.test(t.replace(/[a-z]+:\/\//gi, ''))) return true
    // Garis miring butuh huruf atau angka di kedua sisi (3/4, km/jam, Rp5.000/kg); yang lain yatim.
    for (let i = t.indexOf('/'); i !== -1; i = t.indexOf('/', i + 1)) {
      const left = t.slice(0, i).trimEnd().slice(-1)
      const right = t.slice(i + 1).trimStart().slice(0, 1)
      const alnum = (c: string) => /[\p{L}\p{N}]/u.test(c)
      if (!alnum(left) || !alnum(right)) return true
    }
  }
  for (let i = 1; i < raws.length; i++) {
    const below = raws[i]!
    const above = raws[i - 1]!
    if (!below.trim() || !above.trim()) continue
    if (!/^[\s\d]+$/.test(below)) continue
    if (/^\s*\d{1,4}\s*$/.test(above) && /^\s*\d{1,4}\s*$/.test(below)) return true
    const cols = digitColumns(below)
    const top = digitColumns(above)
    if (cols.length && cols.every((c) => top.some((t) => Math.abs(t - c) <= 2)) && /\p{L}/u.test(above)) return true
  }
  // Pembilang di baris atas, teks soal di tengah, penyebut di baris bawah, pada kolom yang sama.
  for (let i = 2; i < raws.length; i++) {
    const top = raws[i - 2]!
    const bottom = raws[i]!
    if (!/^[\s\d]*\d[\s\d]*$/.test(top) || !/^[\s\d]*\d[\s\d]*$/.test(bottom) || !/\p{L}/u.test(raws[i - 1]!)) continue
    const a = digitColumns(top)
    const b = digitColumns(bottom)
    if (a.length === b.length && a.every((c, k) => Math.abs(c - b[k]!) <= 2)) return true
  }
  return false
}

const SEVERITY: Record<ImportStoredItem['status'], number> = { ok: 0, 'broken-fraction': 1, 'leftover-key-text': 2, 'key-mismatch': 3, 'needs-check': 4 }

export function worseStatus(a: ImportStoredItem['status'], b: ImportStoredItem['status']): ImportStoredItem['status'] {
  return SEVERITY[b] > SEVERITY[a] ? b : a
}

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function joinPrompt(lines: string[]): string {
  let out = ''
  for (const l of lines.map(collapse).filter(Boolean)) {
    if (!out) out = l
    else out += /[.:?!]$/.test(out) ? `\n${l}` : ` ${l}`
  }
  return out
}

// ---------------------------------------------------------------------------
// Segmentasi soal

const DIGITS_ONLY = /^[\s\d]*\d[\s\d]*$/

function segment(lines: Line[]): Block[][] {
  const sequences: Block[][] = []
  let seq: Block[] | null = null
  let last = 0
  let cur: Block | null = null
  lines.forEach((line, idx) => {
    const q = questionStart(line.raw)
    if (q) {
      const next = seq && (q.n === last + 1 || (q.n > last + 1 && q.n <= last + 3 && q.rest.length >= 8))
      if (!seq || (!next && q.n === 1)) {
        seq = []
        sequences.push(seq)
      }
      if (seq.length === 0 || next || q.n === 1) {
        // Pembilang pecahan bertumpuk muncul satu baris di atas nomor soal: ikut soal ini.
        const prev = lines[idx - 1]
        const pre: Line[] = []
        if (prev && DIGITS_ONLY.test(prev.raw) && prev.page === line.page) {
          if (cur && cur.lines[cur.lines.length - 1] === prev) cur.lines.pop()
          pre.push(prev)
        }
        cur = { number: q.n, page: line.page, firstRaw: line.raw, pre, lines: [] }
        seq.push(cur)
        last = q.n
        return
      }
    }
    if (cur) cur.lines.push(line)
  })
  return sequences
}

/** Nomor soal di awal baris diganti spasi supaya posisi kolom tetap sama dengan baris lain. */
function blankNumber(raw: string): string {
  return raw.replace(/^(\s*)(?:(?:no|nomor|soal|question)\s*\.?\s*)?\d{1,3}\s*[.):]?/i, (m) => ' '.repeat(m.length))
}

const indentOf = (s: string) => s.length - s.trimStart().length

function buildItem(b: Block, key: Map<number, number> | null): ImportStoredItem {
  const promptLines: string[] = []
  const trailing: string[] = []
  const options = new Map<number, string[]>()
  const raws = [...b.pre.map((l) => l.raw), blankNumber(b.firstRaw), ...b.lines.map((l) => l.raw)]
  let lastLetter: number | null = null
  let lower: boolean | null = null
  let markerIndent = 0
  for (const raw of raws) {
    if (!raw.trim()) continue
    const markers = findMarkers(raw, new Set(options.keys()), lower, options.size === 0)
    if (markers.length) {
      const startsAt = markers[0]!.start
      if (options.size === 0) {
        markerIndent = startsAt
        if (raw.slice(0, startsAt).trim()) promptLines.push(raw.slice(0, startsAt))
      }
      markers.forEach((m, k) => {
        const end = k + 1 < markers.length ? markers[k + 1]!.start : raw.length
        options.set(m.letter, [raw.slice(m.end, end)])
        lastLetter = m.letter
        lower = m.lower
      })
      continue
    }
    if (options.size === 0 || lastLetter === null) promptLines.push(raw)
    // Baris yang menjorok lebih dalam dari penanda opsi adalah lanjutan opsi; selain itu sisa teks
    // (misalnya "Jawaban: A" atau judul bagian berikutnya) yang tidak ditempel ke opsi.
    else if (indentOf(raw) > markerIndent) options.get(lastLetter)!.push(raw)
    else trailing.push(raw)
  }

  const maxLetter = options.size ? Math.max(...options.keys()) : -1
  const optionTexts = Array.from({ length: maxLetter + 1 }, (_, i) => collapse((options.get(i) ?? []).join(' ')))
  const prompt = joinPrompt(promptLines)
  const keyIndex = key?.get(b.number) ?? null
  const answerFromKey = keyIndex !== null && keyIndex < optionTexts.length && optionTexts[keyIndex] ? keyIndex : null

  let status: ImportStoredItem['status'] = 'ok'
  let figureNote: string | null = null
  if (brokenFraction([prompt, ...optionTexts], raws)) status = worseStatus(status, 'broken-fraction')
  if ([prompt, ...optionTexts, ...trailing].some((t) => KEY_TEXT.test(t))) status = worseStatus(status, 'leftover-key-text')
  if (FIGURE.test(prompt)) {
    status = worseStatus(status, 'needs-check')
    figureNote = `Soal menyebut gambar. Cek halaman ${b.page}.`
  }
  const gaps = optionTexts.some((o) => !o)
  if (optionTexts.length < 2 || gaps || !prompt || prompt.length > PROMPT_MAX || (keyIndex !== null && answerFromKey === null)) {
    status = worseStatus(status, 'needs-check')
  }
  return { number: b.number, prompt, options: optionTexts, answer: answerFromKey, answerFromKey, figureNote, page: b.page, status, approved: false, orgItemId: null }
}

export function parseImport(pages: string[]): ImportParseResult {
  const lines = cleanPages(pages)
  const keyAt = findKey(lines)
  // Baris kunci ("1. B") juga cocok dengan pola nomor soal, jadi bagian kunci dikeluarkan dulu.
  const questionLines = keyAt ? [...lines.slice(0, keyAt.start), ...lines.slice(keyAt.end)] : lines
  const sequences = segment(questionLines)
  const built = sequences.map((seq) => seq.map((b) => buildItem(b, keyAt?.key ?? null)))
  const withOptions = (items: ImportStoredItem[]) => items.filter((i) => i.options.length >= 2).length
  let chosen = built.filter((items) => items.length > 0 && withOptions(items) / items.length >= 0.3)
  if (chosen.length === 0 && built.length) chosen = [built.reduce((a, b) => (b.length > a.length ? b : a))]
  return { items: chosen.flat(), keyFound: Boolean(keyAt), keyEntries: keyAt?.key.size ?? 0 }
}
