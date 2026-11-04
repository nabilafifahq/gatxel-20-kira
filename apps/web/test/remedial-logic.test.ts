import { describe, expect, it } from 'vitest'
import { instanceSignature } from '@kira/content/math'
import { itemSchema } from '@kira/content/schema'
import { pickSibling } from '@/server/dal/remedial-logic'

const wrong = itemSchema.parse({
  id: 'm3.add-sub-columns.001',
  skill: 'm3.add-sub-columns',
  type: 'numeric',
  difficulty: 3,
  prompt: 'What is 345 + 278?',
  hints: ['One.', 'Two.', 'Three.'],
  explanation: 'Add the ones, then the tens, then the hundreds.',
  answer: 623,
})

describe('pickSibling', () => {
  it('memakai generator: angka baru di tingkat terdekat, tidak kembar dengan isi sesi', () => {
    const pool = [1, 2, 3, 4, 5].map((l) => ({ ref: `gen:m3.add-sub-columns:${l}`, difficulty: l, unlimited: true }))
    const taken = new Set(['gen:m3.add-sub-columns:3:aaa', 'gen:m3.add-sub-columns:3:bbb'])
    const ref = pickSibling({ wrong, pool, takenRefs: taken, seed: 'a:1:remedial' })!
    expect(ref).toMatch(/^gen:m3\.add-sub-columns:3:/)
    expect(taken.has(ref)).toBe(false)
    for (const t of taken) expect(instanceSignature(t)).not.toBe(instanceSignature(ref))
    // Deterministik untuk seed yang sama.
    expect(pickSibling({ wrong, pool, takenRefs: taken, seed: 'a:1:remedial' })).toBe(ref)
  })
  it('tanpa generator: soal bank skill yang sama, bukan yang sudah ada, tingkat terdekat', () => {
    const pool = [
      { ref: 's3.light.001', difficulty: 1 },
      { ref: 's3.light.002', difficulty: 3 },
      { ref: 's3.light.003', difficulty: 3 },
      { ref: 's3.light.004', difficulty: 5, manual: true },
    ]
    const ref = pickSibling({ wrong, pool, takenRefs: new Set(['s3.light.002']), seed: 'x' })
    expect(ref).toBe('s3.light.003')
  })
  it('tidak ada kandidat: null', () => {
    expect(pickSibling({ wrong, pool: [{ ref: 's3.light.001', difficulty: 3 }], takenRefs: new Set(['s3.light.001']), seed: 'x' })).toBeNull()
    expect(pickSibling({ wrong, pool: [], takenRefs: new Set(), seed: 'x' })).toBeNull()
  })
})
