import { O } from './item-schema'
import { AI_TIMEOUT_MS, type AiProvider } from './types'

/**
 * Mengerjakan soal pilihan ganda atau isian angka untuk memeriksa kunci jawaban (rencana 10.7).
 * - Kunci dari sumber: AI mengerjakan sekali. Sama berarti "agree", beda berarti "disagree".
 * - Tanpa kunci: AI mengerjakan dua kali dengan cara berbeda (urutan opsi dibalik dan cara memeriksa lain).
 *   Kunci dipakai hanya bila kedua hasilnya sama ("ai-only"); selain itu tidak ada kunci.
 * Prompt hanya memuat soal, tidak pernah data anak. Pemanggil yang memutuskan ke mana hasilnya pergi
 * (publikasi otomatis hanya bila kunci sumber dan AI sama; selain itu masuk antrean Studio).
 */

export type SolveQuestion = {
  id: number
  prompt: string
  /** Ada = pilihan ganda (jawaban berupa indeks opsi mulai 0). Tidak ada = isian angka. */
  options?: string[]
}

export type SolveVariant = 'direct' | 'cross-check'
export type Verdict = 'agree' | 'disagree' | 'ai-only' | 'unverified'
export type Review = { aiAnswer: number | null; verdict: Verdict }

/** Paling banyak soal per panggilan AI, supaya satu panggilan tetap kecil. */
export const SOLVE_BATCH = 40

const SCHEMA = O({
  answers: {
    type: 'array',
    items: O({
      number: { type: 'integer' },
      answer: {
        type: ['number', 'null'],
        description: 'For a multiple choice question the zero-based index of the correct option (A is 0). For a numeric question the final number. Use null when the question needs a picture you cannot see or when you are not sure.',
      },
    }),
  },
})

const SYSTEM: Record<SolveVariant, string> = {
  direct:
    'You check answers to questions for primary school children. Solve each question carefully, step by step, and give the final answer. Reply only with the JSON object described by the schema.',
  'cross-check':
    'You are a second, independent checker of questions for primary school children. Do not assume the first option that looks right is correct: for multiple choice, test every option against the question and eliminate the wrong ones; for number questions, solve with a different method than the obvious one and double check by estimating. Reply only with the JSON object described by the schema.',
}

const label = (i: number) => 'ABCDEFGH'[i] ?? String(i)

/** Dua jawaban sama: indeks harus persis sama, angka boleh berbeda sangat kecil. */
export function sameAnswer(a: number | null, b: number | null, numeric: boolean): boolean {
  if (a === null || b === null) return false
  if (!numeric) return a === b
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))
}

/**
 * Putuskan hasil pemeriksaan satu soal.
 * sourceKey ada: bandingkan dengan jawaban AI pertama. Tidak ada: dua jawaban AI harus sama.
 * `key` adalah kunci yang boleh dipakai (kunci sumber, atau kunci AI bila dua jawabannya sama), atau null.
 */
export function decideKey(input: { sourceKey: number | null; ai1: number | null; ai2?: number | null; numeric?: boolean }): Review & { key: number | null } {
  const numeric = input.numeric ?? false
  if (input.sourceKey !== null) {
    if (input.ai1 === null) return { aiAnswer: null, verdict: 'unverified', key: input.sourceKey }
    return { aiAnswer: input.ai1, verdict: sameAnswer(input.sourceKey, input.ai1, numeric) ? 'agree' : 'disagree', key: input.sourceKey }
  }
  if (input.ai1 !== null && input.ai2 !== undefined && sameAnswer(input.ai1, input.ai2, numeric)) return { aiAnswer: input.ai1, verdict: 'ai-only', key: input.ai1 }
  return { aiAnswer: input.ai1, verdict: 'unverified', key: null }
}

export type SolveOptions = { subject: string; grade: number; variant: SolveVariant; signal?: AbortSignal }

/** Satu panggilan AI untuk sekumpulan soal. Hasil dipetakan ke nomor soal; nomor yang tidak dijawab bernilai null. */
export async function solveBatch(ai: AiProvider, questions: readonly SolveQuestion[], opts: SolveOptions): Promise<{ answers: Map<number, number | null>; model: string }> {
  // Varian cross-check membalik urutan opsi supaya bias posisi tidak ikut membenarkan kunci.
  const flip = opts.variant === 'cross-check'
  const payload = questions.map((q) => {
    if (!q.options) return { number: q.id, prompt: q.prompt }
    const shown = flip ? [...q.options].reverse() : q.options
    return { number: q.id, prompt: q.prompt, options: shown.map((o, k) => `${label(k)}. ${o}`) }
  })
  const out = await ai.run({
    system: `${SYSTEM[opts.variant]} The questions are ${opts.subject} for Grade ${opts.grade}.`,
    prompt: `For every question, give the final answer as the schema describes.\n\n${JSON.stringify(payload)}`,
    jsonSchema: SCHEMA,
    tier: 'author',
    timeoutMs: AI_TIMEOUT_MS,
    ...(opts.signal ? { signal: opts.signal } : {}),
  })
  const rows = (out.json as { answers?: { number?: unknown; answer?: unknown }[] }).answers ?? []
  const byId = new Map(questions.map((q) => [q.id, q]))
  const answers = new Map<number, number | null>(questions.map((q) => [q.id, null]))
  for (const r of rows) {
    const q = typeof r.number === 'number' ? byId.get(r.number) : undefined
    if (!q || typeof r.answer !== 'number' || !Number.isFinite(r.answer)) continue
    if (q.options) {
      const shown = r.answer
      if (!Number.isInteger(shown) || shown < 0 || shown >= q.options.length) continue
      answers.set(q.id, flip ? q.options.length - 1 - shown : shown)
    } else {
      answers.set(q.id, r.answer)
    }
  }
  return { answers, model: out.model }
}

export type ReviewInput = SolveQuestion & { sourceKey: number | null }

/**
 * Periksa banyak soal: yang bersumber kunci dikerjakan sekali, yang tanpa kunci dikerjakan dua kali.
 * `calls` = jumlah panggilan AI yang dipakai (untuk batas mingguan). Kesalahan AI dilempar ke pemanggil.
 */
export async function reviewKeys(ai: AiProvider, inputs: readonly ReviewInput[], opts: Omit<SolveOptions, 'variant'>): Promise<{ reviews: Map<number, Review & { key: number | null }>; model: string; calls: number }> {
  const chunks = <T,>(xs: readonly T[]): T[][] => {
    const out: T[][] = []
    for (let i = 0; i < xs.length; i += SOLVE_BATCH) out.push(xs.slice(i, i + SOLVE_BATCH))
    return out
  }
  const first = new Map<number, number | null>()
  const second = new Map<number, number | null>()
  let model = ai.model ?? ''
  let calls = 0
  for (const part of chunks(inputs)) {
    const r = await solveBatch(ai, part, { ...opts, variant: 'direct' })
    calls++
    model = r.model
    for (const [k, v] of r.answers) first.set(k, v)
  }
  const unkeyed = inputs.filter((i) => i.sourceKey === null && first.get(i.id) !== null && first.get(i.id) !== undefined)
  for (const part of chunks(unkeyed)) {
    const r = await solveBatch(ai, part, { ...opts, variant: 'cross-check' })
    calls++
    for (const [k, v] of r.answers) second.set(k, v)
  }
  const reviews = new Map<number, Review & { key: number | null }>()
  for (const i of inputs) {
    reviews.set(i.id, decideKey({ sourceKey: i.sourceKey, ai1: first.get(i.id) ?? null, ai2: second.get(i.id) ?? null, numeric: !i.options }))
  }
  return { reviews, model, calls }
}
