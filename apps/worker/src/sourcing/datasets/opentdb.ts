import { createHash } from 'node:crypto'
import type { Candidate, ParsedRows } from '../types'
import { clean, needsPicture, unsafeForKids } from './common'

/**
 * Open Trivia DB (CC BY-SA 4.0): kuis pengetahuan umum. Hanya tingkat mudah, pilihan ganda, dan kategori yang aman
 * untuk anak SD. Jawaban dari API dibuat bersandi url3986 (encode=url3986) supaya tanda kutip dan entitas aman.
 * Kategori Pengetahuan Umum tidak punya skill di Kira, jadi disimpan tanpa skill (untuk Arena Pengetahuan).
 */

export const OPENTDB_CATEGORIES: Record<number, { name: string; skillStrands: string[] | null }> = {
  9: { name: 'General Knowledge', skillStrands: null },
  17: { name: 'Science & Nature', skillStrands: ['Bs', 'Bp', 'Be', 'Cm', 'Cp', 'Cc', 'Pf', 'Pe', 'Pl', 'TWS'] },
  22: { name: 'Geography', skillStrands: ['ESp', 'ESc'] },
  27: { name: 'Animals', skillStrands: ['Bs', 'Bp', 'Be'] },
}

/** Jeda minimum antar permintaan API menurut aturan pemakaian Open Trivia DB (satu permintaan per 5 detik). */
export const OPENTDB_GAP_MS = 5_200

export function openTdbUrl(category: number, amount: number): string {
  return `https://opentdb.com/api.php?amount=${Math.min(50, Math.max(1, amount))}&category=${category}&difficulty=easy&type=multiple&encode=url3986`
}

type Raw = { type?: string; difficulty?: string; category?: string; question?: string; correct_answer?: string; incorrect_answers?: string[] }

const decode = (s: string): string => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** Urutan opsi tetap untuk soal yang sama: diacak dari hash teks soal, bukan acak sungguhan. */
function arrange(correct: string, wrong: string[], seed: string): { options: string[]; answer: number } {
  const all = [correct, ...wrong]
  const h = createHash('sha256').update(seed).digest()
  const order = all.map((_, i) => i).sort((a, b) => h[a % h.length]! - h[b % h.length]! || a - b)
  const options = order.map((i) => all[i]!)
  return { options, answer: options.indexOf(correct) }
}

export function parseOpenTdb(json: string, category: number): ParsedRows {
  let data: { response_code?: number; results?: Raw[] }
  try {
    data = JSON.parse(json) as typeof data
  } catch {
    return { rows: [], rawCount: 0 }
  }
  if (data.response_code !== 0 || !Array.isArray(data.results)) return { rows: [], rawCount: 0 }
  const rows: (Candidate | null)[] = data.results.map((r) => toCandidate(r, category))
  return { rows, rawCount: rows.length }
}

function toCandidate(r: Raw, category: number): Candidate | null {
  const cat = OPENTDB_CATEGORIES[category]
  if (!cat || r.type !== 'multiple' || r.difficulty !== 'easy') return null
  if (typeof r.question !== 'string' || typeof r.correct_answer !== 'string' || !Array.isArray(r.incorrect_answers) || r.incorrect_answers.length !== 3) return null
  const prompt = clean(decode(r.question))
  const correct = clean(decode(r.correct_answer))
  const wrong = r.incorrect_answers.map((w) => clean(decode(w)))
  const { options, answer } = arrange(correct, wrong, prompt)
  if (prompt.length < 10 || prompt.length > 200 || options.some((o) => !o || o.length > 60) || new Set(options.map((o) => o.toLowerCase())).size !== 4) return null
  if (unsafeForKids(prompt, ...options) || needsPicture(prompt)) return null
  if (options.some((o) => /\b(all|none|both) of the above\b/i.test(o))) return null
  return {
    externalId: `opentdb-${createHash('sha1').update(prompt).digest('hex').slice(0, 12)}`,
    subject: 'science',
    grade: 3,
    type: 'mcq',
    prompt,
    options,
    answer,
    topicHint: cat.name,
    difficulty: 2,
  }
}
