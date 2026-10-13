import type { Candidate, ParsedRows } from '../types'
import { clean, needsPicture, unsafeForKids } from './common'

/**
 * Pilihan ganda Science dari dataset terbuka di Hugging Face (datasets-server, JSON):
 * ARC Easy (CC BY-SA 4.0) dan OpenBookQA (Apache 2.0). Baris berbentuk
 * { row_idx, row: { id, question | question_stem, choices: { text[], label[] }, answerKey } }.
 */

type HfPage = { rows?: { row_idx?: number; row?: Record<string, unknown> }[]; num_rows_total?: number }

export type HfParsed = ParsedRows & { total: number }

export const SCIENCE_LIMITS = { maxQuestionChars: 220, maxOptionChars: 70, minOptions: 3, maxOptions: 4 } as const

/** Kelas ARC dari kode soal, misalnya "NYSEDREGENTS_2008_4_26" atau "MCAS_2009_5_6516". Null bila tidak ada. */
export function arcGrade(id: string): number | null {
  const m = /_(\d{1,2})_/.exec(id)
  if (!m) return null
  const g = Number(m[1])
  return g >= 3 && g <= 6 ? g : null
}

function choicesOf(row: Record<string, unknown>): { text: string[]; label: string[] } | null {
  const c = row.choices as { text?: unknown; label?: unknown } | undefined
  if (!c || !Array.isArray(c.text) || !Array.isArray(c.label) || c.text.length !== c.label.length) return null
  if (!c.text.every((t) => typeof t === 'string') || !c.label.every((t) => typeof t === 'string')) return null
  return { text: c.text as string[], label: c.label as string[] }
}

type Variant = { sourceId: 'arc-easy' | 'openbookqa'; promptOf: (row: Record<string, unknown>) => string | null; gradeOf: (id: string) => number | null }

const VARIANTS: Record<Variant['sourceId'], Variant> = {
  'arc-easy': { sourceId: 'arc-easy', promptOf: (r) => (typeof r.question === 'string' ? r.question : null), gradeOf: arcGrade },
  // OpenBookQA tidak berlabel kelas; isinya fakta Science tingkat SD, dipetakan ke kelas 4.
  openbookqa: {
    sourceId: 'openbookqa',
    promptOf: (r) => {
      const stem = typeof r.question_stem === 'string' ? clean(r.question_stem) : null
      if (!stem) return null
      return /[?]$/.test(stem) ? stem : `Finish the sentence: ${stem}`
    },
    gradeOf: () => 4,
  },
}

export function parseScienceRows(json: string, source: Variant['sourceId']): HfParsed {
  const variant = VARIANTS[source]
  let page: HfPage
  try {
    page = JSON.parse(json) as HfPage
  } catch {
    return { rows: [], rawCount: 0, total: 0 }
  }
  const rows: (Candidate | null)[] = []
  for (const r of page.rows ?? []) {
    rows.push(r.row ? toCandidate(r.row, variant) : null)
  }
  return { rows, rawCount: rows.length, total: page.num_rows_total ?? 0 }
}

function toCandidate(row: Record<string, unknown>, v: Variant): Candidate | null {
  const id = typeof row.id === 'string' ? row.id : null
  const rawPrompt = v.promptOf(row)
  const choices = choicesOf(row)
  const key = typeof row.answerKey === 'string' ? row.answerKey.trim() : null
  if (!id || !rawPrompt || !choices || !key) return null
  const grade = v.gradeOf(id)
  if (grade === null) return null
  const prompt = clean(rawPrompt)
  const options = choices.text.map(clean)
  const answer = choices.label.findIndex((l) => l.trim().toUpperCase() === key.toUpperCase() || l.trim() === key)
  if (answer < 0) return null
  if (options.length < SCIENCE_LIMITS.minOptions || options.length > SCIENCE_LIMITS.maxOptions) return null
  if (prompt.length < 10 || prompt.length > SCIENCE_LIMITS.maxQuestionChars) return null
  if (options.some((o) => !o || o.length > SCIENCE_LIMITS.maxOptionChars) || new Set(options.map((o) => o.toLowerCase())).size !== options.length) return null
  if (unsafeForKids(prompt, ...options) || needsPicture(prompt)) return null
  if (options.some((o) => /\b(all|none|both) of the (above|these)\b|\bnone of the above\b/i.test(o))) return null
  return {
    externalId: `${v.sourceId}-${id}`,
    subject: 'science',
    grade,
    type: 'mcq',
    prompt,
    options,
    answer,
    difficulty: grade <= 3 ? 2 : grade === 4 ? 3 : 4,
  }
}
