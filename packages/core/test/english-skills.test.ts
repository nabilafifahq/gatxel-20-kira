import { describe, expect, it } from 'vitest'
import { areaOfSessionRef, groupByArea, sessionRef, sessionSkillId, yleAreaOfSkill, yleLevelOfGrade } from '../src/english-skills'

describe('Keterampilan English dan Cambridge Young Learners', () => {
  it('kelas dipetakan ke Starters, Movers, dan Flyers', () => {
    expect(yleLevelOfGrade(1)).toMatchObject({ id: 'starters', cefr: 'Pre A1' })
    expect(yleLevelOfGrade(2).id).toBe('starters')
    expect(yleLevelOfGrade(3)).toMatchObject({ id: 'movers', cefr: 'A1' })
    expect(yleLevelOfGrade(4).id).toBe('movers')
    expect(yleLevelOfGrade(5)).toMatchObject({ id: 'flyers', cefr: 'A2' })
    expect(yleLevelOfGrade(6).id).toBe('flyers')
  })
  it('id skill sesi mengikuti kelas', () => {
    expect(sessionSkillId(2, 'listening')).toBe('e2.starters-listening')
    expect(sessionSkillId(4, 'speaking')).toBe('e4.movers-speaking')
    expect(sessionSkillId(6, 'writing')).toBe('e6.flyers-writing')
  })
  it('referensi attempt bisa dibaca kembali', () => {
    expect(areaOfSessionRef(sessionRef('speaking'))).toBe('speaking')
    expect(areaOfSessionRef('english:reading')).toBeNull()
    expect(areaOfSessionRef('esmo-pack-1')).toBeNull()
    expect(areaOfSessionRef(null)).toBeNull()
  })
  it('strand dipetakan ke empat keterampilan', () => {
    expect(yleAreaOfSkill('e2.magic-e', 'Rw')).toBe('reading')
    expect(yleAreaOfSkill('e3.inference', 'Ri')).toBe('reading')
    expect(yleAreaOfSkill('e2.writing', 'Wc')).toBe('writing')
    expect(yleAreaOfSkill('e2.vowel-spellings', 'Ww')).toBe('writing')
    expect(yleAreaOfSkill('e2.speaking', 'SL')).toBe('speaking')
    expect(yleAreaOfSkill('e3.starters-listening', 'SL')).toBe('listening')
    expect(yleAreaOfSkill('e4.discussing', 'SL')).toBe('speaking')
    expect(yleAreaOfSkill('e2.starters-speaking', 'SL')).toBe('speaking')
  })
  it('mengelompokkan skill menurut keterampilan', () => {
    const g = groupByArea([
      { id: 'e2.magic-e', strand: 'Rw' },
      { id: 'e2.writing', strand: 'Wc' },
      { id: 'e2.speaking', strand: 'SL' },
      { id: 'e2.starters-listening', strand: 'SL' },
    ])
    expect(g.reading).toHaveLength(1)
    expect(g.writing).toHaveLength(1)
    expect(g.speaking).toHaveLength(1)
    expect(g.listening).toHaveLength(1)
  })
})
