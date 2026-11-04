import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { effectiveOn, FEATURE_KEYS, FEATURE_NEEDS, isFeatureKey, activeSubjects } from '@kira/core/features'
import { recommendationFor, recommendationSummary } from '@kira/core/recommendation'

const CONTENT = fileURLToPath(new URL('../../../content', import.meta.url))
const SKILLS_DIR = join(CONTENT, 'skills')

/** Jumlah skill per mapel dan kelas dari content/skills. */
function skillCounts(): Map<string, number> {
  const out = new Map<string, number>()
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (f.endsWith('.json')) {
        const j = JSON.parse(readFileSync(p, 'utf8')) as { subject?: string; grade?: number; skills?: { subject: string; grade: number }[] } | { subject: string; grade: number }[]
        const list = Array.isArray(j) ? j : (j.skills ?? [j])
        for (const s of list) out.set(`${s.subject}:${s.grade}`, (out.get(`${s.subject}:${s.grade}`) ?? 0) + 1)
      }
    }
  }
  walk(SKILLS_DIR)
  return out
}

describe('jalur rekomendasi', () => {
  const counts = skillCounts()

  for (const grade of [1, 2, 3, 4, 5, 6]) {
    describe(`kelas ${grade}`, () => {
      const r = recommendationFor(grade)

      it('setiap mapel harian punya skill di kelas itu', () => {
        expect(r.subjects.length).toBeGreaterThan(0)
        for (const s of r.subjects) expect(counts.get(`${s}:${grade}`) ?? 0).toBeGreaterThan(0)
      })

      it('hanya memakai kunci fitur yang sah, dan on serta off membagi habis semua kunci', () => {
        for (const k of [...r.on, ...r.off, ...Object.keys(r.features)]) expect(isFeatureKey(k)).toBe(true)
        expect([...r.on, ...r.off].sort()).toEqual([...FEATURE_KEYS].sort())
        expect(new Set(r.on).size).toBe(r.on.length)
      })

      it('peta yang disimpan sama dengan yang dijanjikan, termasuk ketergantungan mapel', () => {
        for (const k of r.on) {
          expect(effectiveOn(r.features, k)).toBe(true)
          const need = FEATURE_NEEDS[k]
          if (need) expect(r.on).toContain(need)
        }
        for (const k of r.off) expect(effectiveOn(r.features, k)).toBe(false)
        expect(activeSubjects(r.features)).toEqual(r.subjects)
      })

      it('fitur yang menyala punya konten untuk kelas itu', () => {
        if (r.on.includes('reading-room')) expect(readdirSync(join(CONTENT, 'books', String(grade))).length).toBeGreaterThan(0)
        if (r.on.includes('flashcards')) for (const s of r.subjects) expect(readdirSync(join(CONTENT, 'flashcards', s, `g${grade}`)).length).toBeGreaterThan(0)
      })

      it('olimpiade hanya menyala atas pilihan orang tua', () => {
        expect(r.on.some((k) => k.startsWith('olympiad-'))).toBe(false)
      })

      it('kalimat penjelasan menyebut nama dan mapel, tanpa tanda pisah', () => {
        const line = recommendationSummary('Alya', grade)
        expect(line).toContain('Alya')
        for (const s of ['Math', 'English', 'Science']) expect(line).toContain(s)
        expect(line).not.toMatch(new RegExp(`[${String.fromCodePoint(0x2013, 0x2014)}]`))
      })
    })
  }

  it('Paper menyala di semua kelas karena hari Seimbang memuatnya sebagai opsional, Quiz Arena mulai kelas 3', () => {
    for (const g of [1, 2, 3, 4, 5, 6]) expect(recommendationFor(g).on).toContain('paper')
    for (const g of [1, 2]) expect(recommendationFor(g).off).toContain('quiz-arena')
    for (const g of [3, 4, 5, 6]) expect(recommendationFor(g).on).toContain('quiz-arena')
  })

  it('kelas di luar 1 sampai 6 ditolak', () => {
    expect(() => recommendationFor(0)).toThrow()
    expect(() => recommendationFor(7)).toThrow()
  })
})
