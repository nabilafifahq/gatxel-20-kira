import { describe, expect, it } from 'vitest'
import { arenaParagraph } from '@/components/family/summaryText'

describe('arenaParagraph', () => {
  const base = { qmRounds: 0, qmBestPpm: null, quizRounds: 0, topicsTried: 0, topicsTotal: 12, factsKnown: 0, factsTotal: 600 }
  it('kosong bila tidak ada kegiatan arena', () => {
    expect(arenaParagraph(null)).toBeNull()
    expect(arenaParagraph(undefined)).toBeNull()
    expect(arenaParagraph(base)).toBeNull()
  })
  it('menyebut kecepatan terbaik Quick Maths dan kemajuan topik Quiz Arena', () => {
    const t = arenaParagraph({ ...base, qmRounds: 5, qmBestPpm: 14.4, quizRounds: 3, topicsTried: 4, factsKnown: 40, factsTotal: 600 })!
    expect(t).toContain('kecepatan terbaik minggu ini 14 soal per menit dalam 5 ronde')
    expect(t).toContain('3 ronde minggu ini. 4 dari 12 topik sudah dicoba dan 40 dari 600 fakta sudah dikenal')
    expect(t).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)};]`))
  })
  it('Quick Maths tanpa sprint akurat tidak menyebut kecepatan', () => {
    expect(arenaParagraph({ ...base, qmRounds: 2 })).toBe('Quick Maths dimainkan 2 ronde minggu ini.')
  })
})
