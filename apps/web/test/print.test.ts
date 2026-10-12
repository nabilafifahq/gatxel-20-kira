import { describe, expect, it } from 'vitest'
import type { ClientItem } from '@kira/content'
import { paperInstructions, paperSections } from '@/server/dal/print'

const q = (number: number, type: ClientItem['type']) => ({ number, item: { ref: `r${number}`, type, skill: 'm2.x', difficulty: 1, prompt: 'Q', lang: 'en-GB' as const, expectedSeconds: 30 } })

describe('paperInstructions', () => {
  it('tells children where to put the answers for each mode', () => {
    expect(paperInstructions('kertas', 20, { working: false })).toEqual(['You have 20 minutes.', 'Read each question twice.', 'Mark your answers on the answer sheet.'])
    expect(paperInstructions('tes', 15, { working: true })).toEqual(['You have 15 minutes.', 'Read each question twice.', 'Show your working in the box.', 'Write your answers on this paper.'])
    expect(paperInstructions('latihan', 10, { working: false })[0]).toBe('Take about 10 minutes.')
  })

  it('keeps every sentence short enough for Grade 1 and 2, without dashes', () => {
    for (const mode of ['latihan', 'tes', 'kertas'] as const) {
      for (const line of paperInstructions(mode, 45, { working: true })) {
        expect(line.split(' ').length).toBeLessThanOrEqual(12)
        expect(line).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
      }
    }
  })
})

describe('paperSections', () => {
  const items = [q(1, 'mcq'), q(2, 'mcq'), q(3, 'numeric'), q(4, 'mcq')]

  it('splits a Kertas paper where the answer sheet switches to boxes, keeping the numbers', () => {
    const s = paperSections(items, 'kertas', 3)
    expect(s.map((x) => x.title)).toEqual(['Part A: choose one answer', 'Part B: write the answer'])
    expect(s.flatMap((x) => x.items.map((i) => i.number))).toEqual([1, 2, 3, 4])
  })

  it('keeps one untitled section otherwise', () => {
    expect(paperSections(items, 'tes', 3)).toEqual([{ title: '', items }])
    expect(paperSections(items, 'kertas', null)).toEqual([{ title: '', items }])
    expect(paperSections(items, 'kertas', 1)).toEqual([{ title: '', items }])
  })
})
