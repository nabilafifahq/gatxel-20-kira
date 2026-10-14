import { createHash } from 'node:crypto'
import type { Candidate } from '../types'
import { clean, needsPicture, unsafeForKids } from './common'
import { arrangeOptions, primaryGrade, type HfRowsPage } from './primary'
import type { HfParsed } from './science-mcq'

/**
 * QASC (Allen AI, CC BY 4.0): soal sains tingkat SD dengan delapan pilihan dan dua fakta pendukung. Delapan pilihan terlalu
 * banyak untuk anak, jadi dipakai jawaban benar ditambah tiga pengecoh yang dipilih tetap dari hash soal. Hanya soal yang lolos
 * penyaring tingkat SD (primary.ts) yang dipakai. Penjelasan diambil dari "combinedfact".
 * Baris: { id, question, choices: { text[], label[] }, answerKey, fact1, fact2, combinedfact }.
 */

export function parseQasc(json: string): HfParsed {
  let page: HfRowsPage
  try {
    page = JSON.parse(json) as HfRowsPage
  } catch {
    return { rows: [], rawCount: 0, total: 0 }
  }
  const rows = (page.rows ?? []).map((r) => (r.row ? toCandidate(r.row) : null))
  return { rows, rawCount: rows.length, total: page.num_rows_total ?? 0 }
}

function toCandidate(row: Record<string, unknown>): Candidate | null {
  const id = typeof row.id === 'string' ? row.id : null
  const key = typeof row.answerKey === 'string' ? row.answerKey.trim().toUpperCase() : null
  const c = row.choices as { text?: unknown; label?: unknown } | undefined
  if (!id || !key || !c || !Array.isArray(c.text) || !Array.isArray(c.label) || c.text.length !== c.label.length || c.text.length < 4) return null
  if (!c.text.every((t) => typeof t === 'string') || !c.label.every((t) => typeof t === 'string')) return null
  const prompt = typeof row.question === 'string' ? clean(row.question) : null
  const texts = (c.text as string[]).map(clean)
  const at = (c.label as string[]).findIndex((l) => l.trim().toUpperCase() === key)
  if (!prompt || at < 0) return null
  const correct = texts[at]!
  const seed = createHash('sha256').update(`${prompt}|pick`).digest()
  const wrong = texts
    .filter((_, i) => i !== at)
    .map((t, i) => ({ t, k: seed[i % seed.length]! }))
    .sort((a, b) => a.k - b.k || a.t.localeCompare(b.t))
    .slice(0, 3)
    .map((x) => x.t)
  const { options, answer } = arrangeOptions(correct, wrong, prompt)
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4 || options.some((o) => !o || o.length > 40)) return null
  if (!/[?]$/.test(prompt) || needsPicture(prompt) || unsafeForKids(prompt, ...options)) return null
  const grade = primaryGrade(prompt, options)
  if (grade === null) return null
  const fact = typeof row.combinedfact === 'string' ? clean(row.combinedfact) : ''
  return {
    externalId: `qasc-${id}`,
    subject: 'science',
    grade,
    type: 'mcq',
    prompt,
    options,
    answer,
    ...(fact.length >= 10 && fact.length <= 200 ? { explanation: fact.endsWith('.') ? fact : `${fact}.` } : {}),
    difficulty: grade <= 3 ? 2 : 3,
  }
}
