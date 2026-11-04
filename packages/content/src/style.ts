import type { Item } from './schema'

/**
 * Gaya soal untuk filter di Latihan Bebas. "mixed" berarti tanpa filter. Penggolongan murni dari jenis dan panjang
 * teks, jadi berlaku untuk soal repo, soal org, dan soal generator tanpa tanda tambahan.
 */
export const QUESTION_STYLES = ['short', 'true-false', 'long-read', 'word-problem', 'mixed'] as const
export type QuestionStyle = (typeof QUESTION_STYLES)[number]
export type ClassifiedStyle = Exclude<QuestionStyle, 'mixed'>

const TF = new Set(['true', 'false'])

/** Soal benar atau salah: pilihan ganda dengan dua opsi, "True" dan "False". */
export function isTrueFalse(item: { type: string; options?: readonly { text?: string | undefined }[] }): boolean {
  if (item.type !== 'mcq' || !item.options || item.options.length !== 2) return false
  const t = item.options.map((o) => (o.text ?? '').trim().toLowerCase())
  return TF.has(t[0]!) && TF.has(t[1]!) && t[0] !== t[1]
}

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length

export const LONG_READ_CHARS = 260
export const WORD_PROBLEM_WORDS = 14

/**
 * Golongan satu soal. Urutan: benar atau salah, bacaan panjang (ada passage, cerita, dengar, atau teks panjang),
 * soal cerita (matematika berbahasa dengan angka dan teks cukup panjang), lalu pendek.
 */
export function classifyStyle(item: Item): ClassifiedStyle {
  if (isTrueFalse(item as { type: string; options?: { text?: string }[] })) return 'true-false'
  const long = item.prompt.length >= LONG_READ_CHARS || Boolean(item.passage) || item.type === 'story' || item.type === 'listen'
  if (long) return 'long-read'
  const isMath = item.skill.startsWith('m')
  if (item.tags.includes('word-problem') || (isMath && wordCount(item.prompt) >= WORD_PROBLEM_WORDS && /\d/.test(item.prompt) && /[a-z]{3,}/i.test(item.prompt))) return 'word-problem'
  return 'short'
}

/** Apakah soal cocok dengan pilihan gaya. "mixed" menerima semua. */
export function matchesStyle(item: Item, style: QuestionStyle): boolean {
  return style === 'mixed' || classifyStyle(item) === style
}

export const QUESTION_STYLE_LABEL: Record<QuestionStyle, string> = {
  short: 'Short questions',
  'true-false': 'True or false',
  'long-read': 'Long reading',
  'word-problem': 'Word problems',
  mixed: 'Mixed',
}
