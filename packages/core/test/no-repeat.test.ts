import { describe, expect, it } from 'vitest'
import { assembleSession, createRng, pickItems, unseenOnly, type Candidate } from '../src'

const pool = (n: number, seen: Record<number, number> = {}): Candidate[] =>
  Array.from({ length: n }, (_, i) => ({ ref: `s.x.${String(i).padStart(3, '0')}`, difficulty: 3, ...(seen[i] !== undefined ? { seenDaysAgo: seen[i]! } : {}) }))

describe('tanpa soal berulang', () => {
  it('soal yang sudah dilihat tidak dipilih selama masih ada yang baru, berapa pun hari lalunya', () => {
    const seen: Record<number, number> = {}
    for (let i = 0; i < 6; i++) seen[i] = 400 + i
    const out = pickItems({ candidates: pool(16, seen), theta: 0, count: 10, band: [0.75, 0.85], rng: createRng('a') })
    expect(out).toHaveLength(10)
    for (const o of out) expect(Number(o.candidate.ref.slice(-3))).toBeGreaterThanOrEqual(6)
  })

  it('bank habis: soal yang paling lama dilihat dipakai lebih dulu', () => {
    const seen = { 0: 1, 1: 50, 2: 5, 3: 200, 4: 20 }
    const out = pickItems({ candidates: pool(5, seen), theta: 0, count: 3, band: [0.75, 0.85], rng: createRng('b') })
    expect(out.map((o) => o.candidate.ref).sort()).toEqual(['s.x.001', 's.x.003', 's.x.004'])
  })

  it('assembleSession tanpa reuse hanya memberi soal baru dan boleh kurang dari count', () => {
    const slots = assembleSession({ kind: 'latihan', theta: 0, candidates: pool(8, { 0: 3, 1: 3, 2: 3, 3: 3, 4: 3 }), count: 6, reuse: false, rng: createRng('c') })
    expect(slots.map((s) => s.ref).sort()).toEqual(['s.x.005', 's.x.006', 's.x.007'])
  })

  it('lintas mode: ref yang masuk avoid atau dilihat tidak muncul di Tes setelah Latihan', () => {
    const rng = createRng('d')
    const lat = assembleSession({ kind: 'latihan', theta: 0, candidates: pool(30), count: 10, rng })
    const seenAfter = Object.fromEntries(lat.map((s) => [Number(s.ref.slice(-3)), 0]))
    const tes = assembleSession({ kind: 'tes', theta: 0, candidates: pool(30, seenAfter), count: 10, reuse: false, rng })
    const latRefs = new Set(lat.map((s) => s.ref))
    expect(tes).toHaveLength(10)
    for (const t of tes) expect(latRefs.has(t.ref)).toBe(false)
  })

  it('generator tidak dihukum dan unseenOnly menyimpannya', () => {
    const gens: Candidate[] = [{ ref: 'gen:m1.x:2', difficulty: 2, unlimited: true, seenDaysAgo: 0 }]
    expect(unseenOnly(gens)).toHaveLength(1)
    const out = pickItems({ candidates: gens, theta: 0, count: 4, band: [0.75, 0.85], rng: createRng('e') })
    expect(out).toHaveLength(4)
  })
})
