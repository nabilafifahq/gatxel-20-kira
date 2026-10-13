import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ENGLISH_SESSION_AREAS, sessionSkillId } from '@kira/core/english-skills'
import { containsWord, loadSpelling, SPELLING_LEVELS } from '../src/spelling'
import { loadContent } from '../src/load'

const dir = join(__dirname, '../../../content')

describe('Spelling Bee: daftar kata', () => {
  const { levels, errors } = loadSpelling(dir)
  it('semua berkas valid dan tiap tingkat punya kata', () => {
    expect(errors).toEqual([])
    for (const lv of SPELLING_LEVELS) expect(levels[lv].length).toBeGreaterThanOrEqual(30)
  })
  it('kalimat contoh memuat kata sebagai kata utuh', () => {
    expect(containsWord('The cat sat.', 'cat')).toBe(true)
    expect(containsWord('Concatenate it.', 'cat')).toBe(false)
    expect(containsWord('Cat!', 'cat')).toBe(true)
  })
})

describe('Keterampilan English: skill dan soal untuk setiap kelas', () => {
  const { index, errors } = loadContent(dir)
  it('konten tanpa error', () => expect(errors).toEqual([]))
  it('setiap kelas punya skill listening, speaking, dan writing dengan soal', () => {
    for (let g = 1; g <= 6; g++) {
      for (const area of ENGLISH_SESSION_AREAS) {
        const id = sessionSkillId(g, area)
        expect(index.skills.has(id), id).toBe(true)
        const items = index.itemsBySkill.get(id) ?? []
        expect(items.length, id).toBeGreaterThanOrEqual(area === 'writing' ? 5 : 6)
        const want = area === 'listening' ? 'mcq' : area === 'speaking' ? 'speak' : 'write'
        expect(items.every((i) => i.type === want), id).toBe(true)
      }
    }
  })
  it('soal speaking punya rubrik gaya Starters dan gambar bila perlu', () => {
    const items = index.itemsBySkill.get('e2.starters-speaking') ?? []
    expect(items.length).toBeGreaterThan(0)
    for (const i of items) {
      expect(i.type).toBe('speak')
      if (i.type === 'speak') expect(i.rubric.criteria.reduce((n, c) => n + c.points, 0)).toBe(5)
    }
    expect(items.some((i) => i.figure)).toBe(true)
  })
})
