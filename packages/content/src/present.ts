import { createRng } from '@kira/core/rng'
import type { FigureSpec } from '@kira/figures/spec'
import { keyOf, type AnswerKey } from './check'
import type { LabelPerm } from './labels'
import type { Item, Passage, SolutionStep } from './schema'

/**
 * Item untuk perangkat learner. Kunci, hint, dan pembahasan hanya ikut bila
 * mode mengizinkan (latihan, belajar, kilat, review). Untuk Tes, Simulasi,
 * dan Kertas, objek ini tidak pernah memuat kunci.
 */

export type ClientOption = { i: number; text?: string; figure?: FigureSpec }

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
  terms?: { term: string; en: string }[]
  expectedSeconds: number
  points?: number
  /** Hanya mode latihan. */
  hints?: string[]
  key?: AnswerKey
  reveal?: { explanation: string; tip?: string; solution?: SolutionStep[]; answerText: string; whyWrong?: (string | null)[] }
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
}

const EXPECTED: Record<Item['type'], number> = {
  mcq: 45, multi: 60, numeric: 60, text: 60, order: 60, match: 75, sort: 75, numberline: 45, clock: 45, fraction: 45,
  write: 600, speak: 120, draw: 300,
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
  }

  if (opt.includeHints && item.hints.length > 0) out.hints = item.hints
  if (opt.includeKey) {
    out.key = keyOf(item)
    out.reveal = {
      explanation: item.explanation,
      answerText: opt.answerText ?? '',
      ...(item.tip ? { tip: item.tip } : {}),
      ...(item.solution ? { solution: item.solution } : {}),
      ...(item.type === 'mcq' || item.type === 'multi' ? { whyWrong: item.options.map((o) => o.why ?? null) } : {}),
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
