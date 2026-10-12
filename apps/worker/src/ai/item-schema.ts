/**
 * JSON Schema soal yang diberikan ke model, versi ringkas dari itemSchema di
 * packages/content/src/schema.ts: tanpa figure, passage, dan solution. Hanya memakai kata kunci
 * yang lolos mode strict Claude Code dan OpenAI (type, properties, required, additionalProperties
 * false, items, enum, anyOf, description). Semua properti wajib; isian opsional memakai null.
 * Batas panjang dan jumlah tidak ada di sini; itemSchema yang memeriksanya setelah normalisasi.
 */

export const AI_ITEM_TYPES = ['mcq', 'multi', 'numeric', 'text', 'order', 'match', 'sort', 'write', 'speak', 'draw'] as const
export type AiItemType = (typeof AI_ITEM_TYPES)[number]
export const MANUAL_ITEM_TYPES: readonly string[] = ['write', 'speak', 'draw']

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
  hints: A(S(), 'Exactly 3 hints for auto-marked types; at most 3 for write, speak and draw.'),
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
  }
  return { candidate: out, reason: null }
}

/** Soal Kira sebagai bahan prompt: tanpa id, figure, passage, dan solution supaya model tidak meniru figur. */
export function itemForPrompt(item: unknown): unknown {
  if (!isObj(item)) return item
  const { id: _id, figure: _f, passage: _p, solution: _s, source: _src, modes: _m, expectedSeconds: _e, ...rest } = item
  return rest
}
