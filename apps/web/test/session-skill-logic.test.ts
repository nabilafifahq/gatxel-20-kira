import { describe, expect, it } from 'vitest'
import { groupSkillOptions, joinId, sessionName, sessionState, skillChangeTargets, skillChangeView, type SkillSession } from '../src/server/dal/session-skill-logic'

/** Ganti pelajaran: sesi mana yang kena, dan daftar pilihan per topik. */

const s = (id: string, over: Partial<SkillSession> = {}): SkillSession => ({ id, subject: 'math', session: 'latihan', required: true, seq: 0, skillId: 'm2.a', state: 'ready', ...over })
const ids = (p: ReturnType<typeof skillChangeTargets>) => p.targets.map((t) => t.id)

describe('skillChangeTargets', () => {
  it('sesi selesai ditolak, begitu juga Paper', () => {
    const done = s('l', { state: 'done' })
    expect(skillChangeTargets(done, [done, s('t', { session: 'tes' })]).blocked).toBe('done')
    const paper = s('p', { session: 'paper', skillId: null })
    expect(skillChangeTargets(paper, [paper]).blocked).toBe('kind')
  })

  it('Latihan belum dimulai: Tes yang mengikutinya ikut berganti, Tes dengan pelajaran sendiri tidak', () => {
    const lat = s('l')
    expect(ids(skillChangeTargets(lat, [lat, s('t', { session: 'tes' })]))).toEqual(['l', 't'])
    expect(ids(skillChangeTargets(lat, [lat, s('t', { session: 'tes', skillId: 'm2.b' })]))).toEqual(['l'])
    expect(ids(skillChangeTargets(lat, [lat, s('t', { session: 'tes', state: 'done' })]))).toEqual(['l'])
  })

  it('Tes belum dimulai: hanya Tes itu, Latihan tidak ikut', () => {
    const tes = s('t', { session: 'tes' })
    expect(ids(skillChangeTargets(tes, [s('l'), tes]))).toEqual(['t'])
  })

  it('sedang dikerjakan: sesi itu tetap berjalan, perubahan berlaku mulai sesi berikutnya', () => {
    const lat = s('l', { state: 'in-progress' })
    expect(ids(skillChangeTargets(lat, [lat, s('t', { session: 'tes' })]))).toEqual(['t'])
    expect(ids(skillChangeTargets(lat, [lat, s('t', { session: 'tes', skillId: 'm2.b' })]))).toEqual(['t'])
    const extra = s('x', { required: false, seq: 1 })
    expect(ids(skillChangeTargets(lat, [lat, s('t', { session: 'tes' }), extra]))).toEqual(['x', 't'])
  })

  it('sedang dikerjakan tanpa sesi berikutnya: tidak ada yang bisa diganti', () => {
    const tes = s('t', { session: 'tes', state: 'in-progress' })
    expect(skillChangeTargets(tes, [s('l', { state: 'done' }), tes]).blocked).toBe('no-next')
    expect(skillChangeTargets(tes, [tes, s('p', { session: 'paper', skillId: null })]).blocked).toBe('no-next')
  })

  it('mapel lain tidak ikut', () => {
    const lat = s('l')
    expect(ids(skillChangeTargets(lat, [lat, s('e', { subject: 'english', session: 'tes' })]))).toEqual(['l'])
    const started = s('l2', { state: 'in-progress' })
    expect(skillChangeTargets(started, [started, s('e', { subject: 'english', session: 'tes' })]).blocked).toBe('no-next')
  })
})

describe('skillChangeView', () => {
  it('pesan untuk orang tua per keadaan sesi', () => {
    const tes = s('t', { session: 'tes' })
    expect(skillChangeView(s('l'), [s('l'), tes], sessionName)).toMatchObject({ canChange: true, note: null, appliesTo: 'Latihan Math dan Tes Math' })
    const running = s('l', { state: 'in-progress' })
    const v = skillChangeView(running, [running, tes], sessionName)
    expect(v).toMatchObject({ canChange: true, appliesTo: 'Tes Math' })
    expect(v.note).toContain('tetap berjalan')
    expect(v.note).toContain('mulai Tes Math')
    expect(skillChangeView(running, [running], sessionName)).toMatchObject({ canChange: false, appliesTo: null })
    expect(skillChangeView(s('l', { state: 'done' }), [], sessionName).note).toContain('Sudah selesai')
    expect(skillChangeView(s('p', { session: 'paper' }), [], sessionName)).toMatchObject({ canChange: false, note: null })
  })

  it('jawaban yang sudah masuk berarti sedang dikerjakan, walau status quest masih ready', () => {
    expect(sessionState('ready', 0)).toBe('ready')
    expect(sessionState('ready', 1)).toBe('in-progress')
    expect(sessionState('in_progress', 0)).toBe('in-progress')
    expect(sessionState('done', 3)).toBe('done')
  })
})

describe('groupSkillOptions', () => {
  const opt = (id: string, strand: string, order: number, titleId = `Nama ${id}`) => ({ id, strand, order, title: `English ${id}`, titleId })

  it('kelompok per topik, urut kurikulum, nama Indonesia dengan nama English', () => {
    const topics = groupSkillOptions([opt('b', 'Ni', 2), opt('a', 'Np', 1), opt('c', 'Np', 3)], (st) => (st === 'Np' ? 'Nilai tempat' : 'Bilangan bulat'))
    expect(topics.map((t) => t.label)).toEqual(['Nilai tempat', 'Bilangan bulat'])
    expect(topics[0]!.skills).toEqual([
      { id: 'a', title: 'Nama a', titleEn: 'English a' },
      { id: 'c', title: 'Nama c', titleEn: 'English c' },
    ])
  })

  it('topik tanpa nama Indonesia dan pelajaran tanpa nama Indonesia tetap jujur', () => {
    const [t] = groupSkillOptions([opt('a', 'Zz', 1, ' ')], () => null)
    expect(t!.label).toBe('Topik lain')
    expect(t!.skills[0]!.title).toBe('English a')
  })
})

describe('joinId', () => {
  it('menyambung nama sesi', () => {
    expect(joinId(['A'])).toBe('A')
    expect(joinId(['A', 'B'])).toBe('A dan B')
    expect(joinId(['A', 'B', 'C'])).toBe('A, B, dan C')
  })
})
