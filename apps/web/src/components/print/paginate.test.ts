import { describe, expect, it } from 'vitest'
import type { ClientItem } from '@kira/content/present'
import { estimateItemHeight, paginate } from './paginate'

const base = { id: 'x', prompt: 'What time does the clock show?', points: 1, lang: 'en' }

describe('estimateItemHeight', () => {
  it('menghitung tinggi figur penuh, bukan angka tetap', () => {
    const clock = { ...base, type: 'clock' } as unknown as ClientItem
    // Kotak jam 256 px, baris jawaban, dan judul soal. Perkiraan lama 172 px untuk figur memotong halaman.
    expect(estimateItemHeight(clock, true)).toBeGreaterThan(256 + 44)
  })
  it('figur lebar lebih pendek dari figur persegi', () => {
    const line = { ...base, type: 'numberline', numberline: { min: 0, max: 10, step: 1 } } as unknown as ClientItem
    const clock = { ...base, type: 'clock' } as unknown as ClientItem
    expect(estimateItemHeight(line, false)).toBeLessThan(estimateItemHeight(clock, false))
  })
})

describe('paginate', () => {
  it('tidak pernah melewati kapasitas selama soal muat di satu halaman', () => {
    const blocks = Array.from({ length: 12 }, (_, i) => ({ kind: 'item' as const, data: i, height: 300 }))
    for (const page of paginate(blocks, 800, 902, 20)) expect(page.reduce((a, b) => a + b.height, 0) + (page.length - 1) * 20).toBeLessThanOrEqual(902)
  })
})
