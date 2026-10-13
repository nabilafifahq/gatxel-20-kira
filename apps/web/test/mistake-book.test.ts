import { describe, expect, it } from 'vitest'
import { createRng } from '@kira/core'
import { classifyMistake, MISTAKE_LABEL, pickRedoItems, summariseTypes, topSkills, type MistakeSample } from '@/server/dal/mistake-logic'

const wrong = (over: Partial<MistakeSample> = {}): MistakeSample => ({ status: 'wrong', timeMs: 20_000, difficulty: 3, ...over })

describe('classifyMistake', () => {
  it('soal kosong adalah tidak dijawab', () => {
    expect(classifyMistake({ status: 'blank', timeMs: 0, difficulty: 3 })).toBe('blank')
  })

  it('salah dalam beberapa detik di soal tidak mudah adalah terburu-buru', () => {
    expect(classifyMistake(wrong({ timeMs: 2_500 }))).toBe('rushed')
    expect(classifyMistake(wrong({ timeMs: 4_000 }))).toBe('rushed')
  })

  it('soal mudah yang salah adalah salah di soal yang mudah, secepat apa pun', () => {
    expect(classifyMistake(wrong({ difficulty: 1, timeMs: 2_000 }))).toBe('careless')
    expect(classifyMistake(wrong({ difficulty: 2, timeMs: 30_000 }))).toBe('careless')
  })

  it('lama sekali tetapi salah', () => {
    expect(classifyMistake(wrong({ timeMs: 75_000 }))).toBe('slow')
    expect(classifyMistake(wrong({ timeMs: 50_000, expectedSeconds: 20 }))).toBe('slow')
    expect(classifyMistake(wrong({ timeMs: 50_000, expectedSeconds: 60 }))).toBe('concept')
  })

  it('soal sedang atau sulit dengan waktu wajar berarti konsep belum kuat', () => {
    expect(classifyMistake(wrong({ difficulty: 4, timeMs: 25_000 }))).toBe('concept')
  })

  it('waktu 0 (jawaban dari LJK) tidak dianggap terburu-buru', () => {
    expect(classifyMistake(wrong({ timeMs: 0, difficulty: 3 }))).toBe('concept')
    expect(classifyMistake(wrong({ timeMs: 0, difficulty: 1 }))).toBe('careless')
  })
})

describe('summariseTypes', () => {
  it('jenis yang paling sering di atas, dengan persen dan saran', () => {
    const s = summariseTypes(['concept', 'rushed', 'concept', 'blank', 'concept', 'rushed'])
    expect(s.map((x) => [x.type, x.count, x.percent])).toEqual([
      ['concept', 3, 50],
      ['rushed', 2, 33],
      ['blank', 1, 17],
    ])
    expect(s[0]!.label).toBe(MISTAKE_LABEL.concept)
    expect(s[0]!.advice.length).toBeGreaterThan(20)
  })

  it('seri diurutkan menurut urutan jenis tetap, dan daftar kosong menghasilkan daftar kosong', () => {
    expect(summariseTypes(['slow', 'blank']).map((x) => x.type)).toEqual(['blank', 'slow'])
    expect(summariseTypes([])).toEqual([])
  })
})

describe('topSkills', () => {
  it('paling sering dulu, seri menurut id, dibatasi', () => {
    const r = topSkills(['m2.a', 'm2.b', 'm2.b', 'm2.c', 'm2.c', 'm2.d'], 3)
    expect(r).toEqual([
      { skillId: 'm2.b', count: 2 },
      { skillId: 'm2.c', count: 2 },
      { skillId: 'm2.a', count: 1 },
    ])
  })
})

describe('pickRedoItems', () => {
  const open = [
    ...Array.from({ length: 8 }, (_, i) => ({ ref: `a${i}`, skillId: 'm2.a' })),
    ...Array.from({ length: 3 }, (_, i) => ({ ref: `b${i}`, skillId: 'm2.b' })),
    { ref: 'c0', skillId: 'm2.c' },
  ]

  it('tersebar antar-skill dan tidak lebih dari ukuran sesi', () => {
    const rng = createRng('x')
    const picked = pickRedoItems(open, 6, (xs) => rng.shuffle(xs))
    expect(picked).toHaveLength(6)
    expect(new Set(picked.map((p) => p.skillId))).toEqual(new Set(['m2.a', 'm2.b', 'm2.c']))
    expect(new Set(picked.map((p) => p.ref)).size).toBe(6)
  })

  it('soal lebih sedikit dari ukuran sesi diambil semua', () => {
    const rng = createRng('y')
    expect(pickRedoItems(open.slice(0, 2), 10, (xs) => rng.shuffle(xs))).toHaveLength(2)
    expect(pickRedoItems([], 10, (xs) => rng.shuffle(xs))).toEqual([])
  })
})
