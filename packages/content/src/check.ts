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
  | { type: 'text'; blanks: { answers: string[]; caseSensitive: boolean }[] }
  | { type: 'order'; length: number }
  | { type: 'match'; length: number }
  | { type: 'sort'; groupsOf: number[] }
  | { type: 'numberline'; answer: number; tolerance: number }
  | { type: 'clock'; h: number; m: number }
  | { type: 'fraction'; num: number; den: number; parts: number }
  | { type: 'write' | 'speak' | 'draw' }

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
      return { type: 'text', blanks: item.blanks.map((b) => ({ answers: b.answers, caseSensitive: b.caseSensitive })) }
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
    case 'write':
    case 'speak':
    case 'draw':
      return { type: item.type }
  }
}

/** "1,5" dan "1.5" sama-sama 1,5. Spasi ribuan dan titik ribuan gaya Indonesia ditolak bila ambigu. */
export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, '').replace(/^\+/, '')
  if (s === '' || s === '-' || s === '.' || s === ',') return null
  // 1/2 sebagai pecahan sederhana
  const frac = /^(-?\d+)\/(\d+)$/.exec(s)
  if (frac) {
    const den = Number(frac[2])
    return den === 0 ? null : Number(frac[1]) / den
  }
  // Satu koma atau satu titik sebagai pemisah desimal.
  if (/^-?\d+[.,]\d+$/.test(s)) return Number(s.replace(',', '.'))
  if (/^-?\d+$/.test(s)) return Number(s)
  // 12.500 atau 12,500 sebagai ribuan (tiga digit setelah pemisah, lebih dari satu kelompok)
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''))
  return null
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

const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol + 1e-9

function isBlank(answer: unknown): boolean {
  if (answer === null || answer === undefined) return true
  if (typeof answer !== 'object') return true
  const a = answer as Record<string, unknown>
  if ('value' in a) return typeof a.value !== 'string' || a.value.trim() === ''
  if ('texts' in a) return !Array.isArray(a.texts) || a.texts.every((t) => typeof t !== 'string' || t.trim() === '')
  if ('choice' in a) return typeof a.choice !== 'number'
  if ('choices' in a) return !Array.isArray(a.choices) || a.choices.length === 0
  if ('text' in a && !('mediaId' in a)) return typeof a.text !== 'string' || a.text.trim() === ''
  return false
}

export function checkAnswer(key: AnswerKey, answer: unknown): CheckResult {
  if (key.type === 'write' || key.type === 'speak' || key.type === 'draw') {
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
      const v = typeof a.value === 'string' ? parseNumber(a.value) : typeof a.value === 'number' ? a.value : null
      if (v === null) return { status: 'wrong', score: 0 }
      const ok = close(v, key.answer, key.tolerance) || (key.acceptAlt ?? []).some((alt) => close(v, alt, key.tolerance))
      return verdict(ok)
    }
    case 'text': {
      const texts = Array.isArray(a.texts) ? (a.texts as unknown[]) : []
      let right = 0
      key.blanks.forEach((b, i) => {
        const given = typeof texts[i] === 'string' ? normaliseText(texts[i] as string, b.caseSensitive) : ''
        if (given !== '' && b.answers.some((ans) => normaliseText(ans, b.caseSensitive) === given)) right++
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
  }
}

/** Teks kunci untuk pembahasan dan kertas kunci. */
export function answerText(item: Item): string {
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
    case 'write':
    case 'speak':
    case 'draw':
      return 'Dinilai tutor'
  }
}

export function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 1e6) / 1e6)
}
