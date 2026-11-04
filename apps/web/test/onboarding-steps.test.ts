import { describe, expect, it } from 'vitest'
import { naturalStep, resolveStep } from '@/lib/onboarding-steps'

const none = { setupPath: null }
const rec = { setupPath: 'recommended' as const }
const skip = { setupPath: 'skipped' as const }

describe('langkah onboarding', () => {
  it('tanpa anak selalu di langkah 1', () => {
    expect(naturalStep([])).toBe(1)
    for (const r of [null, '1', '2', '3', 'x', '9']) expect(resolveStep([], r)).toBe(1)
  })

  it('ada anak tanpa jalur: muat ulang melanjutkan di langkah 2, maju ke 3 dikembalikan ke 2', () => {
    expect(resolveStep([none], null)).toBe(2)
    expect(resolveStep([rec, none], null)).toBe(2)
    expect(resolveStep([none], '3')).toBe(2)
  })

  it('semua anak punya jalur: langkah 3, dan mundur tetap boleh', () => {
    expect(resolveStep([rec], null)).toBe(3)
    expect(resolveStep([skip, rec], null)).toBe(3)
    expect(resolveStep([rec], '1')).toBe(1)
    expect(resolveStep([rec], '2')).toBe(2)
  })

  it('nilai aneh diabaikan', () => {
    expect(resolveStep([rec], '0')).toBe(3)
    expect(resolveStep([rec], 'abc')).toBe(3)
  })
})
