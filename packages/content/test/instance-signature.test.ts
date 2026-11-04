import { describe, expect, it } from 'vitest'
import { genRef, instanceSignature } from '../src/math'

describe('instanceSignature', () => {
  it('sama untuk ref yang sama dan berbeda untuk seed berbeda yang menghasilkan soal berbeda', () => {
    const a = genRef('m3.add-sub-columns', 3, 'abc')
    expect(instanceSignature(a)).toBe(instanceSignature(a))
    const sigs = new Set(['a1', 'b2', 'c3', 'd4', 'e5', 'f6'].map((s) => instanceSignature(genRef('m3.add-sub-columns', 3, s))))
    expect(sigs.size).toBeGreaterThan(3)
  })
})
