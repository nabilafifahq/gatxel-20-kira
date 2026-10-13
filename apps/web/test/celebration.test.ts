import { describe, expect, it } from 'vitest'
import { confettiFor, starsFor, xpBarView } from '@/components/learner/celebration-logic'

describe('starsFor', () => {
  it('memberi 3 bintang mulai 90 persen, 2 mulai 60 persen, selain itu 1', () => {
    expect(starsFor({ right: 9, total: 10, pending: 0 })).toBe(3)
    expect(starsFor({ right: 10, total: 10, pending: 0 })).toBe(3)
    expect(starsFor({ right: 6, total: 10, pending: 0 })).toBe(2)
    expect(starsFor({ right: 8, total: 10, pending: 0 })).toBe(2)
    expect(starsFor({ right: 5, total: 10, pending: 0 })).toBe(1)
    expect(starsFor({ right: 0, total: 10, pending: 0 })).toBe(1)
  })
  it('tidak menghitung soal yang menunggu tutor', () => {
    expect(starsFor({ right: 4, total: 8, pending: 4 })).toBe(3)
    expect(starsFor({ right: 0, total: 8, pending: 8 })).toBeNull()
    expect(starsFor({ right: 0, total: 0, pending: 0 })).toBeNull()
  })
})

describe('confettiFor', () => {
  it('hanya untuk 2 bintang ke atas', () => {
    expect(confettiFor(null)).toBe(false)
    expect(confettiFor(1)).toBe(false)
    expect(confettiFor(2)).toBe(true)
    expect(confettiFor(3)).toBe(true)
  })
})

describe('xpBarView', () => {
  it('mengisi bar dari posisi sebelumnya ke sesudahnya di level yang sama', () => {
    const v = xpBarView({ before: { level: 2, into: 20, span: 100 }, after: { level: 2, into: 60, span: 100 } })
    expect(v.from).toBeCloseTo(0.2)
    expect(v.to).toBeCloseTo(0.6)
    expect(v.leveledUp).toBe(false)
    expect(v.line).toBe('60 of 100 XP to level 3')
  })
  it('mulai dari kosong saat naik level', () => {
    const v = xpBarView({ before: { level: 2, into: 90, span: 100 }, after: { level: 3, into: 30, span: 150 } })
    expect(v.leveledUp).toBe(true)
    expect(v.from).toBe(0)
    expect(v.to).toBeCloseTo(0.2)
    expect(v.level).toBe(3)
  })
  it('tahan rentang nol', () => {
    const v = xpBarView({ before: { level: 1, into: 0, span: 0 }, after: { level: 1, into: 0, span: 0 } })
    expect(v.from).toBe(0)
    expect(v.to).toBe(0)
  })
})
