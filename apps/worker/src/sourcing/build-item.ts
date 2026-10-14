import { createHash } from 'node:crypto'
import { itemSchema, type Item } from '@kira/content/schema'
import { semanticProblems } from '@kira/content/load'
import { sourceTag } from '@kira/content/sources'
import type { Candidate, Mapping } from './types'

/**
 * Candidate + pemetaan menjadi soal Kira lengkap (itemSchema, id "draft"). Soal diperiksa dengan skema dan
 * pemeriksaan isi yang sama dengan content:check; yang gagal tidak dipublikasikan.
 */

const HINTS: Record<'math' | 'science' | 'english', [string, string, string]> = {
  english: ['Read both sentences slowly.', 'Say each sentence quietly in your head.', 'Pick the one that sounds right and follows the grammar rule.'],
  math: ['Read the question again slowly.', 'Write down the numbers you need.', 'Check your answer by working it out another way.'],
  science: ['Read the question and every option.', 'Cross out the options that cannot be right.', 'Think about what you have seen or learnt in class.'],
}

/** Teks dibuat normal untuk dedupe: huruf kecil, hanya huruf dan angka. */
export function normalisePrompt(prompt: string): string {
  return prompt.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Kunci dedupe lintas sumber: soal yang sama dari dua sumber hanya dicatat sekali. */
export function promptHash(prompt: string): string {
  return createHash('sha256').update(normalisePrompt(prompt)).digest('hex')
}

function trimTo(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 3).trimEnd()}...`
}

export type Built = { ok: true; item: Item } | { ok: false; reason: string }

export function buildItem(c: Candidate, map: Mapping, sourceId: string): Built {
  const subject = c.subject
  const solution = (c.steps ?? []).slice(0, 8).map((s) => ({ say: trimTo(s, 220) }))
  const common = {
    id: 'draft',
    skill: map.skillId,
    difficulty: Math.min(5, Math.max(1, c.difficulty)),
    prompt: trimTo(c.prompt, 900),
    lang: 'en-GB' as const,
    hints: HINTS[subject],
    tags: [sourceTag(sourceId)],
    source: 'imported' as const,
  }
  let raw: unknown
  if (c.type === 'mcq') {
    const correct = c.options?.[c.answer]
    if (!c.options || correct === undefined) return { ok: false, reason: 'kunci di luar opsi' }
    raw = {
      ...common,
      type: 'mcq',
      options: c.options.map((text) => ({ text })),
      answer: c.answer,
      explanation: trimTo(c.explanation ?? `The correct answer is "${correct}".`, 600),
    }
  } else {
    const steps = (c.steps ?? []).join(' ')
    raw = {
      ...common,
      type: 'numeric',
      answer: c.answer,
      tolerance: 0,
      ...(c.unit ? { unit: c.unit } : {}),
      ...(c.allowDecimal ? { allowDecimal: true } : {}),
      explanation: trimTo(steps ? `${steps} The answer is ${c.answer}.` : `The answer is ${c.answer}.`, 600),
      ...(solution.length >= 2 ? { solution } : {}),
    }
  }
  const parsed = itemSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, reason: `skema: ${parsed.error.issues[0]?.path.join('.') || 'soal'} tidak valid` }
  const problems = semanticProblems(parsed.data)
  if (problems.length > 0) return { ok: false, reason: problems[0]! }
  return { ok: true, item: parsed.data }
}
