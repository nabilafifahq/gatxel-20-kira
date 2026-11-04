import { describe, expect, it } from 'vitest'
import { answerText, checkAnswer, keyOf, parseNumber, parseNumberCandidates } from '../src/check'
import { itemSchema, type Item } from '../src/schema'

const numeric = (answer: number, extra: Record<string, unknown> = {}): Item =>
  itemSchema.parse({
    id: 'm2.test.001',
    skill: 'm2.test',
    type: 'numeric',
    difficulty: 2,
    prompt: 'How many?',
    answer,
    hints: ['One.', 'Two.', 'Three.'],
    explanation: 'Count them.',
    ...extra,
  })

describe('parseNumberCandidates', () => {
  it('reads plain integers, decimals and fractions', () => {
    expect(parseNumberCandidates('42')).toEqual([42])
    expect(parseNumberCandidates(' -7 ')).toEqual([-7])
    expect(parseNumberCandidates('3,5')).toEqual([3.5])
    expect(parseNumberCandidates('3.25')).toEqual([3.25])
    expect(parseNumberCandidates('1/4')).toEqual([0.25])
    expect(parseNumberCandidates('1/0')).toEqual([])
    expect(parseNumberCandidates('abc')).toEqual([])
    expect(parseNumberCandidates('')).toEqual([])
  })

  it('keeps both readings when a single separator is followed by three digits', () => {
    expect(parseNumberCandidates('12.500')).toEqual([12.5, 12500])
    expect(parseNumberCandidates('1,234')).toEqual([1.234, 1234])
  })

  it('reads grouped thousands with a decimal part in both conventions', () => {
    expect(parseNumberCandidates('1.234.567')).toEqual([1234567])
    expect(parseNumberCandidates('1.234,5')).toEqual([1234.5])
    expect(parseNumberCandidates('1,234.5')).toEqual([1234.5])
  })

  it('parseNumber returns the first reading', () => {
    expect(parseNumber('12.500')).toBe(12.5)
    expect(parseNumber('x')).toBeNull()
  })
})

describe('checkAnswer numeric', () => {
  it('accepts Indonesian thousands for a whole-number key', () => {
    const key = keyOf(numeric(12500))
    expect(checkAnswer(key, { value: '12.500' }).status).toBe('correct')
    expect(checkAnswer(key, { value: '12500' }).status).toBe('correct')
    expect(checkAnswer(key, { value: '12,5' }).status).toBe('wrong')
  })

  it('accepts a decimal comma for a decimal key', () => {
    const key = keyOf(numeric(2.5, { allowDecimal: true }))
    expect(checkAnswer(key, { value: '2,5' }).status).toBe('correct')
    expect(checkAnswer(key, { value: '2.5' }).status).toBe('correct')
  })

  it('treats an empty answer as blank', () => {
    expect(checkAnswer(keyOf(numeric(3)), { value: '  ' }).status).toBe('blank')
  })
})

describe('checkAnswer text fairness', () => {
  const text = (answers: string[], caseSensitive = false): Item =>
    itemSchema.parse({ id: 'e4.test.001', skill: 'e4.test', type: 'text', difficulty: 2, prompt: 'Write it.', blanks: [{ answers, caseSensitive }], hints: ['One.', 'Two.', 'Three.'], explanation: 'Because.' })
  const status = (item: Item, value: string) => checkAnswer(keyOf(item), { texts: [value] }).status

  it('capitals, extra spaces and a full stop do not cost the mark', () => {
    const item = text(['water vapour'])
    for (const v of ['Water Vapour', '  water   vapour ', 'WATER VAPOUR', 'water vapour.']) expect(status(item, v)).toBe('correct')
    expect(status(item, 'water')).toBe('wrong')
  })

  it('a capital is still marked where the question teaches capitals', () => {
    expect(status(text(['Dewi'], true), 'dewi')).toBe('wrong')
    expect(status(text(['Dewi'], true), 'Dewi')).toBe('correct')
  })

  it('every way of writing the same coordinates passes', () => {
    const item = text(['(-3, -2)'])
    for (const v of ['(-3, -2)', '(-3,-2)', '-3,-2', '-3, -2', '( -3 , -2 )', '(−3, −2)']) expect(status(item, v)).toBe('correct')
    for (const v of ['(3, -2)', '(-2, -3)', '-3']) expect(status(item, v)).toBe('wrong')
  })
})

describe('answerText', () => {
  it('names tutor-marked items in the language asked for', () => {
    const write = itemSchema.parse({
      id: 'e2.test.001',
      skill: 'e2.test',
      type: 'write',
      difficulty: 2,
      prompt: 'Write two sentences about your pet.',
      hints: [],
      explanation: 'Use capital letters and full stops.',
      rubric: { criteria: [{ label: 'Ideas', points: 2 }] },
    })
    expect(answerText(write)).toBe('Marked by your tutor')
    expect(answerText(write, 'id')).toBe('Dinilai tutor')
  })
})
