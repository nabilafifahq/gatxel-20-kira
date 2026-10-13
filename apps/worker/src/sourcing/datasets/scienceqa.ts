import type { Candidate } from '../types'
import { clean, needsPicture, unsafeForKids } from './common'
import { SCIENCE_LIMITS, type HfParsed } from './science-mcq'

/**
 * ScienceQA (HF: CC BY-SA 4.0, GitHub: CC BY-NC-SA 4.0, jadi diperlakukan nonkomersial dan share-alike): soal
 * kurikulum K12 berlabel kelas 1 sampai 12. Hanya soal tanpa gambar, bidang natural science, kelas 1 sampai 6.
 * Baris datasets-server: { image, question, choices[], answer (indeks), hint, grade ("grade2"), subject, topic, solution }.
 */

type HfPage = { rows?: { row_idx?: number; row?: Record<string, unknown> }[]; num_rows_total?: number }

export function parseScienceQa(json: string): HfParsed {
  let page: HfPage
  try {
    page = JSON.parse(json) as HfPage
  } catch {
    return { rows: [], rawCount: 0, total: 0 }
  }
  const rows: (Candidate | null)[] = (page.rows ?? []).map((r) => (r.row ? toCandidate(r.row, r.row_idx ?? 0) : null))
  return { rows, rawCount: rows.length, total: page.num_rows_total ?? 0 }
}

function toCandidate(row: Record<string, unknown>, idx: number): Candidate | null {
  if (row.image !== null && row.image !== undefined) return null
  if (row.subject !== 'natural science') return null
  const g = typeof row.grade === 'string' ? /^grade(\d{1,2})$/.exec(row.grade) : null
  const grade = g ? Number(g[1]) : 0
  if (grade < 1 || grade > 6) return null
  const choices = Array.isArray(row.choices) && row.choices.every((c) => typeof c === 'string') ? (row.choices as string[]).map(clean) : null
  const answer = typeof row.answer === 'number' && Number.isInteger(row.answer) ? row.answer : -1
  if (typeof row.question !== 'string' || !choices || answer < 0 || answer >= choices.length) return null
  const hint = typeof row.hint === 'string' ? clean(row.hint) : ''
  // Konteks (hint) dibaca sebelum pertanyaan; soal dengan konteks panjang dilewati.
  const prompt = clean(hint ? `${hint} ${row.question}` : row.question)
  if (prompt.length < 10 || prompt.length > 300) return null
  if (choices.length < 2 || choices.length > SCIENCE_LIMITS.maxOptions || choices.some((c) => !c || c.length > SCIENCE_LIMITS.maxOptionChars) || new Set(choices.map((c) => c.toLowerCase())).size !== choices.length) return null
  if (unsafeForKids(prompt, ...choices) || needsPicture(prompt) || /\b(select|look at|read) the (picture|image|map|diagram)\b/i.test(prompt)) return null
  const solution = typeof row.solution === 'string' ? clean(row.solution) : ''
  const topic = typeof row.topic === 'string' ? row.topic.replace(/-/g, ' ') : ''
  return {
    externalId: `scienceqa-${idx}`,
    subject: 'science',
    grade,
    type: 'mcq',
    prompt,
    options: choices,
    answer,
    ...(solution && solution.length <= 400 ? { explanation: solution } : {}),
    ...(topic ? { topicHint: topic } : {}),
    difficulty: grade <= 2 ? 1 : grade <= 4 ? 2 : 3,
  }
}
