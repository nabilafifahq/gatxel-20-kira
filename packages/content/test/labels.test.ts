import { describe, expect, it } from 'vitest'
import { checkAnswer, keyOf } from '../src/check'
import { answerFromLabels, answerToLabels, labelCount, type LabelPerm } from '../src/labels'
import { presentItem } from '../src/present'
import { itemSchema, type Item } from '../src/schema'

const base = { skill: 'e2.test', difficulty: 2, prompt: 'Try this.', hints: ['One.', 'Two.', 'Three.'], explanation: 'Because.' }
const item = (extra: Record<string, unknown>): Item => itemSchema.parse({ id: `e2.test.${String(extra.type)}`, ...base, ...extra })

const order = item({ type: 'order', items: ['first', 'second', 'third', 'fourth'] })
const match = item({ type: 'match', pairs: [['cat', 'kitten'], ['dog', 'puppy'], ['cow', 'calf']] })
const sort = item({ type: 'sort', groups: ['hot', 'cold'], items: [{ text: 'sun', group: 0 }, { text: 'fire', group: 0 }, { text: 'ice', group: 1 }, { text: 'snow', group: 1 }] })
const mcq = item({ type: 'mcq', options: [{ text: 'red' }, { text: 'blue' }, { text: 'green' }], answer: 2 })
const multi = item({ type: 'multi', options: [{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' }], answers: [0, 3] })

// Label untuk indeks asli i. Bukan identitas, supaya tes menangkap pemetaan yang tertukar arah.
const PERM4: LabelPerm = [2, 0, 3, 1]
const PERM3: LabelPerm = [1, 2, 0]

describe('labelCount', () => {
  it('menghitung pilihan berlabel per jenis soal', () => {
    expect([order, match, sort, mcq, multi].map(labelCount)).toEqual([4, 3, 4, 3, 4])
  })
})

describe('presentItem dengan label', () => {
  it('tidak memuat indeks asli: label kartu urut, kartu kanan, kelompok, dan opsi mengikuti permutasi', () => {
    const o = presentItem(order, { seed: 's', includeKey: false, includeHints: false, labels: PERM4 })
    expect(o.orderItems!.map((c) => c.i).sort()).toEqual([0, 1, 2, 3])
    const orderTexts = (order as Extract<Item, { type: 'order' }>).items
    for (const c of o.orderItems!) expect(c.text).toBe(orderTexts[PERM4.indexOf(c.i)])
    const m = presentItem(match, { seed: 's', includeKey: false, includeHints: false, labels: PERM3 })
    for (const r of m.matchRight!) expect(r.text).toBe((match as Extract<Item, { type: 'match' }>).pairs[PERM3.indexOf(r.i)]![1])
    const q = presentItem(mcq, { seed: 's', includeKey: false, includeHints: false, labels: PERM3 })
    for (const op of q.options!) expect(op.text).toBe((mcq as Extract<Item, { type: 'mcq' }>).options[PERM3.indexOf(op.i)]!.text)
  })

  it('urutan tampil kartu urut tidak pernah sama dengan urutan benar', () => {
    for (let s = 0; s < 50; s++) {
      const o = presentItem(order, { seed: `seed-${s}`, includeKey: false, includeHints: false, labels: PERM4 })
      const original = o.orderItems!.map((c) => PERM4.indexOf(c.i))
      expect(original).not.toEqual([0, 1, 2, 3])
    }
  })

  it('menolak label bersama kunci', () => {
    expect(() => presentItem(order, { seed: 's', includeKey: true, includeHints: false, labels: PERM4 })).toThrow()
  })
})

describe('answerFromLabels dan answerToLabels', () => {
  it('jawaban benar dalam label menjadi jawaban benar dalam indeks asli', () => {
    // Perangkat menaruh kartu dengan label perm[0], perm[1], ... di slot 0, 1, ...
    const orderAnswer = { order: [0, 1, 2, 3].map((i) => PERM4[i]) }
    expect(checkAnswer(keyOf(order), answerFromLabels(order, orderAnswer, PERM4)).status).toBe('correct')
    expect(checkAnswer(keyOf(order), answerFromLabels(order, { order: [0, 1, 2, 3] }, PERM4)).status).toBe('wrong')

    const matchAnswer = { pairs: [0, 1, 2].map((i) => PERM3[i]) }
    expect(checkAnswer(keyOf(match), answerFromLabels(match, matchAnswer, PERM3)).status).toBe('correct')

    // groups diindeks label: kartu asli i ada di posisi perm[i].
    const sortGroups = new Array<number>(4)
    ;[0, 0, 1, 1].forEach((g, i) => (sortGroups[PERM4[i]!] = g))
    expect(checkAnswer(keyOf(sort), answerFromLabels(sort, { groups: sortGroups }, PERM4)).status).toBe('correct')

    expect(checkAnswer(keyOf(mcq), answerFromLabels(mcq, { choice: PERM3[2] }, PERM3)).status).toBe('correct')
    expect(checkAnswer(keyOf(mcq), answerFromLabels(mcq, { choice: 2 }, PERM3)).status).toBe('wrong')
    expect(checkAnswer(keyOf(multi), answerFromLabels(multi, { choices: [PERM4[0], PERM4[3]] }, PERM4)).status).toBe('correct')
  })

  it('bolak-balik label kembali ke jawaban semula, termasuk slot kosong (-1)', () => {
    const cases: [Item, unknown, LabelPerm][] = [
      [order, { order: [3, -1, 0, 2] }, PERM4],
      [match, { pairs: [2, -1, 0] }, PERM3],
      [sort, { groups: [1, -1, 0, 1] }, PERM4],
      [mcq, { choice: 1 }, PERM3],
      [multi, { choices: [2, 0] }, PERM4],
    ]
    for (const [it, a, p] of cases) {
      expect(answerToLabels(it, answerFromLabels(it, a, p), p)).toEqual(a)
      expect(answerFromLabels(it, answerToLabels(it, a, p), p)).toEqual(a)
    }
  })

  it('tanpa label atau dengan jawaban kosong, jawaban tidak berubah', () => {
    expect(answerFromLabels(order, { order: [1, 0, 2, 3] }, null)).toEqual({ order: [1, 0, 2, 3] })
    expect(answerFromLabels(order, null, PERM4)).toBeNull()
    expect(answerToLabels(sort, { groups: [0, 1] }, PERM4)).toEqual({ groups: [0, 1] })
  })

  it('nilai di luar rentang dibiarkan supaya pemeriksa bentuk jawaban menolaknya', () => {
    expect(answerFromLabels(mcq, { choice: 9 }, PERM3)).toEqual({ choice: 9 })
    expect(answerFromLabels(order, { order: [0, 1, 2, 7] }, PERM4)).toEqual({ order: [1, 3, 0, 7] })
  })
})
