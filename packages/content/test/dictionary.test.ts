import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lookupWord } from '@kira/core/dictionary'
import { checkDictionary, loadDictionary, missingContentWords } from '../src/dictionary'
import { findContentDir, loadContent } from '../src/load'

const dir = findContentDir(join(__dirname, '..'))

describe('kamus Kira (content/dictionary/en-id.json)', () => {
  const dict = loadDictionary(dir)
  it('lolos pemeriksa dan memuat atribusi Wiktionary', () => {
    const { index } = loadContent(dir)
    const problems = checkDictionary(dir, new Map([...index.skills].map(([id, s]) => [id, s.strand])))
    expect(problems).toEqual([])
    expect(dict.meta.attribution).toMatch(/Wiktionary/)
  })
  it('punya ribuan entri dan arti untuk kata sekolah yang umum', () => {
    expect(Object.keys(dict.entries).length).toBeGreaterThan(4500)
    expect(lookupWord(dict, 'ran')?.lemma).toBe('run')
    expect(lookupWord(dict, 'mice')?.entry.i[0]).toMatch(/tikus/)
    expect(lookupWord(dict, 'photosynthesis')?.entry.i[0]).toMatch(/fotosintesis/)
  })
  it('hampir semua kata yang sering muncul di konten ada di kamus', () => {
    expect(missingContentWords(dir, dict, 6).length).toBeLessThan(40)
  })
})
