import { describe, expect, it } from 'vitest'
import { checkAnswer, itemSchema, keyOf, presentItem, type Item, type ItemInput, type Preset } from '@kira/content'
import { indexLetter, letterIndex, ljkAnswer, optionCountFor, scoreSheet, sheetLayout, shortAnswerFromFor, storedToLjk } from '@/server/dal/console-ljk'

const base = { skill: 'm2.numbers-to-100', difficulty: 2, hints: ['a', 'b', 'c'], explanation: 'Because.' }
const make = (id: string, body: Record<string, unknown>): Item => itemSchema.parse({ ...base, id, ...body } as ItemInput)

const mcq4 = make('m2.numbers-to-100.001', { type: 'mcq', prompt: 'Pick 5.', options: [{ text: '3' }, { text: '4' }, { text: '5' }, { text: '6' }], answer: 2 })
const mcq5 = make('m2.numbers-to-100.002', { type: 'mcq', prompt: 'Pick E.', options: [{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' }, { text: 'e' }], answer: 4 })
const numeric = make('m2.numbers-to-100.003', { type: 'numeric', prompt: 'How many?', answer: 12, unit: 'cm' })
const text3 = make('m2.numbers-to-100.004', { type: 'text', prompt: 'Fill: ___, ___, ___', blanks: [{ answers: ['6'] }, { answers: ['8'] }, { answers: ['12'] }] })
const clock = make('m2.numbers-to-100.005', { type: 'clock', prompt: 'Show the time.', answer: { h: 7, m: 45 } })
const fraction = make('m2.numbers-to-100.006', { type: 'fraction', prompt: 'Shade half.', shape: 'bar', parts: 4, answer: { num: 1, den: 2 } })
const order = make('m2.numbers-to-100.007', { type: 'order', prompt: 'Order them.', items: ['12', '21', '45', '54'] })
const match = make('m2.numbers-to-100.008', { type: 'match', prompt: 'Match.', pairs: [['cat', 'kitten'], ['dog', 'puppy'], ['cow', 'calf']] })
const sort = make('m2.numbers-to-100.009', { type: 'sort', prompt: 'Sort.', groups: ['odd', 'even'], items: [{ text: '1', group: 0 }, { text: '2', group: 1 }, { text: '3', group: 0 }, { text: '4', group: 1 }] })
const multi = make('m2.numbers-to-100.010', { type: 'multi', prompt: 'Pick two.', options: [{ text: '1' }, { text: '2' }, { text: '3' }, { text: '4' }], answers: [0, 2] })
const write = make('m2.numbers-to-100.011', { type: 'write', prompt: 'Write a story.', hints: [], rubric: { criteria: [{ label: 'Ideas', points: 2 }] } })

const shown = (item: Item) => presentItem(item, { seed: 'paper-1', includeKey: false, includeHints: false })
const status = (item: Item, raw: string | null) => checkAnswer(keyOf(item), raw === null ? null : ljkAnswer(item, shown(item), raw)).status
const letter = (i: number) => String.fromCharCode(65 + i)

describe('letter mapping', () => {
  it('maps A to E to option indexes and back', () => {
    expect(['A', 'B', 'C', 'D', 'E'].map(letterIndex)).toEqual([0, 1, 2, 3, 4])
    expect(letterIndex(' c ')).toBe(2)
    expect(letterIndex('F')).toBeNull()
    expect(letterIndex('AB')).toBeNull()
    expect([0, 4, 5].map(indexLetter)).toEqual(['A', 'E', null])
  })

  it('scores a letter against the original option order', () => {
    expect(status(mcq4, 'C')).toBe('correct')
    expect(status(mcq4, 'a')).toBe('wrong')
    expect(status(mcq5, 'E')).toBe('correct')
    expect(status(mcq4, null)).toBe('blank')
  })

  it('accepts the option text for a multiple choice question in a short answer box', () => {
    expect(status(mcq4, '5')).toBe('correct')
    expect(status(mcq4, '7')).toBe('wrong')
  })

  it('shows the saved answer again as the tutor typed it', () => {
    expect(storedToLjk(ljkAnswer(mcq4, shown(mcq4), 'b'))).toBe('b')
    expect(storedToLjk({ choice: 3 })).toBe('D')
    expect(storedToLjk({ value: '12' })).toBe('12')
    expect(storedToLjk(null)).toBeNull()
  })
})

describe('sheet layout', () => {
  it('uses five bubbles when the preset or a question has five options', () => {
    expect(optionCountFor([mcq4])).toBe(4)
    expect(optionCountFor([mcq4, mcq5])).toBe(5)
    expect(optionCountFor([mcq4], { rules: { optionCount: 5 } } as Preset)).toBe(5)
  })

  it('starts short answers at the first question that is not multiple choice', () => {
    expect(shortAnswerFromFor([mcq4, mcq5])).toBeNull()
    expect(shortAnswerFromFor([mcq4, numeric, mcq5])).toBe(2)
    expect(shortAnswerFromFor([numeric])).toBe(1)
  })

  it('treats a question that no longer resolves as a short answer', () => {
    const resolved = new Map([[mcq4.id, mcq4]])
    expect(sheetLayout([{ ref: mcq4.id }, { ref: 'org:gone' }], resolved)).toEqual({ optionCount: 4, shortAnswerFrom: 2 })
  })
})

describe('short answers by question type', () => {
  it('numeric ignores a unit after the number', () => {
    expect(status(numeric, '12')).toBe('correct')
    expect(status(numeric, '12 cm')).toBe('correct')
    expect(status(numeric, '13')).toBe('wrong')
    expect(status(numeric, 'twelve')).toBe('wrong')
  })

  it('text with several blanks splits on commas', () => {
    expect(status(text3, '6, 8, 12')).toBe('correct')
    expect(status(text3, '6, 8')).toBe('wrong')
  })

  it('clock accepts 7:45 and 7.45', () => {
    expect(status(clock, '7:45')).toBe('correct')
    expect(status(clock, '7.45')).toBe('correct')
    expect(status(clock, '8:45')).toBe('wrong')
    expect(status(clock, 'quarter to 8')).toBe('wrong')
  })

  it('fraction accepts the shaded parts or the fraction', () => {
    expect(status(fraction, '2')).toBe('correct')
    expect(status(fraction, '1/2')).toBe('correct')
    expect(status(fraction, '2/4')).toBe('correct')
    expect(status(fraction, '3')).toBe('wrong')
  })

  it('order reads the numbers written next to the printed cards', () => {
    const cards = shown(order).orderItems!
    expect(status(order, cards.map((c) => c.i + 1).join(''))).toBe('correct')
    expect(status(order, cards.map((c) => c.i + 1).join(', '))).toBe('correct')
    expect(status(order, cards.map((c) => c.i + 1).reverse().join(''))).toBe('wrong')
  })

  it('match reads one printed letter per numbered left item', () => {
    const right = shown(match).matchRight!
    const correct = match.type === 'match' ? match.pairs.map((_, i) => letter(right.findIndex((r) => r.i === i))).join('') : ''
    expect(status(match, correct)).toBe('correct')
    expect(status(match, correct.split('').reverse().join(''))).toBe('wrong')
  })

  it('sort reads one group letter per printed card', () => {
    const cards = shown(sort).sortItems!
    const groupOf = (i: number) => (sort.type === 'sort' ? sort.items[i]!.group : 0)
    expect(status(sort, cards.map((c) => letter(groupOf(c.i))).join(''))).toBe('correct')
    expect(status(sort, cards.map((c) => letter(1 - groupOf(c.i))).join(''))).toBe('wrong')
  })

  it('multi takes a set of letters', () => {
    expect(status(multi, 'AC')).toBe('correct')
    expect(status(multi, 'C, A')).toBe('correct')
    expect(status(multi, 'A')).toBe('wrong')
    expect(status(multi, '13')).toBe('wrong')
  })

  it('writing waits for the tutor', () => {
    expect(status(write, 'A short story')).toBe('pending')
  })
})

describe('scoreSheet', () => {
  it('counts right answers out of all questions without a preset', () => {
    const s = scoreSheet(['correct', 'wrong', 'blank', 'correct'])
    expect(s).toMatchObject({ raw: 2, max: 4, scaled: null, correct: 2, wrong: 1, blank: 1, pending: 0 })
    expect(s.label).toBe('2 dari 4')
  })

  it('names questions that still wait for the tutor', () => {
    expect(scoreSheet(['correct', 'pending']).label).toBe('1 dari 2, 1 soal menunggu nilai tutor')
  })

  const preset = (rules: Partial<Preset['rules']>): Preset =>
    ({ id: 'p', competition: 'c', title: 'P', subject: 'math', grades: [2], lang: 'en-GB', year: 2026, verified: true, howItWorks: ['x'], itemTags: ['x'], rules: { questionCount: 4, timeLimitMin: 10, sections: [], optionCount: 4, ...rules } }) as Preset

  it('applies section points and the wrong answer penalty of a preset', () => {
    const p = preset({ questionCount: 4, startScore: 4, sections: [{ from: 1, to: 2, points: 2, wrongPenalty: 1 }, { from: 3, to: 4, points: 4 }] })
    const s = scoreSheet(['correct', 'wrong', 'correct', 'blank'], p)
    expect(s.raw).toBe(4 + 2 - 1 + 4)
    expect(s.max).toBe(4 + 2 * 2 + 2 * 4)
    expect(s.label).toBe('9 dari 16')
  })

  it('scales a one-section preset to the number of questions on the sheet', () => {
    const p = preset({ questionCount: 40, sections: [{ from: 1, to: 40, points: 1 }], scaleTo: 100 })
    const s = scoreSheet(['correct', 'correct', 'correct', 'wrong', 'blank', 'correct', 'correct', 'wrong', 'correct', 'correct'], p)
    expect(s).toMatchObject({ raw: 7, max: 10, scaled: 70 })
    expect(s.label).toBe('7 dari 10 (skor 70 dari 100)')
  })
})
