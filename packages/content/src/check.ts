import { flattenGrid, gridRulesOk, gridValues, type GridPuzzle } from './grid'
import {
  analysePegs,
  barModelOk,
  blocksOk,
  formatLength,
  fractionBarOk,
  geoOk,
  parseBars,
  parseBlocks,
  parseModel,
  parsePegs,
  parsePlacements,
  tangramScore,
  type BarModelKey,
  type BlocksKey,
  type FractionBarKey,
  type GeoRule,
  type PieceType,
  type Pt,
} from './manip'
import type { Item } from './schema'

/**
 * Pemeriksa jawaban. Dipakai di server (sumber kebenaran) dan di perangkat
 * learner untuk umpan balik langsung saat offline di mode latihan.
 * Tidak mengimpor apa pun dari Node supaya aman dibundel ke client.
 */

export type AnswerKey =
  | { type: 'mcq'; answer: number }
  | { type: 'multi'; answers: number[] }
  | { type: 'numeric'; answer: number; tolerance: number; acceptAlt?: number[] }
  | { type: 'text'; blanks: { answers: string[]; caseSensitive: boolean; equiv?: 'fraction' | 'any' }[] }
  | { type: 'order'; length: number }
  | { type: 'match'; length: number }
  | { type: 'sort'; groupsOf: number[] }
  | { type: 'numberline'; answer: number; tolerance: number }
  | { type: 'clock'; h: number; m: number }
  | { type: 'fraction'; num: number; den: number; parts: number }
  | { type: 'story'; parts: StoryPartKey[] }
  | { type: 'listen'; answer: number }
  | { type: 'tiles'; answers: string[] }
  | { type: 'spell'; words: string[] }
  | { type: 'cloze'; answers: string[] }
  | { type: 'hotspot'; answers: string[] }
  | { type: 'label'; labels: string[] }
  | { type: 'table'; blanks: string[][] }
  | { type: 'grid'; puzzle: GridPuzzle; size: number; given: number[]; solution: number[]; values: number[] }
  | ({ type: 'blocks' } & BlocksKey)
  | ({ type: 'fractionbar' } & FractionBarKey)
  | ({ type: 'barmodel' } & BarModelKey)
  | { type: 'tangram'; pieces: PieceType[]; slots: Pt[][] }
  | { type: 'geoboard'; size: number; rule: GeoRule }
  | { type: 'write' | 'speak' | 'draw' | 'photo' }

/** Kunci satu pertanyaan di soal cerita bertahap. */
export type StoryPartKey = Extract<AnswerKey, { type: 'mcq' | 'numeric' | 'text' }>

export type Answer =
  | { choice: number }
  | { choices: number[] }
  | { value: string }
  | { texts: string[] }
  | { order: number[] }
  | { pairs: number[] }
  | { groups: number[] }
  | { position: number }
  | { h: number; m: number }
  | { shaded: number }
  | { text: string }
  | { mediaId: string; text?: string }
  | { parts: (Answer | null)[] }
  | { words: string[] }
  | { cells: number[] }
  | { blocks: { h: number; t: number; o: number } }
  | { bars: { den: number; shaded: number }[] }
  | { model: { bars: { label: string; units: number }[]; unit?: number } }
  | { placed: (readonly [number, number, 0 | 1] | null)[] }
  | { pegs: (readonly [number, number])[]; closed: boolean }

/** Batas digit keypad jawaban angka. Harus lebih panjang dari jawaban terpanjang di bank soal dan generator (test/keypad-limit.test.ts). */
export const NUMERIC_MAX_DIGITS = 10

export type CheckStatus = 'correct' | 'wrong' | 'blank' | 'pending'

export type CheckResult = { status: CheckStatus; score: number; partial?: number }

export function keyOf(item: Item): AnswerKey {
  switch (item.type) {
    case 'mcq':
      return { type: 'mcq', answer: item.answer }
    case 'multi':
      return { type: 'multi', answers: [...item.answers].sort((a, b) => a - b) }
    case 'numeric':
      return { type: 'numeric', answer: item.answer, tolerance: item.tolerance, ...(item.acceptAlt ? { acceptAlt: item.acceptAlt } : {}) }
    case 'text':
      return { type: 'text', blanks: item.blanks.map((b) => ({ answers: b.answers, caseSensitive: b.caseSensitive, ...equivalence(item, b.answers[0]) })) }
    case 'order':
      return { type: 'order', length: item.items.length }
    case 'match':
      return { type: 'match', length: item.pairs.length }
    case 'sort':
      return { type: 'sort', groupsOf: item.items.map((i) => i.group) }
    case 'numberline':
      return { type: 'numberline', answer: item.answer, tolerance: item.tolerance }
    case 'clock':
      return { type: 'clock', h: item.answer.h, m: item.answer.m }
    case 'fraction':
      return { type: 'fraction', num: item.answer.num, den: item.answer.den, parts: item.parts }
    case 'story':
      return {
        type: 'story',
        parts: item.parts.map((part): StoryPartKey => {
          if (part.type === 'mcq') return { type: 'mcq', answer: part.answer }
          if (part.type === 'numeric') return { type: 'numeric', answer: part.answer, tolerance: part.tolerance }
          return { type: 'text', blanks: [{ answers: part.answers, caseSensitive: part.caseSensitive }] }
        }),
      }
    case 'listen':
      return { type: 'listen', answer: item.answer }
    case 'tiles':
      return { type: 'tiles', answers: [item.answer, ...item.alternatives] }
    case 'spell':
      return { type: 'spell', words: [item.word, ...item.alsoAccept] }
    case 'cloze':
      return { type: 'cloze', answers: item.gaps.map((g) => g.options[g.answer] ?? '') }
    case 'hotspot':
      return { type: 'hotspot', answers: item.answers.map((i) => item.regions[i]?.label ?? '') }
    case 'label':
      return { type: 'label', labels: item.labels }
    case 'table':
      return { type: 'table', blanks: item.blanks.map((b) => b.answers) }
    case 'grid': {
      const solution = flattenGrid(item.filled)
      return { type: 'grid', puzzle: item.puzzle, size: item.size, given: flattenGrid(item.given), solution, values: gridValues(item.puzzle, item.size, solution) }
    }
    case 'blocks':
      return { type: 'blocks', h: item.target.h, t: item.target.t, o: item.target.o, exact: item.exact }
    case 'fractionbar':
      return { type: 'fractionbar', rows: item.rows, splits: item.splits, targets: item.targets, exactSplit: item.exactSplit, ...(item.relation ? { relation: item.relation } : {}) }
    case 'barmodel':
      return { type: 'barmodel', kind: item.kind, bars: item.bars, ...(item.unitValue !== undefined ? { unit: item.unitValue } : {}) }
    case 'tangram':
      return { type: 'tangram', pieces: item.pieces, slots: item.slots }
    case 'geoboard':
      return { type: 'geoboard', size: item.size, rule: item.rule }
    case 'write':
    case 'speak':
    case 'draw':
    case 'photo':
      return { type: item.type }
  }
}

/** "1,5" dan "1.5" sama-sama 1,5. Spasi ribuan dan titik ribuan gaya Indonesia ditolak bila ambigu. */
/**
 * Semua bacaan angka yang masuk akal dari jawaban anak. "12.500" bisa berarti 12,5 (titik desimal gaya
 * Inggris) atau 12500 (titik ribuan gaya Indonesia), jadi keduanya dikembalikan dan pemeriksa jawaban
 * menerima bila salah satunya cocok dengan kunci.
 */
export function parseNumberCandidates(raw: string): number[] {
  const s = raw.trim().replace(/\s+/g, '').replace(/^\+/, '').replace(/^[−–]/, '-')
  if (s === '' || s === '-' || s === '.' || s === ',') return []
  // .9 dan ,9 sama dengan 0.9
  const lead = /^(-?)[.,](\d+)$/.exec(s)
  if (lead) return [Number(`${lead[1]}0.${lead[2]}`)]
  // 1/2 sebagai pecahan sederhana
  const frac = /^(-?\d+)\/(\d+)$/.exec(s)
  if (frac) {
    const den = Number(frac[2])
    return den === 0 ? [] : [Number(frac[1]) / den]
  }
  if (/^-?\d+$/.test(s)) return [Number(s)]
  const out: number[] = []
  // Satu koma atau satu titik sebagai pemisah desimal.
  if (/^-?\d+[.,]\d+$/.test(s)) out.push(Number(s.replace(',', '.')))
  // 12.500, 1,234 atau 1.234.567 sebagai ribuan (kelompok tiga digit).
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(s)) out.push(Number(s.replace(/[.,]/g, '')))
  // 1.234,5 (ribuan titik, desimal koma) dan 1,234.5 (ribuan koma, desimal titik).
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) out.push(Number(s.replace(/\./g, '').replace(',', '.')))
  if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(s)) out.push(Number(s.replace(/,/g, '')))
  return [...new Set(out)]
}

/** Bacaan pertama (desimal bila ambigu), atau null bila bukan angka. */
export function parseNumber(raw: string): number | null {
  return parseNumberCandidates(raw)[0] ?? null
}

export function normaliseText(s: string, caseSensitive: boolean): string {
  const t = s
    .normalize('NFKC')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '')
    .trim()
  return caseSensitive ? t : t.toLowerCase()
}

/** Koordinat "(1, 1)", "(1,1)", "1, 1", dan "( 1 , 1 )" adalah jawaban yang sama. Null bila bukan koordinat. */
function coordForm(s: string): string | null {
  const m = /^\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?$/.exec(s.normalize('NFKC').replace(/−/g, '-').trim())
  return m ? `${m[1]},${m[2]}` : null
}

/** Nilai pecahan atau pecahan campuran yang diketik anak: "3/4", "1 3/4", "3 / 4". Null bila bukan pecahan. */
function fractionValue(raw: string): number | null {
  const s = raw.normalize('NFKC').replace(/\s*[/⁄]\s*/g, '/').replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '')
  const m = /^(?:(\d+) )?(\d+)\/(\d+)$/.exec(s)
  if (!m || Number(m[3]) === 0) return null
  return Number(m[1] ?? 0) + Number(m[2]) / Number(m[3])
}

/**
 * Soal generator yang tidak meminta bentuk tertentu menerima pecahan senilai, misalnya 22/48 untuk 11/24.
 * Bila soal meminta pecahan, desimal tetap ditolak kecuali tercantum di jawaban yang diterima.
 */
function equivalence(item: Item, first: string | undefined): { equiv?: 'fraction' | 'any' } {
  if (!item.id.startsWith('gen:') || first === undefined || fractionValue(first) === null) return {}
  if (/simplest|lowest terms|improper|mixed number/i.test(item.prompt)) return {}
  return { equiv: /fraction/i.test(item.prompt) ? 'fraction' : 'any' }
}

function equalsValue(given: string, accepted: string, mode: 'fraction' | 'any'): boolean {
  const target = fractionValue(accepted)
  if (target === null) return false
  const asFraction = fractionValue(given)
  if (asFraction !== null) return close(asFraction, target, 0)
  return mode === 'any' && parseNumberCandidates(given).some((v) => close(v, target, 0))
}

/**
 * Isian teks cocok dengan jawaban yang diterima: sama setelah dirapikan, koordinat yang sama, spasi di sekitar
 * garis pecahan diabaikan, atau angka yang sama ditulis lain (.9, 0,9, 1,200). Jawaban pecahan dan angka berakhiran
 * nol seperti 3.50 tetap harus sama persis, karena bentuknya bisa jadi yang ditanyakan.
 */
function textMatches(given: string, accepted: string, caseSensitive: boolean): boolean {
  const g = normaliseText(given, caseSensitive)
  if (g === '') return false
  const a = normaliseText(accepted, caseSensitive)
  if (g === a) return true
  const c = coordForm(accepted)
  if (c !== null && c === coordForm(given)) return true
  const slash = (s: string) => s.replace(/\s*[/⁄]\s*/g, '/')
  if (slash(g) === slash(a)) return true
  if (g.includes('/') || !/^-?\d+(?:\.\d*[1-9])?$/.test(a)) return false
  return parseNumberCandidates(g).some((v) => close(v, Number(a), 0))
}

/** Bentuk banding isian cloze. Tanda baca saja (".", "!", "?") tidak boleh habis dipangkas, karena itu jawabannya. */
export const clozeForm = (s: string) => normaliseText(s, false) || s.normalize('NFKC').trim()

const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol + 1e-9

/** Kalimat dari kartu: kata dipisah satu spasi, tanda kutip lurus. Huruf besar dan tanda baca tetap dihitung. */
export function normaliseSentence(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Ejaan: huruf besar kecil tidak dihitung, tanda kutip lurus. */
export function normaliseWord(s: string): string {
  return s.normalize('NFKC').replace(/[‘’ʼ]/g, "'").replace(/\s+/g, '').toLowerCase()
}

/** Isi sel tabel: sama sebagai teks, atau sama sebagai angka (8 dan 8,0). */
export function cellMatches(given: string, accepted: string): boolean {
  const g = normaliseText(given, false)
  const a = normaliseText(accepted, false)
  if (g === '') return false
  if (g === a) return true
  const gv = parseNumberCandidates(g)
  const av = parseNumberCandidates(a)
  return gv.length > 0 && av.length > 0 && gv.some((x) => av.some((y) => close(x, y, 0)))
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : '')) : [])

function isBlank(answer: unknown): boolean {
  if (answer === null || answer === undefined) return true
  if (typeof answer !== 'object') return true
  const a = answer as Record<string, unknown>
  if ('value' in a) return typeof a.value !== 'string' || a.value.trim() === ''
  if ('texts' in a) return !Array.isArray(a.texts) || a.texts.every((t) => typeof t !== 'string' || t.trim() === '')
  if ('choice' in a) return typeof a.choice !== 'number'
  if ('choices' in a) return !Array.isArray(a.choices) || a.choices.length === 0
  if ('words' in a) return !Array.isArray(a.words) || a.words.length === 0
  if ('cells' in a) return !Array.isArray(a.cells) || a.cells.every((c) => c === 0 || typeof c !== 'number')
  if ('blocks' in a) return parseBlocks(a.blocks) === null
  if ('bars' in a) return !Array.isArray(a.bars) || a.bars.length === 0
  if ('model' in a) return a.model === null || typeof a.model !== 'object'
  if ('placed' in a) return !Array.isArray(a.placed) || a.placed.every((x) => x === null)
  if ('pegs' in a) return !Array.isArray(a.pegs) || a.pegs.length < 3
  if ('parts' in a) return !Array.isArray(a.parts) || a.parts.every((x) => isBlank(x))
  if ('text' in a && !('mediaId' in a)) return typeof a.text !== 'string' || a.text.trim() === ''
  return false
}

export function checkAnswer(key: AnswerKey, answer: unknown): CheckResult {
  if (key.type === 'write' || key.type === 'speak' || key.type === 'draw' || key.type === 'photo') {
    return isBlank(answer) ? { status: 'blank', score: 0 } : { status: 'pending', score: 0 }
  }
  if (isBlank(answer)) return { status: 'blank', score: 0 }
  const a = answer as Record<string, unknown>
  const verdict = (ok: boolean, partial?: number): CheckResult =>
    ok ? { status: 'correct', score: 1 } : { status: 'wrong', score: 0, ...(partial !== undefined ? { partial } : {}) }

  switch (key.type) {
    case 'mcq':
      return verdict(a.choice === key.answer)
    case 'multi': {
      const chosen = Array.isArray(a.choices) ? [...new Set(a.choices as number[])].sort((x, y) => x - y) : []
      return verdict(chosen.length === key.answers.length && chosen.every((c, i) => c === key.answers[i]))
    }
    case 'numeric': {
      const vs = typeof a.value === 'string' ? parseNumberCandidates(a.value) : typeof a.value === 'number' ? [a.value] : []
      if (vs.length === 0) return { status: 'wrong', score: 0 }
      const ok = vs.some((v) => close(v, key.answer, key.tolerance) || (key.acceptAlt ?? []).some((alt) => close(v, alt, key.tolerance)))
      return verdict(ok)
    }
    case 'text': {
      const texts = Array.isArray(a.texts) ? (a.texts as unknown[]) : []
      let right = 0
      key.blanks.forEach((b, i) => {
        const given = typeof texts[i] === 'string' ? (texts[i] as string) : ''
        if (b.answers.some((ans) => textMatches(given, ans, b.caseSensitive))) right++
        else if (b.equiv && b.answers[0] !== undefined && equalsValue(given, b.answers[0], b.equiv)) right++
      })
      return verdict(right === key.blanks.length, right / key.blanks.length)
    }
    case 'order': {
      const order = Array.isArray(a.order) ? (a.order as number[]) : []
      const ok = order.length === key.length && order.every((v, i) => v === i)
      const partial = order.filter((v, i) => v === i).length / key.length
      return verdict(ok, partial)
    }
    case 'match': {
      const pairs = Array.isArray(a.pairs) ? (a.pairs as number[]) : []
      const right = pairs.filter((v, i) => v === i).length
      return verdict(pairs.length === key.length && right === key.length, right / key.length)
    }
    case 'sort': {
      const groups = Array.isArray(a.groups) ? (a.groups as number[]) : []
      const right = key.groupsOf.filter((g, i) => groups[i] === g).length
      return verdict(right === key.groupsOf.length, right / key.groupsOf.length)
    }
    case 'numberline': {
      const v = typeof a.position === 'number' ? a.position : null
      return verdict(v !== null && close(v, key.answer, key.tolerance))
    }
    case 'clock': {
      const h = typeof a.h === 'number' ? a.h % 12 : -1
      const m = typeof a.m === 'number' ? a.m : -1
      return verdict(h === key.h % 12 && m === key.m)
    }
    case 'fraction': {
      const shaded = typeof a.shaded === 'number' ? a.shaded : -1
      return verdict(shaded >= 0 && shaded * key.den === key.num * key.parts)
    }
    case 'story': {
      const given = Array.isArray(a.parts) ? (a.parts as unknown[]) : []
      const right = key.parts.filter((k, i) => checkAnswer(k, given[i] ?? null).status === 'correct').length
      return verdict(right === key.parts.length, right / key.parts.length)
    }
    case 'listen':
      return verdict(a.choice === key.answer)
    case 'tiles': {
      const words = strings(a.words)
      const given = normaliseSentence(words.join(' '))
      const ok = words.length > 0 && key.answers.some((ans) => normaliseSentence(ans) === given)
      const target = (key.answers[0] ?? '').split(/\s+/).filter(Boolean)
      const partial = target.length === 0 ? 0 : words.filter((w, i) => w === target[i]).length / target.length
      return verdict(ok, partial)
    }
    case 'spell': {
      const given = typeof a.value === 'string' ? normaliseWord(a.value) : ''
      return verdict(given !== '' && key.words.some((w) => normaliseWord(w) === given))
    }
    case 'cloze': {
      const texts = strings(a.texts)
      const right = key.answers.filter((ans, i) => clozeForm(texts[i] ?? '') !== '' && clozeForm(texts[i] ?? '') === clozeForm(ans)).length
      return verdict(right === key.answers.length, right / key.answers.length)
    }
    case 'hotspot': {
      const chosen = [...new Set(strings(a.texts).map((t) => normaliseText(t, false)).filter(Boolean))].sort()
      const want = [...new Set(key.answers.map((t) => normaliseText(t, false)))].sort()
      return verdict(chosen.length === want.length && chosen.every((t, i) => t === want[i]))
    }
    case 'label': {
      const texts = strings(a.texts)
      const right = key.labels.filter((l, i) => normaliseText(texts[i] ?? '', false) !== '' && normaliseText(texts[i] ?? '', false) === normaliseText(l, false)).length
      return verdict(right === key.labels.length, right / key.labels.length)
    }
    case 'table': {
      const texts = strings(a.texts)
      const right = key.blanks.filter((accepted, i) => accepted.some((acc) => cellMatches(texts[i] ?? '', acc))).length
      return verdict(right === key.blanks.length, right / key.blanks.length)
    }
    case 'blocks':
      return verdict(blocksOk(key, parseBlocks(a.blocks)))
    case 'fractionbar':
      return verdict(fractionBarOk(key, parseBars(a.bars)))
    case 'barmodel':
      return verdict(barModelOk(key, parseModel(a.model)))
    case 'tangram': {
      const sc = tangramScore(key, parsePlacements(a.placed, key.slots.length, key.pieces.length))
      return verdict(sc.all, sc.right / key.slots.length)
    }
    case 'geoboard': {
      const pegs = a.closed === true ? parsePegs(a.pegs, key.size) : null
      return verdict(pegs !== null && geoOk(key.rule, analysePegs(pegs)))
    }
    case 'grid': {
      const cells = Array.isArray(a.cells) ? (a.cells as unknown[]).map((c) => (typeof c === 'number' && Number.isInteger(c) ? c : 0)) : []
      const n = key.size * key.size
      const blanks = key.given.filter((g) => g === 0).length
      const right = key.given.filter((g, i) => g === 0 && cells[i] === key.solution[i]).length
      const partial = blanks === 0 ? 0 : right / blanks
      const keepsGiven = key.given.every((g, i) => g === 0 || cells[i] === g)
      return verdict(cells.length === n && keepsGiven && gridRulesOk(key.puzzle, key.size, cells, key.values), partial)
    }
  }
}

/** Teks kunci untuk pembahasan dan kertas kunci. */
export function answerText(item: Item, lang: 'en-GB' | 'id' = 'en-GB'): string {
  const letter = (i: number) => String.fromCharCode(65 + i)
  switch (item.type) {
    case 'mcq': {
      const o = item.options[item.answer]
      return o?.text ? `${letter(item.answer)}. ${o.text}` : letter(item.answer)
    }
    case 'multi':
      return item.answers.map((i) => (item.options[i]?.text ? `${letter(i)}. ${item.options[i]?.text}` : letter(i))).join('; ')
    case 'numeric':
      return `${formatNumber(item.answer)}${item.unit ? ` ${item.unit}` : ''}`
    case 'text':
      return item.blanks.map((b) => b.answers[0]).join(', ')
    case 'order':
      return item.items.join(', ')
    case 'match':
      return item.pairs.map(([l, r]) => `${l}: ${r}`).join('; ')
    case 'sort':
      return item.groups.map((g, gi) => `${g}: ${item.items.filter((i) => i.group === gi).map((i) => i.text).join(', ')}`).join('; ')
    case 'numberline':
      return formatNumber(item.answer)
    case 'clock':
      return `${item.answer.h}:${String(item.answer.m).padStart(2, '0')}`
    case 'fraction':
      return `${item.answer.num}/${item.answer.den}`
    case 'story':
      return item.parts
        .map((part, i) => {
          const text = part.type === 'mcq' ? (part.options[part.answer]?.text ?? letter(part.answer)) : part.type === 'numeric' ? `${formatNumber(part.answer)}${part.unit ? ` ${part.unit}` : ''}` : part.answers[0]
          return `${i + 1}. ${text}`
        })
        .join('; ')
    case 'listen': {
      const o = item.options[item.answer]
      return `${o?.text ? `${letter(item.answer)}. ${o.text}` : letter(item.answer)}. The audio said: "${item.listenText}"`
    }
    case 'tiles':
      return item.answer
    case 'spell':
      return item.word
    case 'cloze':
      return item.gaps.map((g) => g.options[g.answer]).join(', ')
    case 'hotspot':
      return item.answers.map((i) => item.regions[i]?.label).join(', ')
    case 'label':
      return item.labels.map((l, i) => `${i + 1}. ${l}`).join('; ')
    case 'table':
      return item.blanks.map((b) => b.answers[0]).join(', ')
    case 'grid':
      return item.filled.map((r) => r.join(' ')).join(' / ')
    case 'blocks': {
      const t = item.target
      const parts = [t.h > 0 ? `${t.h} hundreds` : '', t.t > 0 || item.places === 'to' ? `${t.t} tens` : '', `${t.o} ones`].filter(Boolean)
      return `${t.h * 100 + t.t * 10 + t.o}: ${parts.join(', ')}`
    }
    case 'fractionbar':
      return item.targets.map((t, i) => (t ? `bar ${i + 1}: ${t.num}/${t.den}` : null)).filter(Boolean).join('; ') || (item.relation === 'lt' ? 'Bar 2 shows less than bar 1' : item.relation === 'gt' ? 'Bar 2 shows more than bar 1' : 'The bars show the same amount')
    case 'barmodel':
      return item.bars.map((b) => `${b.label}: ${b.units} unit${b.units === 1 ? '' : 's'}`).join('; ') + (item.unitValue !== undefined ? `; 1 unit = ${item.unitValue}` : '')
    case 'tangram':
      return `${item.slots.length} pieces placed`
    case 'geoboard': {
      const info = analysePegs(item.example)
      return `For example ${item.example.map((p) => `(${p[0]},${p[1]})`).join(' ')}: ${info.sides} sides, area ${formatLength(info.area)}, perimeter ${formatLength(info.perimeter)}`
    }
    case 'write':
    case 'speak':
    case 'draw':
    case 'photo':
      return lang === 'id' ? 'Dinilai tutor' : 'Marked by your tutor'
  }
}

export function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 1e6) / 1e6)
}
