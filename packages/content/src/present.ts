import { createRng } from '@kira/core/rng'
import type { FigureSpec } from '@kira/figures/spec'
import { keyOf, type AnswerKey } from './check'
import { flattenGrid, gridValues, type GridPuzzle } from './grid'
import type { LabelPerm } from './labels'
import type { PieceType, Pt } from './manip'
import type { Item, Passage } from './schema'
import { translateSolution, type SolutionStepView } from './walkthrough'

/**
 * Item untuk perangkat learner. Kunci, hint, dan pembahasan hanya ikut bila
 * mode mengizinkan (latihan, belajar, kilat, review). Untuk Tes, Simulasi,
 * dan Kertas, objek ini tidak pernah memuat kunci.
 */

export type ClientOption = { i: number; text?: string; figure?: FigureSpec }

/** Satu pertanyaan di soal cerita bertahap, dalam bentuk yang dikenali widget pilihan ganda, angka, dan isian. */
export type ClientPart = {
  type: 'mcq' | 'numeric' | 'text'
  prompt: string
  options?: ClientOption[]
  unit?: string
  allowDecimal?: boolean
  allowNegative?: boolean
}

export type ClientHotspot = { regions: { label: string; x: number; y: number; w: number; h: number }[]; count: number }
export type ClientLabelDiagram = { spots: { x: number; y: number }[]; labels: string[] }
export type ClientTable = { caption?: string; head: string[]; rows: string[][]; blanks: { row: number; col: number; numeric: boolean; extra: string[] }[] }
export type ClientGrid = { puzzle: GridPuzzle; size: number; given: number[]; values: number[] }

export type ClientItem = {
  ref: string
  type: Item['type']
  skill: string
  difficulty: number
  prompt: string
  lang: 'en-GB' | 'id'
  figure?: FigureSpec
  passage?: { title: string; text: string; kind: string }
  options?: ClientOption[]
  orderItems?: { i: number; text: string }[]
  matchLeft?: string[]
  matchRight?: { i: number; text: string }[]
  sortGroups?: string[]
  sortItems?: { i: number; text: string }[]
  numberline?: { min: number; max: number; step: number }
  clockStep?: number
  fraction?: { shape: 'bar' | 'circle' | 'square'; parts: number }
  blanks?: number
  unit?: string
  allowDecimal?: boolean
  allowNegative?: boolean
  multiCount?: number
  rubric?: { label: string; points: number }[]
  readText?: string
  maxSeconds?: number
  minWords?: number
  maxWords?: number
  planning?: string[]
  drawBackground?: 'blank' | 'grid' | 'lines' | 'dots'
  parts?: ClientPart[]
  /** Teks yang dibacakan suara (listen dan spell). Dikirim ke perangkat supaya bisa dibacakan, tetapi tidak pernah ditampilkan atau masuk speakableText. */
  listenText?: string
  /** Mode tanpa umpan balik: kunci klip (sha256) pengganti listenText. Kata atau kalimatnya tidak pernah dikirim. */
  listenClips?: string[]
  /** Mode tanpa umpan balik: klip belum ada, jadi soal ini tidak bisa didengar. */
  listenMissing?: boolean
  spellLength?: number
  spellExtra?: string[]
  tiles?: string[]
  cloze?: string[][]
  hotspot?: ClientHotspot
  labelDiagram?: ClientLabelDiagram
  table?: ClientTable
  grid?: ClientGrid
  /** Alat peraga: hanya konfigurasi papan, tidak pernah target atau kunci. */
  blocks?: { places: 'to' | 'hto'; start: { h: number; t: number; o: number } }
  fractionbar?: { rows: { den?: number; locked?: number }[]; splits: number[] }
  barmodel?: { kind: 'partwhole' | 'compare'; labels: string[]; barCount: number; maxUnits: number; unit?: { max: number }; unitName?: string }
  tangram?: { pieces: PieceType[]; slots: Pt[][] }
  geoboard?: { size: number }
  terms?: { term: string; en: string }[]
  expectedSeconds: number
  points?: number
  /** Hanya mode latihan. */
  hints?: string[]
  key?: AnswerKey
  reveal?: { explanation: string; /** Terjemahan bahasa Indonesia. Hanya ikut bersama kunci, tidak pernah lebih awal. */ explanationId?: string; tip?: string; tipId?: string; solution?: SolutionStepView[]; /** Pembahasan ada tetapi dimuat malas (runner Latihan). */ hasSolution?: boolean; answerText: string; whyWrong?: (string | null)[]; whyWrongId?: (string | null)[] }
}

export type PresentOptions = {
  ref?: string
  seed: string
  includeKey: boolean
  includeHints: boolean
  passage?: Passage
  answerText?: string
  /**
   * Label rahasia untuk mode tanpa umpan balik (lihat labels.ts). Urutan tampil dikocok dengan indeks asli,
   * baru setelah itu `i` diganti label. Tidak boleh dipakai bersama includeKey, karena kunci memakai indeks asli.
   */
  labels?: LabelPerm
  /** Jangan kirim teks dengar (soal dengar dan eja): di mode tanpa umpan balik teks itu adalah jawabannya. */
  hideSpoken?: boolean
  /** Pencari terjemahan penjelasan. Hanya dipakai bersama includeKey, jadi terjemahan tidak pernah terkirim sebelum waktunya. */
  translate?: (en: string) => string | null
}

/** Teks yang diputar tombol dengar: soal dengar memakai listenText, soal eja memakai kata lalu kalimat contoh. */
export function listenTextOf(item: Item): string | null {
  if (item.type === 'listen') return item.listenText
  if (item.type === 'spell') return item.sentence ? `${item.word}. ${item.sentence} ${item.word}.` : `${item.word}.`
  return null
}

const EXPECTED: Record<Item['type'], number> = {
  mcq: 45, multi: 60, numeric: 60, text: 60, order: 60, match: 75, sort: 75, numberline: 45, clock: 45, fraction: 45,
  write: 600, speak: 120, draw: 300,
  story: 150, listen: 45, tiles: 60, spell: 45, cloze: 60, hotspot: 30, label: 75, table: 90, grid: 180, photo: 300,
  blocks: 60, fractionbar: 75, barmodel: 120, tangram: 150, geoboard: 90,
}

export function presentItem(item: Item, opt: PresentOptions): ClientItem {
  if (opt.labels && opt.includeKey) throw new Error('presentItem: labels tidak boleh dipakai bersama kunci')
  const rng = createRng(`${opt.seed}:${item.id}`)
  const perm = opt.labels
  const relabel = <T extends { i: number }>(list: T[]): T[] => (perm ? list.map((x) => ({ ...x, i: perm[x.i] ?? x.i })) : list)
  const out: ClientItem = {
    ref: opt.ref ?? item.id,
    type: item.type,
    skill: item.skill,
    difficulty: item.difficulty,
    prompt: item.prompt,
    lang: item.lang,
    expectedSeconds: item.expectedSeconds ?? EXPECTED[item.type],
    ...(item.figure ? { figure: item.figure } : {}),
    ...(opt.passage ? { passage: { title: opt.passage.title, text: opt.passage.text, kind: opt.passage.kind } } : {}),
    ...(item.terms ? { terms: item.terms } : {}),
    ...(item.points ? { points: item.points } : {}),
  }

  switch (item.type) {
    case 'mcq':
    case 'multi': {
      const opts = item.options.map((o, i) => ({ i, ...(o.text ? { text: o.text } : {}), ...(o.figure ? { figure: o.figure } : {}) }))
      // Opsi A sampai E di soal lomba tidak diacak supaya sama dengan kertas.
      const keepOrder = item.tags.some((t) => t === 'keep-order' || t === 'esmo' || t === 'ikmc' || t === 'sasmo')
      out.options = relabel(keepOrder ? opts : rng.shuffle(opts))
      if (item.type === 'multi') out.multiCount = item.answers.length
      break
    }
    case 'order':
      out.orderItems = relabel(shuffleNotIdentity(item.items.map((text, i) => ({ i, text })), rng))
      break
    case 'match':
      out.matchLeft = item.pairs.map(([l]) => l)
      out.matchRight = relabel(shuffleNotIdentity(item.pairs.map(([, r], i) => ({ i, text: r })), rng))
      break
    case 'sort':
      out.sortGroups = item.groups
      out.sortItems = relabel(rng.shuffle(item.items.map((it, i) => ({ i, text: it.text }))))
      break
    case 'numeric':
      if (item.unit) out.unit = item.unit
      out.allowDecimal = item.allowDecimal || !Number.isInteger(item.answer)
      out.allowNegative = item.allowNegative || item.answer < 0
      break
    case 'text':
      out.blanks = item.blanks.length
      break
    case 'numberline':
      out.numberline = { min: item.min, max: item.max, step: item.step }
      break
    case 'clock':
      out.clockStep = item.stepMinutes
      break
    case 'fraction':
      out.fraction = { shape: item.shape, parts: item.parts }
      break
    case 'write':
      out.rubric = item.rubric.criteria
      if (item.minWords) out.minWords = item.minWords
      if (item.maxWords) out.maxWords = item.maxWords
      if (item.planning) out.planning = item.planning
      break
    case 'speak':
      out.rubric = item.rubric.criteria
      out.maxSeconds = item.maxSeconds
      if (item.readText) out.readText = item.readText
      break
    case 'draw':
      out.rubric = item.rubric.criteria
      out.drawBackground = item.background
      break
    case 'photo':
      out.rubric = item.rubric.criteria
      break
    case 'story': {
      let at = 0
      out.parts = item.parts.map((part, k): ClientPart => {
        if (part.type === 'mcq') {
          const partRng = createRng(`${opt.seed}:${item.id}:p${k}`)
          const base = at
          at += part.options.length
          const opts = part.options.map((o, j) => ({ i: j + base, ...(o.text ? { text: o.text } : {}), ...(o.figure ? { figure: o.figure } : {}) }))
          // Tanpa label, i adalah indeks dalam pertanyaan ini; dengan label, i adalah label global.
          const local = perm ? relabel(partRng.shuffle(opts)) : partRng.shuffle(opts).map((o) => ({ ...o, i: o.i - base }))
          return { type: 'mcq', prompt: part.prompt, options: local }
        }
        if (part.type === 'numeric') {
          return {
            type: 'numeric',
            prompt: part.prompt,
            ...(part.unit ? { unit: part.unit } : {}),
            allowDecimal: part.allowDecimal || !Number.isInteger(part.answer),
            allowNegative: part.allowNegative || part.answer < 0,
          }
        }
        return { type: 'text', prompt: part.prompt }
      })
      break
    }
    case 'listen': {
      const opts = item.options.map((o, i) => ({ i, ...(o.text ? { text: o.text } : {}), ...(o.figure ? { figure: o.figure } : {}) }))
      out.options = relabel(rng.shuffle(opts))
      if (!opt.hideSpoken) out.listenText = item.listenText
      break
    }
    case 'tiles': {
      const order = item.answer.split(/\s+/).filter(Boolean)
      const tiles = [...order, ...item.distractors]
      let shuffled = rng.shuffle(tiles)
      for (let tries = 0; tries < 6 && shuffled.join(' ') === order.join(' '); tries++) shuffled = rng.shuffle(tiles)
      out.tiles = shuffled
      break
    }
    case 'spell':
      if (!opt.hideSpoken) out.listenText = listenTextOf(item) ?? ''
      out.spellLength = item.word.length
      {
        const extra = [...new Set([item.word, ...item.alsoAccept].join('').split('').filter((c) => c === "'" || c === '-'))]
        if (extra.length > 0) out.spellExtra = extra
      }
      break
    case 'cloze':
      out.cloze = item.gaps.map((g) => rng.shuffle(g.options))
      break
    case 'hotspot':
      out.hotspot = {
        // Urutan baca dari atas ke bawah, bukan urutan di file soal.
        regions: [...item.regions]
          .map((r) => ({ label: r.label, x: r.x, y: r.y, w: r.w, h: r.h }))
          .sort((a, b) => Math.round(a.y / 12) - Math.round(b.y / 12) || a.x - b.x),
        count: item.answers.length,
      }
      break
    case 'label':
      out.labelDiagram = { spots: item.spots.map((sp) => ({ x: sp.x, y: sp.y })), labels: rng.shuffle([...item.labels, ...item.extraLabels]) }
      break
    case 'table': {
      const blankAt = new Set(item.blanks.map((b) => `${b.row}:${b.col}`))
      out.table = {
        ...(item.caption ? { caption: item.caption } : {}),
        head: item.head,
        rows: item.rows.map((row, r) => row.map((cell, c) => (blankAt.has(`${r}:${c}`) ? '' : cell))),
        blanks: item.blanks.map((b) => {
          const numeric = b.answers.every((a) => /^-?[\d.,/ ]+$/.test(a))
          return {
            row: b.row,
            col: b.col,
            numeric,
            // Tanda selain huruf dan angka di jawaban (titik desimal, garis miring, tanda hubung, spasi), supaya papan tidak menampilkan tombol yang tidak perlu.
            // Papan huruf tidak punya angka, jadi jawaban campuran seperti "10:00 a.m." membawa angkanya sendiri.
            extra: [...new Set(b.answers.join('').split('').filter((c) => (numeric ? !/[A-Za-z0-9]/.test(c) : !/[A-Za-z]/.test(c))))],
          }
        }),
      }
      break
    }
    case 'blocks':
      out.blocks = { places: item.places, start: item.start }
      break
    case 'fractionbar':
      out.fractionbar = { rows: item.rows, splits: item.splits }
      break
    case 'barmodel': {
      const maxUnits = Math.min(12, Math.max(...item.bars.map((b) => b.units)) + 2)
      out.barmodel = {
        kind: item.kind,
        labels: rng.shuffle([...item.bars.map((b) => b.label), ...item.extraLabels]),
        barCount: item.bars.length,
        maxUnits,
        ...(item.unitValue !== undefined ? { unit: { max: Math.min(100, Math.max(12, Math.ceil((item.unitValue * 2) / 5) * 5)) } } : {}),
        ...(item.unitName ? { unitName: item.unitName } : {}),
      }
      break
    }
    case 'tangram':
      out.tangram = { pieces: item.pieces, slots: item.slots as unknown as Pt[][] }
      break
    case 'geoboard':
      out.geoboard = { size: item.size }
      break
    case 'grid':
      out.grid = { puzzle: item.puzzle, size: item.size, given: flattenGrid(item.given), values: gridValues(item.puzzle, item.size, flattenGrid(item.filled)) }
      break
  }

  if (opt.includeHints && item.hints.length > 0) out.hints = item.hints
  if (opt.includeKey) {
    out.key = keyOf(item)
    const t = opt.translate
    const explanationId = t?.(item.explanation) ?? null
    const tipId = item.tip ? (t?.(item.tip) ?? null) : null
    const whyWrongId = t && (item.type === 'mcq' || item.type === 'multi') ? item.options.map((o) => (o.why ? t(o.why) : null)) : null
    out.reveal = {
      explanation: item.explanation,
      answerText: opt.answerText ?? '',
      ...(explanationId ? { explanationId } : {}),
      ...(item.tip ? { tip: item.tip } : {}),
      ...(tipId ? { tipId } : {}),
      ...(item.solution ? { solution: t ? translateSolution(item, item.solution, t) : item.solution } : {}),
      ...(item.type === 'mcq' || item.type === 'multi' ? { whyWrong: item.options.map((o) => o.why ?? null) } : {}),
      ...(whyWrongId?.some(Boolean) ? { whyWrongId } : {}),
    }
  }
  return out
}

function shuffleNotIdentity<T extends { i: number }>(list: T[], rng: ReturnType<typeof createRng>): T[] {
  if (list.length < 2) return list
  for (let tries = 0; tries < 6; tries++) {
    const s = rng.shuffle(list)
    if (s.some((x, idx) => x.i !== idx)) return s
  }
  return [...list.slice(1), list[0]!]
}
