import { describe, expect, it } from 'vitest'
import { createRng } from '../src/rng'
import {
  PLACEMENT_MAX,
  PLACEMENT_MIN,
  isStable,
  itemB,
  nextTheta,
  pickNext,
  retakeAllowedAt,
  seedPlan,
  sessionStartGrade,
  startTheta,
  strandGroup,
  summarise,
  thetaToGrade,
  type PlacementAnswer,
  type PlacementCandidate,
} from '../src/placement'

function bank(): PlacementCandidate[] {
  const out: PlacementCandidate[] = []
  const strands = ['Nc', 'Np', 'Nf', 'Gg', 'Gt', 'Ss']
  for (let g = 1; g <= 6; g++)
    for (const [i, s] of strands.entries()) for (let d = 1; d <= 5; d++) out.push({ ref: `m${g}.${s}${i}.${d}`, skillId: `m${g}.${s}${i}`, grade: g, strand: s, difficulty: d })
  return out
}

/** Simulasi: anak dengan kemampuan sejati menjawab dengan peluang Rasch (deterministik lewat rng). */
function simulate(trueGrade: number, parentGrade: number, seed: string) {
  const rng = createRng(seed)
  const cands = bank()
  const answers: PlacementAnswer[] = []
  let theta = startTheta(parentGrade)
  const trueTheta = (trueGrade - 3.5) * 0.6
  while (answers.length < PLACEMENT_MAX) {
    const c = pickNext({ candidates: cands, theta, asked: answers, rng })
    if (!c) break
    const b = itemB(c.grade, c.difficulty)
    const p = 1 / (1 + Math.exp(-(trueTheta - b)))
    const correct = rng.next() < p
    theta = nextTheta(theta, answers.length, b, correct)
    answers.push({ ref: c.ref, skillId: c.skillId, grade: c.grade, group: strandGroup(c.strand).id, difficulty: c.difficulty, b, correct, unsure: false, thetaAfter: theta })
    if (isStable(answers.map((a) => a.thetaAfter))) break
  }
  return summarise('math', parentGrade, answers)
}

describe('tes penempatan: inti adaptif', () => {
  it('berhenti di 8 sampai 12 soal dan tidak mengulang soal', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const r = simulate(4, 4, seed)
      expect(r.answered).toBeGreaterThanOrEqual(PLACEMENT_MIN)
      expect(r.answered).toBeLessThanOrEqual(PLACEMENT_MAX)
    }
    const rng = createRng('dup')
    const asked: PlacementAnswer[] = []
    const seen = new Set<string>()
    for (let i = 0; i < 12; i++) {
      const c = pickNext({ candidates: bank(), theta: 0, asked, rng })!
      expect(seen.has(c.ref)).toBe(false)
      seen.add(c.ref)
      asked.push({ ref: c.ref, skillId: c.skillId, grade: c.grade, group: strandGroup(c.strand).id, difficulty: 3, b: 0, correct: true, unsure: false, thetaAfter: 0 })
    }
  })

  it('naik atau turun dari kelas yang disebut orang tua', () => {
    const up = simulate(6, 3, 'naik')
    const down = simulate(1, 5, 'turun')
    expect(up.levelExact).toBeGreaterThan(3.8)
    expect(down.levelExact).toBeLessThan(3.5)
  })

  it('anak tepat di kelasnya mendapat perkiraan dekat kelas itu (rata-rata banyak anak)', () => {
    let sum = 0
    const n = 30
    for (let i = 0; i < n; i++) sum += simulate(3, 3, `s${i}`).levelExact
    expect(Math.abs(sum / n - 3)).toBeLessThan(0.8)
  })

  it('tidak stabil sebelum 8 soal dan stabil bila perkiraan berdekatan', () => {
    expect(isStable([0, 0, 0, 0])).toBe(false)
    expect(isStable([0, 0.1, 0, 0.1, 0, 0.1, 0, 0.1])).toBe(true)
    expect(isStable([0, 1, 0, 1, 0, 1, 0, 1])).toBe(false)
    expect(isStable(new Array(12).fill(0).map((_, i) => i))).toBe(true)
  })

  it('theta awal mengikuti kelas dan dipetakan balik ke kelas', () => {
    expect(thetaToGrade(startTheta(4))).toBeCloseTo(4, 5)
    expect(thetaToGrade(100)).toBe(6)
    expect(thetaToGrade(-100)).toBe(1)
  })
})

describe('tes penempatan: efek ke skill_state', () => {
  const skills = [1, 2, 3, 4, 5].flatMap((g) => ['Nc', 'Gg'].map((s) => ({ id: `m${g}.${s}`, grade: g, strand: s })))
  const groups = [
    { id: 'num', label: 'Bilangan', asked: 4, correct: 4, status: 'kuat' as const },
    { id: 'geo', label: 'Geometri dan pengukuran', asked: 3, correct: 0, status: 'perlu' as const },
    { id: 'data', label: 'Data dan peluang', asked: 0, correct: 0, status: 'belum' as const },
  ]

  it('di bawah tingkat ditandai, tingkat itu dan di atasnya tetap baru', () => {
    const rows = seedPlan({ level: 4, groups }, skills)
    const ids = new Set(rows.map((r) => r.skillId))
    expect(ids.has('m4.Nc')).toBe(false)
    expect(ids.has('m5.Gg')).toBe(false)
    expect(rows.find((r) => r.skillId === 'm1.Nc')?.gate).toBe('mastered')
    expect(rows.find((r) => r.skillId === 'm3.Nc')?.gate).toBe('review')
    // Kelompok geometri lemah: tidak dianggap dikuasai walau jauh di bawah.
    expect(rows.find((r) => r.skillId === 'm1.Gg')?.gate).toBe('review')
  })

  it('kelas 1 tidak menandai apa pun', () => {
    expect(seedPlan({ level: 1, groups }, skills)).toEqual([])
  })

  it('titik awal sesi dibatasi dekat kelas orang tua', () => {
    expect(sessionStartGrade(6, 3)).toBe(4)
    expect(sessionStartGrade(1, 5)).toBe(3)
    expect(sessionStartGrade(4, 4)).toBe(4)
  })
})

describe('tes penempatan: ringkasan dan retake', () => {
  it('kekuatan dari soal tersulit yang benar, fokus dari soal termudah yang belum tepat', () => {
    const mk = (skillId: string, b: number, correct: boolean, group = 'num'): PlacementAnswer => ({ ref: skillId, skillId, grade: 3, group, difficulty: 3, b, correct, unsure: false, thetaAfter: 0 })
    const r = summarise('math', 3, [mk('a', -1, true), mk('b', 0.5, true), mk('c', 1, true), mk('d', 1.2, true), mk('e', -0.8, false), mk('f', 0.2, false)])
    expect(r.strengths.map((t) => t.skillId)).toEqual(['d', 'c', 'b'])
    expect(r.focus.map((t) => t.skillId)).toEqual(['e', 'f'])
  })

  it('retake dibuka 30 hari setelah tes selesai', () => {
    expect(retakeAllowedAt(null)).toBeNull()
    const d = new Date('2026-11-05T00:00:00Z')
    expect(retakeAllowedAt(d)?.toISOString()).toBe('2026-12-05T00:00:00.000Z')
  })
})
