import { describe, expect, it } from 'vitest'
import { createRng } from '@kira/core'
import { parseGenRef } from '@kira/content/math'
import { filterEntries, matchesQuery, type BankEntry, type BankFilters } from '@/server/dal/console-bank'
import { addRefFrom, codePrefix, dominantSkill, isPaperRef, nextCode, pickPaperItems, type SkillPool } from '@/server/dal/console-paper'

const pools: SkillPool[] = [
  { skillId: 'm2.alpha', candidates: [{ ref: 'm2.alpha.001', difficulty: 1 }, { ref: 'm2.alpha.002', difficulty: 2 }, { ref: 'm2.alpha.003', difficulty: 5 }] },
  { skillId: 'm2.beta', candidates: [{ ref: 'm2.beta.001', difficulty: 3 }, { ref: 'gen:m2.beta:2', difficulty: 2, unlimited: true }] },
  { skillId: 'm2.gamma', candidates: [{ ref: 'm2.gamma.001', difficulty: 4 }] },
]

describe('pickPaperItems', () => {
  it('spreads the first picks across every skill and orders by difficulty', () => {
    const out = pickPaperItems(pools, 3, [1, 4], createRng('t1'))
    expect(new Set(out.map((o) => o.skillId))).toEqual(new Set(['m2.alpha', 'm2.beta', 'm2.gamma']))
    expect(out.map((o) => o.difficulty)).toEqual([...out.map((o) => o.difficulty)].sort((a, b) => a - b))
  })

  it('keeps to the difficulty range', () => {
    const out = pickPaperItems(pools, 20, [1, 4], createRng('t2'))
    expect(out.every((o) => o.difficulty >= 1 && o.difficulty <= 4)).toBe(true)
    expect(out.some((o) => o.ref === 'm2.alpha.003')).toBe(false)
  })

  it('fills up with fresh generator instances and never repeats a ref', () => {
    const out = pickPaperItems(pools, 10, [1, 5], createRng('t3'))
    expect(out).toHaveLength(10)
    expect(new Set(out.map((o) => o.ref)).size).toBe(10)
    const gens = out.filter((o) => o.ref.startsWith('gen:'))
    expect(gens.length).toBeGreaterThanOrEqual(5)
    for (const g of gens) expect(parseGenRef(g.ref)).toMatchObject({ skill: 'm2.beta', level: 2 })
  })

  it('returns fewer items when the pools run out, and none when nothing fits', () => {
    const fixed = pools.map((p) => ({ ...p, candidates: p.candidates.filter((c) => !c.unlimited) }))
    expect(pickPaperItems(fixed, 10, [1, 5], createRng('t4'))).toHaveLength(5)
    expect(pickPaperItems(fixed, 10, [5, 5], createRng('t5')).map((o) => o.ref)).toEqual(['m2.alpha.003'])
    expect(pickPaperItems(pools, 5, [6, 6] as unknown as [number, number], createRng('t6'))).toEqual([])
  })

  it('is repeatable for the same seed', () => {
    expect(pickPaperItems(pools, 6, [1, 5], createRng('same'))).toEqual(pickPaperItems(pools, 6, [1, 5], createRng('same')))
  })
})

describe('paper codes', () => {
  it('builds P-YYMM- and L-YYMM- prefixes from the Jakarta date', () => {
    expect(codePrefix('P', '2026-10-12')).toBe('P-2610-')
    expect(codePrefix('L', '2027-01-03')).toBe('L-2701-')
  })

  it('takes the next number after the highest code this month', () => {
    expect(nextCode('P-2610-', [])).toBe('P-2610-01')
    expect(nextCode('P-2610-', ['P-2610-01', 'P-2610-07', 'P-2609-12', 'P-2610-xx'])).toBe('P-2610-08')
    expect(nextCode('P-2610-', ['P-2610-99'])).toBe('P-2610-100')
  })
})

describe('paper refs', () => {
  it('accepts repo items, seeded generator instances, and org items', () => {
    expect(isPaperRef('m2.arrays.003')).toBe(true)
    expect(isPaperRef('gen:m2.numbers-to-100:3:abc12')).toBe(true)
    expect(isPaperRef('org:6f8c4d6b-e95b-40a5-905e-e2359796a6e3')).toBe(true)
    expect(isPaperRef('gen:m2.numbers-to-100:3')).toBe(false)
    expect(isPaperRef('m2.arrays')).toBe(false)
  })

  it('turns a bank generator row into its preview instance for Tambah ke paper', () => {
    expect(addRefFrom('gen:m2.numbers-to-100:3')).toBe('gen:m2.numbers-to-100:3:bank')
    expect(addRefFrom('m2.arrays.003')).toBe('m2.arrays.003')
    expect(addRefFrom('drop table')).toBeNull()
  })

  it('picks the most common skill for the plan slot', () => {
    expect(dominantSkill(['m2.a', 'm2.b', 'm2.b', 'm2.a', 'm2.b'])).toBe('m2.b')
    expect(dominantSkill(['m2.a', 'm2.b'])).toBe('m2.a')
    expect(dominantSkill([])).toBeNull()
  })
})

describe('bank search', () => {
  const hay = 'm2.arrays.003 how many apples are there? arrays larik'
  it('needs every word, in any order and case', () => {
    expect(matchesQuery(hay, 'APPLES arrays')).toBe(true)
    expect(matchesQuery(hay, 'm2.arrays.003')).toBe(true)
    expect(matchesQuery(hay, 'apples pears')).toBe(false)
    expect(matchesQuery(hay, '')).toBe(true)
  })

  const entry = (ref: string, type: string, source: BankEntry['row']['source'], haystack: string) =>
    ({
      row: { ref, subject: 'math', grade: 2, skillId: 'm2.numbers-to-100', skillTitle: 'Numbers to 100', type, difficulty: 3, promptPreview: '', source, tags: [] },
      item: {} as BankEntry['item'],
      statKey: ref,
      haystack,
      sort: [0, 2, 1, 0, 3, ref],
    }) satisfies BankEntry
  const entries = [entry('gen:m2.numbers-to-100:3', 'text', 'generator', 'gen:m2.numbers-to-100:3 write 31 in words'), entry('m2.oly-logic.003', 'mcq', 'kira-original', 'm2.oly-logic.003 apples')]
  const none: BankFilters = { subject: null, grade: null, skillId: null, type: null, difficulty: null, source: null, q: '' }

  it('finds the generator row from an instance ref, as stored in problem reports', () => {
    expect(filterEntries(entries, { ...none, q: 'gen:m2.numbers-to-100:3:abc12' }).map((e) => e.row.ref)).toEqual(['gen:m2.numbers-to-100:3'])
  })

  it('combines filters with the search', () => {
    expect(filterEntries(entries, { ...none, source: 'generator' })).toHaveLength(1)
    expect(filterEntries(entries, { ...none, type: 'mcq', q: 'apples' }).map((e) => e.row.ref)).toEqual(['m2.oly-logic.003'])
    expect(filterEntries(entries, { ...none, type: 'mcq', q: 'words' })).toEqual([])
  })
})
