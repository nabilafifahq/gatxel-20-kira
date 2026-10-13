import type { Candidate, ParsedRows } from '../types'
import { clean, needsPicture, unsafeForKids } from './common'

/**
 * GSM8K (MIT): soal cerita Math tingkat SD akhir. Hanya yang mudah: paling banyak 3 langkah penyelesaian,
 * bilangan dalam soal paling besar 1000, jawaban bilangan bulat 0 sampai 1000, soal pendek.
 * Format JSONL: {"question": "...", "answer": "langkah dengan <<hitungan>> ... #### 18"}.
 */

export const GSM8K_LIMITS = { maxSteps: 3, maxNumber: 1000, maxQuestionChars: 300 } as const

export function parseGsm8k(jsonl: string): ParsedRows {
  const rows: (Candidate | null)[] = []
  let index = 0
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue
    index++
    rows.push(toCandidate(line, index))
  }
  return { rows, rawCount: rows.length }
}

function toCandidate(line: string, index: number): Candidate | null {
  let raw: { question?: unknown; answer?: unknown }
  try {
    raw = JSON.parse(line) as { question?: unknown; answer?: unknown }
  } catch {
    return null
  }
  if (typeof raw.question !== 'string' || typeof raw.answer !== 'string') return null
  const parts = raw.answer.split('####')
  if (parts.length !== 2) return null
  const final = parts[1]!.trim().replace(/,/g, '')
  if (!/^\d+$/.test(final)) return null
  const value = Number(final)
  if (value > GSM8K_LIMITS.maxNumber) return null
  const steps = parts[0]!
    .split('\n')
    .map((s) => clean(s.replace(/<<[^>]*>>/g, '')))
    .filter(Boolean)
  if (steps.length < 1 || steps.length > GSM8K_LIMITS.maxSteps) return null
  const prompt = clean(raw.question)
  if (prompt.length < 20 || prompt.length > GSM8K_LIMITS.maxQuestionChars || unsafeForKids(prompt, ...steps) || needsPicture(prompt)) return null
  const numbers = (prompt.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => Number(n.replace(/,/g, '')))
  if (numbers.some((n) => n > GSM8K_LIMITS.maxNumber)) return null
  // Pecahan, persen, dan desimal di soal biasanya di atas kelas 4.
  const hard = /%|\bpercent\b|\d\.\d|\bfraction\b|\bratio\b|\baverage\b/i.test(prompt)
  const big = numbers.some((n) => n > 100)
  const grade = Math.min(6, 3 + (steps.length >= 3 ? 1 : 0) + (big ? 1 : 0) + (hard ? 1 : 0))
  if (steps.some((s) => s.length > 220)) return null
  return {
    externalId: `gsm8k-${index}`,
    subject: 'math',
    grade,
    type: 'numeric',
    prompt,
    answer: value,
    steps,
    difficulty: Math.min(5, steps.length + 1 + (big ? 1 : 0)),
  }
}
