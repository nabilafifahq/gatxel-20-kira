/**
 * JSON Schema soal yang diberikan ke model, versi ringkas dari itemSchema di
 * packages/content/src/schema.ts: tanpa figure, passage, dan solution. Hanya memakai kata kunci
 * yang lolos mode strict Claude Code dan OpenAI (type, properties, required, additionalProperties
 * false, items, enum, anyOf, description). Semua properti wajib; isian opsional memakai null.
 * Batas panjang dan jumlah tidak ada di sini; itemSchema yang memeriksanya setelah normalisasi.
 */

import { iconRowScene } from '@kira/content/scenes'
import { ICON_NAMES, type IconName } from '@kira/content/schema'

/**
 * Jenis soal yang bisa dibuat AI. hotspot dan label dibuat dari gambar ikon yang dipilih model, jadi bukan dari
 * diagram buatan tangan. Varian keduanya adalah soal baru dengan deretan ikon baru; terjemahan keduanya memakai
 * ulang gambar dan letak area soal asal dan hanya mengganti tulisan (lihat translateGeometry di handlers/drafts.ts).
 */
export const AI_ITEM_TYPES = [
  'mcq', 'multi', 'numeric', 'text', 'order', 'match', 'sort', 'numberline', 'clock', 'fraction',
  'story', 'listen', 'tiles', 'spell', 'cloze', 'table', 'grid', 'hotspot', 'label',
  'write', 'speak', 'draw', 'photo',
] as const
export type AiItemType = (typeof AI_ITEM_TYPES)[number]
export const MANUAL_ITEM_TYPES: readonly string[] = ['write', 'speak', 'draw', 'photo']
/** Jenis yang tidak bisa dijadikan varian atau terjemahan AI. Kosong sejak hotspot dan label didukung. */
export const NO_VARIANT_TYPES: readonly string[] = []

export function isAiItemType(t: unknown): t is AiItemType {
  return typeof t === 'string' && (AI_ITEM_TYPES as readonly string[]).includes(t)
}

type Json = Record<string, unknown>
const d = (description?: string): Json => (description ? { description } : {})
const S = (description?: string): Json => ({ type: 'string', ...d(description) })
const SN = (description?: string): Json => ({ type: ['string', 'null'], ...d(description) })
const I = (description?: string): Json => ({ type: 'integer', ...d(description) })
const IN = (description?: string): Json => ({ type: ['integer', 'null'], ...d(description) })
const N = (description?: string): Json => ({ type: 'number', ...d(description) })
const B = (description?: string): Json => ({ type: 'boolean', ...d(description) })
const A = (items: Json, description?: string): Json => ({ type: 'array', items, ...d(description) })
const E = (values: string[], description?: string): Json => ({ type: 'string', enum: values, ...d(description) })
export const O = (props: Record<string, Json>, description?: string): Json => ({
  type: 'object',
  ...d(description),
  properties: props,
  required: Object.keys(props),
  additionalProperties: false,
})

const COMMON: Record<string, Json> = {
  difficulty: I('Whole number from 1 (easiest) to 5 (hardest).'),
  lang: E(['en-GB', 'id'], 'Language of every text the child sees.'),
  prompt: S('The question the child reads. Plain text, no markdown.'),
  hints: A(S(), 'Exactly 3 hints for auto-marked types; at most 3 for write, speak, draw and photo.'),
  explanation: S('One or two short sentences that explain the correct answer.'),
  tip: SN('A short tip for next time, or null.'),
  tags: A(S(), 'Lowercase tags with hyphens, can be empty.'),
}

const OPTION = O({ text: S('Option text.'), why: SN('Why a child might pick this wrong option, or null for a correct option.') })
const RUBRIC = O({
  criteria: A(O({ label: S('Short observable check, at most 80 characters.'), points: I('Points for this criterion, 1 to 4.') }), '2 to 5 criteria.'),
})

const TYPE_FIELDS: Record<AiItemType, Record<string, Json>> = {
  mcq: { options: A(OPTION, '3 to 5 options.'), answer: I('Zero-based index of the correct option.') },
  multi: { options: A(OPTION, '3 to 6 options.'), answers: A(I(), 'Zero-based indexes of every correct option.') },
  numeric: {
    answer: N('The correct number.'),
    tolerance: N('Allowed difference from the answer, usually 0.'),
    unit: SN('Unit shown after the answer box, or null.'),
    allowNegative: B('True only when the answer is negative.'),
    allowDecimal: B('True only when the answer has a decimal part.'),
  },
  text: { blanks: A(O({ answers: A(S(), 'Every accepted answer.'), caseSensitive: B() }), 'One entry per blank, in order.') },
  order: { items: A(S(), '3 to 8 cards, listed in the correct order.') },
  match: { pairs: A(O({ left: S(), right: S() }), '2 to 6 pairs that match.') },
  sort: {
    groups: A(S(), '2 to 4 group names.'),
    items: A(O({ text: S(), group: I('Zero-based index of the correct group.') }), '3 to 10 cards.'),
  },
  write: {
    rubric: RUBRIC,
    minWords: IN('Fewest words expected, or null.'),
    maxWords: IN('Most words expected, or null.'),
    planning: A(S(), 'Up to 5 planning questions, can be empty.'),
    model: SN('A short model answer, or null.'),
  },
  speak: { rubric: RUBRIC, readText: SN('Text the child reads aloud, or null.'), maxSeconds: I('Recording limit in seconds, 10 to 180.') },
  draw: { rubric: RUBRIC, background: E(['blank', 'grid', 'lines', 'dots']) },
  photo: { rubric: RUBRIC },
  numberline: {
    min: N('Left end of the line.'),
    max: N('Right end of the line.'),
    step: N('Distance between two tick marks.'),
    answer: N('The point the child must mark.'),
    tolerance: N('Allowed difference from the answer, usually 0.'),
  },
  clock: {
    hour: I('Hour of the time to show, 0 to 23.'),
    minute: I('Minute of the time to show, 0 to 59.'),
    stepMinutes: I('How far the minute hand moves per tap: 1, 5, 15 or 30.'),
  },
  fraction: {
    shape: E(['bar', 'circle', 'square']),
    parts: I('Number of equal parts the shape is cut into, 2 to 16.'),
    numerator: I('Numerator of the fraction the child must shade.'),
    denominator: I('Denominator of the fraction. parts times numerator must divide exactly by the denominator.'),
  },
  story: {
    parts: A(
      O({
        type: E(['mcq', 'numeric', 'text']),
        prompt: S('One question about the story, at most 120 characters.'),
        options: A(OPTION, 'For mcq: 3 or 4 options. Empty for numeric and text.'),
        answerIndex: IN('For mcq: zero-based index of the correct option, otherwise null.'),
        answerNumber: { type: ['number', 'null'], description: 'For numeric: the correct number, otherwise null.' },
        unit: SN('For numeric: unit word after the answer, or null.'),
        accepted: A(S(), 'For text: every accepted one-word or short answer. Empty for mcq and numeric.'),
      }),
      '2 to 4 questions, easier first. The story itself goes in prompt, 2 to 5 short sentences.',
    ),
  },
  listen: {
    listenText: S('What the child hears: 1 or 2 short sentences, read aloud by the site. Never shown on screen.'),
    options: A(OPTION, '3 or 4 options (words or numbers) the child chooses from. The prompt must not repeat listenText.'),
    answer: I('Zero-based index of the correct option.'),
  },
  tiles: {
    answer: S('The correct sentence. Words are separated by single spaces; each word becomes one card. 3 to 9 words.'),
    alternatives: A(S(), 'Other correct sentences that use exactly the same cards, or an empty list.'),
    distractors: A(S(), '0 to 3 extra single-word cards that do not appear in the sentence.'),
  },
  spell: {
    word: S('The word to spell: letters only, apostrophe or hyphen allowed. The prompt must not contain it.'),
    sentence: SN('A short sentence that uses the word, read aloud after the word, or null.'),
  },
  cloze: {
    gaps: A(O({ options: A(S(), '2 to 4 words to choose from.'), answer: I('Zero-based index of the correct word.') }), 'One entry per ___ in the prompt, in order.'),
  },
  table: {
    caption: SN('A short title for the table, or null.'),
    head: A(S(), '2 to 4 column headings.'),
    rows: A(A(S(), 'The cells of one row, with the correct value in every cell.'), '2 to 5 rows, each with one cell per heading.'),
    blanks: A(
      O({ row: I('Zero-based row index of a cell the child fills in.'), col: I('Zero-based column index.'), alsoAccept: A(S(), 'Other accepted spellings or forms, can be empty.') }),
      '1 to 6 cells to hide. The site takes the correct answer from rows.',
    ),
  },
  grid: {
    puzzle: E(['magic', 'sudoku', 'latin']),
    given: A(A(I(), 'One row. 0 means an empty cell.'), 'magic: 3 rows of 3. sudoku: 4 rows of 4. latin: 3 or 4 rows. The puzzle must have exactly one solution.'),
    filled: A(A(I(), 'One row of the finished puzzle.'), 'The full solution. magic: use 1 to 9 once each and every row, column and diagonal adds up to 15.'),
  },
  hotspot: {
    pictures: A(O({ icon: E([...ICON_NAMES], 'The picture to show.'), label: S('Short name of what the picture shows.') }), '3 to 6 pictures the child can tap.'),
    answers: A(S(), 'Labels of the picture or pictures the child must tap (1 to 3).'),
  },
  label: {
    pictures: A(O({ icon: E([...ICON_NAMES], 'The picture to show.'), label: S('Short name for this picture. The child places this label on the picture.') }), '2 to 5 pictures.'),
    extraLabels: A(S(), '0 to 2 extra labels that match none of the pictures.'),
  },
}

/** Skema satu soal untuk jenis-jenis yang diizinkan (anyOf bila lebih dari satu). */
export function itemJsonSchema(types: readonly AiItemType[]): Json {
  const branches = types.map((t) => O({ type: E([t]), ...COMMON, ...TYPE_FIELDS[t] }))
  return branches.length === 1 ? branches[0]! : { anyOf: branches }
}

/** Amplop { items: [...] } untuk job items dan variants. */
export function itemsEnvelopeSchema(types: readonly AiItemType[]): Json {
  return O({ items: A(itemJsonSchema(types), 'The new items.') })
}

export const HINTS_SCHEMA: Json = O({ hints: A(S(), 'Exactly 3 hints, from a gentle nudge to the method without the answer.') })
export const RUBRIC_SCHEMA: Json = RUBRIC

// ---------------------------------------------------------------------------
// Normalisasi jawaban model ke bentuk soal Kira

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.trim() : typeof x === 'number' ? String(x) : '')).filter(Boolean) : [])
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

export function normaliseTags(v: unknown): string[] {
  const out = new Set<string>()
  for (const t of strArr(v)) {
    const tag = t.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (tag) out.add(tag)
  }
  return [...out].slice(0, 10)
}

function rubric(v: unknown): unknown {
  if (!isObj(v)) return v
  return { criteria: arr(v.criteria).map((c) => (isObj(c) ? { label: str(c.label) ?? '', points: c.points } : c)) }
}

function options(v: unknown): unknown[] {
  return arr(v).map((o) => {
    if (typeof o === 'string') return { text: o.trim() }
    if (!isObj(o)) return o
    const why = str(o.why)
    return { text: str(o.text) ?? '', ...(why ? { why } : {}) }
  })
}

export type NormaliseResult = { candidate: Obj; reason: null } | { candidate: null; reason: string }

/**
 * Ubah satu soal dari model menjadi kandidat soal Kira (id "draft", source "ai-draft").
 * Gagal hanya bila bentuknya tidak bisa dibaca sama sekali; selebihnya diperiksa itemSchema.
 */
export function normaliseAiItem(raw: unknown, ctx: { skill: string; lang?: 'en-GB' | 'id' }): NormaliseResult {
  if (!isObj(raw)) return { candidate: null, reason: 'bukan objek JSON' }
  if (!isAiItemType(raw.type)) return { candidate: null, reason: `jenis soal tidak dikenal (${String(raw.type).slice(0, 20)})` }
  const prompt = str(raw.prompt)
  if (!prompt) return { candidate: null, reason: 'prompt kosong' }
  const type = raw.type
  const out: Obj = {
    id: 'draft',
    skill: ctx.skill,
    type,
    difficulty: raw.difficulty,
    prompt,
    lang: raw.lang === 'id' || raw.lang === 'en-GB' ? raw.lang : (ctx.lang ?? 'en-GB'),
    hints: strArr(raw.hints),
    tags: normaliseTags(raw.tags),
    source: 'ai-draft',
  }
  const explanation = str(raw.explanation)
  if (explanation) out.explanation = explanation
  const tip = str(raw.tip)
  if (tip) out.tip = tip
  switch (type) {
    case 'mcq':
      out.options = options(raw.options)
      out.answer = raw.answer
      break
    case 'multi':
      out.options = options(raw.options)
      out.answers = raw.answers
      break
    case 'numeric': {
      out.answer = raw.answer
      out.tolerance = typeof raw.tolerance === 'number' ? raw.tolerance : 0
      const unit = str(raw.unit)
      if (unit) out.unit = unit
      out.allowNegative = raw.allowNegative === true
      out.allowDecimal = raw.allowDecimal === true
      break
    }
    case 'text':
      out.blanks = arr(raw.blanks).map((b) => (isObj(b) ? { answers: strArr(b.answers), caseSensitive: b.caseSensitive === true } : b))
      break
    case 'order':
      out.items = strArr(raw.items)
      break
    case 'match':
      out.pairs = arr(raw.pairs).map((p) => (Array.isArray(p) ? [String(p[0] ?? '').trim(), String(p[1] ?? '').trim()] : isObj(p) ? [str(p.left) ?? '', str(p.right) ?? ''] : p))
      break
    case 'sort':
      out.groups = strArr(raw.groups)
      out.items = arr(raw.items).map((i) => (isObj(i) ? { text: str(i.text) ?? '', group: i.group } : i))
      break
    case 'write': {
      out.rubric = rubric(raw.rubric)
      if (typeof raw.minWords === 'number') out.minWords = raw.minWords
      if (typeof raw.maxWords === 'number') out.maxWords = raw.maxWords
      const planning = strArr(raw.planning)
      if (planning.length) out.planning = planning
      const model = str(raw.model)
      if (model) out.model = model
      break
    }
    case 'speak': {
      out.rubric = rubric(raw.rubric)
      const readText = str(raw.readText)
      if (readText) out.readText = readText
      out.maxSeconds = typeof raw.maxSeconds === 'number' ? raw.maxSeconds : 60
      break
    }
    case 'draw':
      out.rubric = rubric(raw.rubric)
      out.background = typeof raw.background === 'string' ? raw.background : 'blank'
      break
    case 'photo':
      out.rubric = rubric(raw.rubric)
      break
    case 'numberline':
      out.min = raw.min
      out.max = raw.max
      out.step = raw.step
      out.answer = raw.answer
      out.tolerance = typeof raw.tolerance === 'number' ? raw.tolerance : 0
      break
    case 'clock':
      out.answer = { h: raw.hour, m: raw.minute }
      out.stepMinutes = typeof raw.stepMinutes === 'number' ? raw.stepMinutes : 5
      break
    case 'fraction':
      out.shape = raw.shape
      out.parts = raw.parts
      out.answer = { num: raw.numerator, den: raw.denominator }
      break
    case 'story':
      out.parts = arr(raw.parts).map(storyPart)
      break
    case 'listen': {
      const heard = str(raw.listenText)
      if (heard) out.listenText = heard
      out.options = options(raw.options)
      out.answer = raw.answer
      break
    }
    case 'tiles': {
      const answer = str(raw.answer)
      if (answer) out.answer = answer.replace(/\s+/g, ' ')
      out.alternatives = strArr(raw.alternatives).map((a) => a.replace(/\s+/g, ' '))
      out.distractors = strArr(raw.distractors)
      break
    }
    case 'spell': {
      const word = str(raw.word)
      if (word) out.word = word
      const sentence = str(raw.sentence)
      if (sentence) out.sentence = sentence
      break
    }
    case 'cloze':
      out.gaps = arr(raw.gaps).map((g) => (isObj(g) ? { options: strArr(g.options), answer: g.answer } : g))
      break
    case 'table': {
      const caption = str(raw.caption)
      if (caption) out.caption = caption
      out.head = strArr(raw.head)
      const rows = arr(raw.rows).map((r) => arr(r).map((c) => (typeof c === 'string' ? c.trim() : typeof c === 'number' ? String(c) : '')))
      const blanks = arr(raw.blanks).map((b) => {
        if (!isObj(b)) return b
        const cell = typeof b.row === 'number' && typeof b.col === 'number' ? rows[b.row]?.[b.col] : undefined
        return { row: b.row, col: b.col, answers: cell ? [cell, ...strArr(b.alsoAccept).filter((a) => a !== cell)] : [] }
      })
      for (const b of blanks) {
        if (isObj(b) && typeof b.row === 'number' && typeof b.col === 'number' && rows[b.row]?.[b.col] !== undefined) rows[b.row]![b.col] = ''
      }
      out.rows = rows
      out.blanks = blanks
      break
    }
    case 'grid': {
      const given = arr(raw.given).map((r) => arr(r))
      out.puzzle = raw.puzzle
      out.size = given.length
      out.given = given
      out.filled = arr(raw.filled).map((r) => arr(r))
      break
    }
    case 'hotspot':
    case 'label': {
      const pictures = arr(raw.pictures).map((p) => (isObj(p) ? { icon: p.icon, label: str(p.label) ?? '' } : null))
      const valid = pictures.length >= 2 && pictures.length <= 6 && pictures.every((p): p is { icon: IconName; label: string } => p !== null && p.label !== '' && (ICON_NAMES as readonly string[]).includes(String(p.icon)))
      if (valid) {
        const scene = iconRowScene(pictures)
        out.figure = scene.figure
        if (type === 'hotspot') {
          out.regions = pictures.map((p, i) => ({ label: p.label, x: scene.centres[i]!.x, y: scene.centres[i]!.y, w: scene.cell.w, h: scene.cell.h }))
          const wanted = new Set(strArr(raw.answers).map((a) => a.toLowerCase()))
          out.answers = pictures.flatMap((p, i) => (wanted.has(p.label.toLowerCase()) ? [i] : []))
        } else {
          out.labels = pictures.map((p) => p.label)
          out.spots = scene.centres.map((c) => ({ x: c.x, y: c.y }))
          out.extraLabels = strArr(raw.extraLabels)
        }
      }
      break
    }
  }
  return { candidate: out, reason: null }
}

function storyPart(p: unknown): unknown {
  if (!isObj(p)) return p
  const prompt = str(p.prompt) ?? ''
  if (p.type === 'mcq') return { type: 'mcq', prompt, options: options(p.options), answer: p.answerIndex }
  if (p.type === 'numeric') {
    const unit = str(p.unit)
    return { type: 'numeric', prompt, answer: p.answerNumber, ...(unit ? { unit } : {}) }
  }
  return { type: 'text', prompt, answers: strArr(p.accepted) }
}

/** Soal Kira sebagai bahan prompt: tanpa id, figure, passage, dan solution supaya model tidak meniru figur. */
export function itemForPrompt(item: unknown): unknown {
  if (!isObj(item)) return item
  const { id: _id, figure: _f, passage: _p, solution: _s, source: _src, modes: _m, expectedSeconds: _e, ...rest } = item
  return pictureShape(rest)
}

/**
 * hotspot dan label disimpan sebagai area dan titik di atas figur, tetapi model menulisnya sebagai daftar gambar
 * (lihat TYPE_FIELDS). Untuk prompt, bentuk simpanan diubah ke bentuk model: daftar label tanpa ikon.
 */
function pictureShape(item: Json): Json {
  if (item.type === 'hotspot' && Array.isArray(item.regions)) {
    const { regions, answers, ...rest } = item
    const labels = (regions as unknown[]).map((r) => (isObj(r) ? (str(r.label) ?? '') : ''))
    return { ...rest, pictures: labels.map((label) => ({ label })), answers: arr(answers).flatMap((i) => (typeof i === 'number' && labels[i] ? [labels[i]] : [])) }
  }
  if (item.type === 'label' && Array.isArray(item.labels)) {
    const { labels, spots: _spots, ...rest } = item
    return { ...rest, pictures: (labels as unknown[]).map((label) => ({ label })) }
  }
  return item
}
