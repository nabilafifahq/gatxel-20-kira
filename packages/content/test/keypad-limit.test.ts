import { describe, expect, it } from 'vitest'
import { NUMERIC_MAX_DIGITS } from '../src/check'
import { loadContent } from '../src/load'
import { generateItem, genRef, GENERATORS } from '../src/math'
import type { Item } from '../src/schema'

const digits = (n: number) => String(n).replace('-', '').replace('.', '').length

function answers(item: Item): number[] {
  if (item.type === 'numeric') return [item.answer]
  if (item.type === 'story') return item.parts.flatMap((p) => (p.type === 'numeric' ? [p.answer] : []))
  return []
}

/** Jawaban yang lebih panjang dari batas keypad tidak bisa diketik, jadi anak yang benar selalu dinilai salah. */
describe('jawaban angka muat di keypad', () => {
  it('soal tertulis', () => {
    const over = [...loadContent().index.items.values()].filter((i) => answers(i).some((a) => digits(a) > NUMERIC_MAX_DIGITS)).map((i) => i.id)
    expect(over).toEqual([])
  })

  it('soal generator di setiap tingkat', () => {
    const over: string[] = []
    for (const [skill, gen] of GENERATORS) {
      for (const level of gen.levels) {
        for (let s = 0; s < 25; s++) {
          const item = generateItem(genRef(skill, level, `k${s}`))
          if (answers(item).some((a) => digits(a) > NUMERIC_MAX_DIGITS)) over.push(item.id)
        }
      }
    }
    expect(over).toEqual([])
  })
})
