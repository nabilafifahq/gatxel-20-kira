import { describe, expect, it } from 'vitest'
import { activeSubjects, effectiveOn, FEATURE_GROUPS, FEATURE_KEYS, featureOn, olympiadOn, presetMap, sessionAllowed, skillAllowed } from '../src/features'

describe('saklar fitur', () => {
  it('semua kunci ada di tepat satu kelompok tampilan', () => {
    const all = FEATURE_GROUPS.flatMap((g) => g.keys).sort()
    expect(all).toEqual([...FEATURE_KEYS].sort())
  })
  it('bawaan semua menyala', () => {
    for (const k of FEATURE_KEYS) expect(featureOn({}, k)).toBe(true)
    expect(activeSubjects({})).toEqual(['math', 'english', 'science'])
  })
  it('contoh pemilik: hanya Science dan English harian, Olimpiade Science, Vocab', () => {
    const map = { math: false, 'drill-math': false, 'mental-math': false, 'olympiad-math': false, 'olympiad-english': false } as const
    expect(activeSubjects(map)).toEqual(['english', 'science'])
    expect(effectiveOn(map, 'drill-math')).toBe(false)
    expect(effectiveOn(map, 'vocab')).toBe(true)
    expect(olympiadOn(map, 'science')).toBe(true)
    expect(olympiadOn(map, 'math')).toBe(false)
    expect(sessionAllowed(map, 'math', 'latihan')).toBe(false)
    expect(sessionAllowed(map, 'science', 'latihan')).toBe(true)
  })
  it('Math mati mematikan Drill Math walau saklarnya sendiri menyala', () => {
    expect(effectiveOn({ math: false }, 'drill-math')).toBe(false)
    expect(effectiveOn({ math: false }, 'mental-math')).toBe(false)
  })
  it('sesi dikaitkan ke saklar fitur yang benar', () => {
    expect(sessionAllowed({ paper: false }, 'english', 'paper')).toBe(false)
    expect(sessionAllowed({ paper: false }, 'english', 'tes')).toBe(true)
    expect(sessionAllowed({ 'olympiad-english': false }, 'english', 'simulation')).toBe(false)
    expect(sessionAllowed({ 'quiz-arena': false }, 'science', 'knowledge')).toBe(false)
  })
  it('preset', () => {
    expect(presetMap('lengkap')).toEqual({})
    expect(presetMap('fokus-sekolah')['olympiad-math']).toBe(false)
    expect(presetMap('olimpiade')['quiz-arena']).toBe(false)
  })
})

describe('skillAllowed dan alat peraga', () => {
  it('mapel mati menutup semua skillnya, strand Oly juga butuh saklar Olimpiade', () => {
    expect(skillAllowed({ math: false }, 'math', 'Num')).toBe(false)
    expect(skillAllowed({ 'olympiad-science': false }, 'science', 'Oly')).toBe(false)
    expect(skillAllowed({ 'olympiad-science': false }, 'science', 'Bio')).toBe(true)
    expect(skillAllowed({}, 'science', 'Oly')).toBe(true)
    expect(skillAllowed({}, 'math', undefined)).toBe(true)
  })
  it('Math mati ikut mematikan alat peraga Math', () => {
    expect(effectiveOn({ math: false }, 'manipulatives')).toBe(false)
    expect(effectiveOn({}, 'manipulatives')).toBe(true)
  })
})
