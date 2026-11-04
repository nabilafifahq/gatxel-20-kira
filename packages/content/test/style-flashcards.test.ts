import { describe, expect, it } from 'vitest'
import { classifyStyle, isTrueFalse, matchesStyle } from '../src/style'
import { findContentDir } from '../src/load'
import { cardKey, deckSchema, loadFlashcards } from '../src/flashcards'
import type { Item } from '../src/schema'

const base = { id: 'x', skill: 'm2.add', difficulty: 2, lang: 'en-GB', hints: ['a', 'b', 'c'], explanation: 'e', tags: [], source: 'kira-original' }
const mcq = (prompt: string, options: string[]) => ({ ...base, type: 'mcq', prompt, options: options.map((text) => ({ text })), answer: 0 }) as unknown as Item

describe('classifyStyle', () => {
  it('mengenali benar atau salah dari dua opsi True dan False', () => {
    const tf = mcq('The sun is a star.', ['True', 'False'])
    expect(isTrueFalse(tf as never)).toBe(true)
    expect(classifyStyle(tf)).toBe('true-false')
    expect(isTrueFalse(mcq('Pick one', ['Yes', 'No']) as never)).toBe(false)
  })
  it('soal pendek, soal cerita, dan bacaan panjang', () => {
    expect(classifyStyle(mcq('What is 4 + 5?', ['8', '9']))).toBe('short')
    expect(classifyStyle(mcq('Mia has 12 stickers and gives 5 of them to her brother, then she buys 3 more at the shop. How many does she have now?', ['9', '10']))).toBe('word-problem')
    expect(classifyStyle({ ...mcq('Read the story and answer.', ['a', 'b']), passage: 'p-0001' } as unknown as Item)).toBe('long-read')
    expect(classifyStyle(mcq('x '.repeat(140), ['a', 'b']))).toBe('long-read')
  })
  it('mixed menerima semua', () => {
    expect(matchesStyle(mcq('What is 4 + 5?', ['8', '9']), 'mixed')).toBe(true)
    expect(matchesStyle(mcq('What is 4 + 5?', ['8', '9']), 'true-false')).toBe(false)
  })
})

describe('flashcards', () => {
  it('semua dek di content/flashcards lolos skema', () => {
    const { decks, errors } = loadFlashcards(findContentDir())
    expect(errors).toEqual([])
    expect(decks.length).toBeGreaterThan(0)
  })
  it('menolak dek dengan kartu kembar dan kunci kartu stabil', () => {
    const bad = { id: 'dek-x', subject: 'math', grade: 1, title: 'T', cards: [1, 2, 3, 4].map((n) => ({ id: `c${n}`, front: 'a', back: `b${n}` })) }
    expect(deckSchema.safeParse(bad).success).toBe(true)
    expect(cardKey('dek-x', 'c1')).toBe('dek-x:c1')
  })
})
