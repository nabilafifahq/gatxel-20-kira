import type { Candidate, ParsedRows } from '../types'
import { clean, unsafeForKids } from './common'

/**
 * TabMWP (Lu dkk. 2022, CC BY-NC-SA 4.0): soal cerita Math berbentuk tabel, berlabel kelas 1 sampai 8. Hanya kelas 1 sampai 6
 * dan hanya dua bentuk jawaban yang bisa dinilai otomatis: bilangan (free_text, bulat atau desimal) dan pilihan ganda.
 * Tabel ditulis sebagai teks di dalam soal ("Nama | Jumlah", satu baris per baris tabel). Berkas JSON berbentuk objek { id: soal }.
 */

export const TABMWP_LIMITS = { maxPrompt: 700, maxRows: 9, maxCols: 4, maxChoice: 40 } as const

type Raw = {
  question?: unknown
  choices?: unknown
  answer?: unknown
  unit?: unknown
  table_title?: unknown
  table?: unknown
  row_num?: unknown
  column_num?: unknown
  solution?: unknown
  ques_type?: unknown
  ans_type?: unknown
  grade?: unknown
}

export function parseTabmwp(json: string): ParsedRows {
  let data: Record<string, Raw>
  try {
    data = JSON.parse(json) as Record<string, Raw>
  } catch {
    return { rows: [], rawCount: 0 }
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { rows: [], rawCount: 0 }
  const keys = Object.keys(data).sort((a, b) => Number(a) - Number(b))
  return { rows: keys.map((k) => toCandidate(k, data[k]!)), rawCount: keys.length }
}

function stepsOf(solution: unknown): string[] {
  if (typeof solution !== 'string') return []
  return solution
    .split(/\n+/)
    .map((s) => clean(s))
    .filter((s) => s.length > 0 && s.length <= 200)
    .slice(0, 8)
}

function toCandidate(id: string, r: Raw): Candidate | null {
  const grade = typeof r.grade === 'number' ? r.grade : 0
  if (!Number.isInteger(grade) || grade < 1 || grade > 6) return null
  if (typeof r.question !== 'string' || typeof r.table !== 'string') return null
  if (typeof r.row_num === 'number' && r.row_num > TABMWP_LIMITS.maxRows) return null
  if (typeof r.column_num === 'number' && r.column_num > TABMWP_LIMITS.maxCols) return null
  const title = typeof r.table_title === 'string' ? clean(r.table_title) : ''
  const table = r.table
    .split('\n')
    .map((l) => clean(l))
    .join('\n')
  const question = clean(r.question).replace(/^Look at the table\.\s*Then answer the question\.\s*/i, '')
  const prompt = `${title ? `${title}\n` : ''}${table}\n\n${question}`
  if (prompt.length > TABMWP_LIMITS.maxPrompt || unsafeForKids(prompt)) return null
  const base = { externalId: `tabmwp-${id}`, subject: 'math' as const, grade, topicHint: 'table-data', difficulty: Math.min(4, Math.max(1, Math.ceil(grade / 2) + 1)), steps: stepsOf(r.solution) }

  if (r.ques_type === 'free_text' && (r.ans_type === 'integer_number' || r.ans_type === 'decimal_number')) {
    const raw = typeof r.answer === 'string' ? r.answer.replace(/,/g, '').trim() : ''
    if (!/^-?\d+(\.\d+)?$/.test(raw)) return null
    const unit = typeof r.unit === 'string' && r.unit.trim() && r.unit.length <= 20 ? clean(r.unit) : undefined
    return { ...base, type: 'numeric', prompt, answer: Number(raw), allowDecimal: r.ans_type === 'decimal_number', ...(unit ? { unit } : {}) }
  }
  if (r.ques_type === 'multi_choice' && Array.isArray(r.choices) && r.choices.every((c) => typeof c === 'string')) {
    const options = (r.choices as string[]).map(clean)
    const answer = options.indexOf(typeof r.answer === 'string' ? clean(r.answer) : '')
    if (options.length < 2 || options.length > 5 || answer < 0 || options.some((o) => !o || o.length > TABMWP_LIMITS.maxChoice) || new Set(options).size !== options.length) return null
    return { ...base, type: 'mcq', prompt, options, answer }
  }
  return null
}
