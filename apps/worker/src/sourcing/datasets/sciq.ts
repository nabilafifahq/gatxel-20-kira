import type { Candidate } from '../types'
import { clean, needsPicture, unsafeForKids } from './common'
import { arrangeOptions, primaryGrade, type HfRowsPage } from './primary'
import type { HfParsed } from './science-mcq'

/**
 * SciQ (Allen AI, CC BY-NC 3.0): soal ujian sains hasil urunan massa. Setiap soal punya satu jawaban benar dan tiga pengecoh.
 * Aslinya setingkat SD sampai SMA, jadi hanya soal yang lolos penyaring tingkat SD (primary.ts) yang dipakai.
 * Baris: { question, distractor1..3, correct_answer, support }.
 */

export function parseSciq(json: string): HfParsed {
  let page: HfRowsPage
  try {
    page = JSON.parse(json) as HfRowsPage
  } catch {
    return { rows: [], rawCount: 0, total: 0 }
  }
  const rows = (page.rows ?? []).map((r) => (r.row ? toCandidate(r.row, r.row_idx ?? 0) : null))
  return { rows, rawCount: rows.length, total: page.num_rows_total ?? 0 }
}

const str = (v: unknown): string | null => (typeof v === 'string' ? clean(v) : null)

function toCandidate(row: Record<string, unknown>, idx: number): Candidate | null {
  const prompt = str(row.question)
  const correct = str(row.correct_answer)
  const wrong = [str(row.distractor1), str(row.distractor2), str(row.distractor3)]
  if (!prompt || !correct || wrong.some((w) => !w)) return null
  const { options, answer } = arrangeOptions(correct, wrong as string[], prompt)
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4 || options.some((o) => o.length > 40)) return null
  if (!/[?]$/.test(prompt) || needsPicture(prompt) || unsafeForKids(prompt, ...options)) return null
  const grade = primaryGrade(prompt, options)
  if (grade === null) return null
  return { externalId: `sciq-${idx}`, subject: 'science', grade, type: 'mcq', prompt, options, answer, difficulty: grade <= 3 ? 2 : 3 }
}
