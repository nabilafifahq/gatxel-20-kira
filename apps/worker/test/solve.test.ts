import { describe, expect, it } from 'vitest'
import type { ImportStoredItem } from '@kira/db'
import { decideKey, reviewKeys, sameAnswer, solveBatch, SOLVE_BATCH } from '../src/ai/solve'
import type { AiProvider, AiRunInput } from '../src/ai/types'
import { applyReview } from '../src/handlers/import'

function fakeAi(answerFor: (input: AiRunInput, call: number) => { number: number; answer: number | null }[]): { ai: AiProvider; calls: AiRunInput[] } {
  const calls: AiRunInput[] = []
  const ai: AiProvider = {
    name: 'claude-code', label: 'Claude', model: 'm', ready: true, notReadyReason: null,
    modelFor: () => 'm', describe: async () => null,
    run: async (i) => {
      calls.push(i)
      return { json: { answers: answerFor(i, calls.length) }, model: 'm', durationMs: 1 }
    },
  }
  return { ai, calls }
}

const sent = (i: AiRunInput): { number: number; prompt: string; options?: string[] }[] => JSON.parse(i.prompt.slice(i.prompt.indexOf('[')))

describe('sameAnswer', () => {
  it('indeks harus persis sama, angka boleh berbeda sangat kecil, null tidak pernah sama', () => {
    expect(sameAnswer(2, 2, false)).toBe(true)
    expect(sameAnswer(2, 3, false)).toBe(false)
    expect(sameAnswer(0.1 + 0.2, 0.3, true)).toBe(true)
    expect(sameAnswer(18, 18.5, true)).toBe(false)
    expect(sameAnswer(null, null, true)).toBe(false)
    expect(sameAnswer(1, null, false)).toBe(false)
  })
})

describe('decideKey: kunci dipakai hanya bila sumber dan AI sama, atau AI dua kali sama', () => {
  it('dengan kunci sumber: cocok, beda, atau AI ragu', () => {
    expect(decideKey({ sourceKey: 1, ai1: 1 })).toEqual({ aiAnswer: 1, verdict: 'agree', key: 1 })
    expect(decideKey({ sourceKey: 1, ai1: 3 })).toEqual({ aiAnswer: 3, verdict: 'disagree', key: 1 })
    expect(decideKey({ sourceKey: 1, ai1: null })).toEqual({ aiAnswer: null, verdict: 'unverified', key: 1 })
  })

  it('tanpa kunci sumber: dua jawaban AI sama jadi kunci usulan, selain itu tidak ada kunci', () => {
    expect(decideKey({ sourceKey: null, ai1: 2, ai2: 2 })).toEqual({ aiAnswer: 2, verdict: 'ai-only', key: 2 })
    expect(decideKey({ sourceKey: null, ai1: 2, ai2: 0 })).toEqual({ aiAnswer: 2, verdict: 'unverified', key: null })
    expect(decideKey({ sourceKey: null, ai1: 2, ai2: null })).toEqual({ aiAnswer: 2, verdict: 'unverified', key: null })
    expect(decideKey({ sourceKey: null, ai1: null, ai2: null })).toEqual({ aiAnswer: null, verdict: 'unverified', key: null })
  })

  it('soal angka dibandingkan dengan toleransi', () => {
    expect(decideKey({ sourceKey: 18, ai1: 18, numeric: true }).verdict).toBe('agree')
    expect(decideKey({ sourceKey: 18, ai1: 17, numeric: true }).verdict).toBe('disagree')
  })
})

describe('solveBatch', () => {
  const q = [{ id: 7, prompt: 'Berapa 3 + 4?', options: ['6', '7', '8'] }, { id: 8, prompt: 'Hitung 5 x 5.' }]

  it('varian direct mengirim opsi berhuruf dan soal angka tanpa opsi', async () => {
    const { ai, calls } = fakeAi(() => [{ number: 7, answer: 1 }, { number: 8, answer: 25 }])
    const r = await solveBatch(ai, q, { subject: 'math', grade: 2, variant: 'direct' })
    expect(sent(calls[0]!)).toEqual([{ number: 7, prompt: 'Berapa 3 + 4?', options: ['A. 6', 'B. 7', 'C. 8'] }, { number: 8, prompt: 'Hitung 5 x 5.' }])
    expect(r.answers.get(7)).toBe(1)
    expect(r.answers.get(8)).toBe(25)
  })

  it('varian cross-check membalik urutan opsi lalu memetakan jawaban kembali', async () => {
    // Opsi dibalik: C. 6, B. 7, A. 8. AI memilih B (indeks 1 di tampilan terbalik) = "7" = indeks 1 aslinya.
    const { ai, calls } = fakeAi(() => [{ number: 7, answer: 1 }])
    const r = await solveBatch(ai, [q[0]!], { subject: 'math', grade: 2, variant: 'cross-check' })
    expect(sent(calls[0]!)[0]!.options).toEqual(['A. 8', 'B. 7', 'C. 6'])
    expect(r.answers.get(7)).toBe(1)
    // AI memilih A di tampilan terbalik = "8" = indeks 2 aslinya.
    const second = fakeAi(() => [{ number: 7, answer: 0 }])
    expect((await solveBatch(second.ai, [q[0]!], { subject: 'math', grade: 2, variant: 'cross-check' })).answers.get(7)).toBe(2)
  })

  it('jawaban di luar opsi, bukan angka, atau nomor tak dikenal diabaikan', async () => {
    const { ai } = fakeAi(() => [{ number: 7, answer: 9 }, { number: 99, answer: 1 }, { number: 8, answer: null }])
    const r = await solveBatch(ai, q, { subject: 'math', grade: 2, variant: 'direct' })
    expect(r.answers.get(7)).toBeNull()
    expect(r.answers.get(8)).toBeNull()
    expect(r.answers.has(99)).toBe(false)
  })
})

describe('reviewKeys', () => {
  it('soal berkunci dikerjakan sekali, soal tanpa kunci dua kali dengan varian berbeda', async () => {
    const { ai, calls } = fakeAi((input) => {
      const items = sent(input)
      // Pass kedua (opsi terbalik): AI menjawab "benar" yang sama dengan pass pertama, yaitu A (indeks 3 di tampilan terbalik dari 4 opsi).
      const cross = input.system.includes('second, independent')
      return items.map((it) => ({ number: it.number, answer: it.number === 1 ? 2 : cross ? 3 : 0 }))
    })
    const r = await reviewKeys(
      ai,
      [
        { id: 1, prompt: 'Soal 1', options: ['a', 'b', 'c', 'd'], sourceKey: 2 },
        { id: 2, prompt: 'Soal 2', options: ['a', 'b', 'c', 'd'], sourceKey: null },
      ],
      { subject: 'math', grade: 2 },
    )
    expect(r.calls).toBe(2)
    expect(calls.map((c) => sent(c).map((x) => x.number))).toEqual([[1, 2], [2]])
    expect(r.reviews.get(1)).toMatchObject({ verdict: 'agree', key: 2 })
    expect(r.reviews.get(2)).toMatchObject({ verdict: 'ai-only', key: 0, aiAnswer: 0 })
  })

  it('dua jawaban AI yang berbeda tidak menghasilkan kunci', async () => {
    const { ai } = fakeAi((input) => sent(input).map((it) => ({ number: it.number, answer: 0 })))
    // Pass kedua juga menjawab indeks 0 di tampilan terbalik, yaitu indeks 3 asli: beda dengan pass pertama.
    const r = await reviewKeys(ai, [{ id: 5, prompt: 'Soal', options: ['a', 'b', 'c', 'd'], sourceKey: null }], { subject: 'science', grade: 3 })
    expect(r.reviews.get(5)).toMatchObject({ verdict: 'unverified', key: null })
  })

  it('soal banyak dipecah per paket', async () => {
    const many = Array.from({ length: SOLVE_BATCH + 5 }, (_, i) => ({ id: i + 1, prompt: `S${i}`, options: ['a', 'b'], sourceKey: 0 }))
    const { ai, calls } = fakeAi((input) => sent(input).map((it) => ({ number: it.number, answer: 0 })))
    const r = await reviewKeys(ai, many, { subject: 'math', grade: 2 })
    expect(r.calls).toBe(2)
    expect(calls.map((c) => sent(c).length)).toEqual([SOLVE_BATCH, 5])
  })
})

describe('applyReview untuk soal impor PDF', () => {
  const item = (over: Partial<ImportStoredItem> = {}): ImportStoredItem => ({
    number: 1, prompt: 'Soal', options: ['1', '2', '3'], answer: 1, answerFromKey: 1, figureNote: null, page: 1, status: 'ok', approved: false, orgItemId: null, ...over,
  })

  it('cocok: soal tetap lolos dan diberi bendera agree', () => {
    expect(applyReview(item(), { aiAnswer: 1, verdict: 'agree', key: 1 })).toMatchObject({ status: 'ok', keyCheck: 'agree', aiAnswer: 1 })
  })

  it('beda: soal masuk Perlu dicek sebagai key-mismatch', () => {
    expect(applyReview(item(), { aiAnswer: 2, verdict: 'disagree', key: 1 })).toMatchObject({ status: 'key-mismatch', keyCheck: 'disagree', answer: 1 })
  })

  it('tanpa kunci dan AI dua kali sama: kunci diusulkan tapi soal tetap perlu dicek', () => {
    const r = applyReview(item({ answer: null, answerFromKey: null, status: 'needs-check' }), { aiAnswer: 2, verdict: 'ai-only', key: 2 })
    expect(r).toMatchObject({ answer: 2, status: 'needs-check', keyCheck: 'ai-only' })
  })

  it('AI ragu: bendera skipped tanpa mengubah soal, dan tanpa hasil soal tidak berubah', () => {
    expect(applyReview(item(), { aiAnswer: null, verdict: 'unverified', key: 1 })).toMatchObject({ status: 'ok', keyCheck: 'skipped' })
    const plain = item()
    expect(applyReview(plain, undefined)).toBe(plain)
  })
})
