import type { ClientItem, ClientPart } from '@kira/content/present'

/**
 * Pembaca nilai jawaban yang aman. Nilai datang dari state runner atau dari
 * jawaban tersimpan di server (SavedResponse.answer), jadi selalu diperiksa bentuknya.
 */

function rec(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

export function asChoice(v: unknown): number | null {
  const r = rec(v)
  return r && isNum(r.choice) ? r.choice : null
}

export function asChoices(v: unknown): number[] {
  const r = rec(v)
  return r && Array.isArray(r.choices) ? r.choices.filter(isNum) : []
}

export function asValue(v: unknown): string {
  const r = rec(v)
  if (!r) return ''
  if (typeof r.value === 'string') return r.value
  if (isNum(r.value)) return String(r.value)
  return ''
}

export function asTexts(v: unknown, n: number): string[] {
  const r = rec(v)
  const list = r && Array.isArray(r.texts) ? r.texts : []
  return Array.from({ length: n }, (_, i) => (typeof list[i] === 'string' ? (list[i] as string) : ''))
}

export function asOrder(v: unknown): number[] {
  const r = rec(v)
  return r && Array.isArray(r.order) ? r.order.filter(isNum) : []
}

/** Pasangan per kiri; -1 berarti belum dipasangkan. */
export function asPairs(v: unknown, n: number): number[] {
  const r = rec(v)
  const list = r && Array.isArray(r.pairs) ? r.pairs : []
  return Array.from({ length: n }, (_, i) => (isNum(list[i]) ? (list[i] as number) : -1))
}

/** Grup per kartu (indeks asli); -1 berarti belum dikelompokkan. */
export function asGroups(v: unknown, n: number): number[] {
  const r = rec(v)
  const list = r && Array.isArray(r.groups) ? r.groups : []
  return Array.from({ length: n }, (_, i) => (isNum(list[i]) ? (list[i] as number) : -1))
}

export function asPosition(v: unknown): number | null {
  const r = rec(v)
  return r && isNum(r.position) ? r.position : null
}

export function asClock(v: unknown): { h: number; m: number } | null {
  const r = rec(v)
  return r && isNum(r.h) && isNum(r.m) ? { h: r.h, m: r.m } : null
}

export function asShaded(v: unknown): number | null {
  const r = rec(v)
  return r && isNum(r.shaded) ? r.shaded : null
}

export function asText(v: unknown): string {
  const r = rec(v)
  return r && typeof r.text === 'string' ? r.text : ''
}

export function asMedia(v: unknown): string | null {
  const r = rec(v)
  return r && typeof r.mediaId === 'string' && r.mediaId !== '' ? r.mediaId : null
}

/** Kata yang sudah disusun (susun kata), urut dari kiri. */
export function asWords(v: unknown): string[] {
  const r = rec(v)
  return r && Array.isArray(r.words) ? r.words.filter((w): w is string => typeof w === 'string') : []
}

/** Isi sel kotak, datar baris demi baris; 0 berarti kosong. */
export function asCells(v: unknown, n: number): number[] {
  const r = rec(v)
  const list = r && Array.isArray(r.cells) ? r.cells : []
  return Array.from({ length: n }, (_, i) => (isNum(list[i]) ? (list[i] as number) : 0))
}

/** Jawaban per pertanyaan di soal cerita bertahap; null bila belum dijawab. */
export function asParts(v: unknown, n: number): (unknown | null)[] {
  const r = rec(v)
  const list = r && Array.isArray(r.parts) ? r.parts : []
  return Array.from({ length: n }, (_, i) => (list[i] ?? null))
}

export function countWords(text: string): number {
  const t = text.trim()
  return t === '' ? 0 : t.split(/\s+/).length
}

/** Jumlah titik kosong ___ di teks soal. */
export function blankCount(prompt: string): number {
  return (prompt.match(/_{3,}/g) ?? []).length
}

/** Satu pertanyaan soal cerita sudah dijawab. */
export function isPartComplete(part: ClientPart, v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (part.type === 'mcq') return asChoice(v) !== null
  if (part.type === 'numeric') {
    const s = asValue(v).trim()
    return s !== '' && s !== '-' && !/[.,]$/.test(s)
  }
  return asTexts(v, 1).every((t) => t.trim() !== '')
}

/** Apakah jawaban sudah lengkap sehingga tombol Check boleh aktif. */
export function isAnswerComplete(item: ClientItem, v: unknown): boolean {
  if (v === null || v === undefined) return false
  switch (item.type) {
    case 'mcq':
      return asChoice(v) !== null
    case 'multi': {
      const n = asChoices(v).length
      return item.multiCount ? n === item.multiCount : n > 0
    }
    case 'numeric': {
      const s = asValue(v).trim()
      return s !== '' && s !== '-' && !/[.,]$/.test(s)
    }
    case 'text':
      return asTexts(v, item.blanks ?? 1).every((t) => t.trim() !== '')
    case 'order': {
      const order = asOrder(v)
      return order.length === (item.orderItems?.length ?? 0) && order.every((x) => x >= 0)
    }
    case 'match':
      return asPairs(v, item.matchLeft?.length ?? 0).every((p) => p >= 0)
    case 'sort':
      return asGroups(v, item.sortItems?.length ?? 0).every((g) => g >= 0)
    case 'numberline':
      return asPosition(v) !== null
    case 'clock':
      return asClock(v) !== null
    case 'fraction':
      return asShaded(v) !== null
    case 'write': {
      const words = countWords(asText(v))
      if (words === 0) return false
      if (item.minWords && words < item.minWords) return false
      if (item.maxWords && words > item.maxWords) return false
      return true
    }
    case 'speak':
    case 'draw':
    case 'photo':
      return asMedia(v) !== null
    case 'story': {
      const parts = item.parts ?? []
      const given = asParts(v, parts.length)
      return parts.every((part, k) => isPartComplete(part, given[k]))
    }
    case 'listen':
      return asChoice(v) !== null
    case 'tiles':
      return asWords(v).length >= 2
    case 'spell':
      return asValue(v).trim().length >= 1
    case 'cloze':
      return asTexts(v, item.cloze?.length ?? 1).every((t) => t.trim() !== '')
    case 'hotspot':
      return asTexts(v, 8).filter((t) => t !== '').length === (item.hotspot?.count ?? 1)
    case 'label':
      return asTexts(v, item.labelDiagram?.spots.length ?? 0).every((t) => t !== '')
    case 'table':
      return asTexts(v, item.table?.blanks.length ?? 0).every((t) => t.trim() !== '')
    case 'grid': {
      const n = (item.grid?.size ?? 0) ** 2
      const cells = asCells(v, n)
      return n > 0 && cells.every((c) => c !== 0)
    }
  }
}

/** Teks jawaban learner untuk dibacakan atau ditampilkan ringkas. */
export function isManualType(type: ClientItem['type']): boolean {
  return type === 'write' || type === 'speak' || type === 'draw' || type === 'photo'
}

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

export function letterAt(i: number): string {
  return LETTERS[i] ?? String(i + 1)
}
