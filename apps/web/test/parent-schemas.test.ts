import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { presetRules } from '@kira/core'
import { parentSchemas as S } from '../src/server/actions/parent-schemas'

/** Skema aksi orang tua: strict (kolom asing ditolak), batas nilai, dan bentuk aturan hari. */

const id = randomUUID()

describe('skema aksi orang tua', () => {
  it('menolak kolom yang tidak dikenal, termasuk org dan peran', () => {
    expect(() => S.unlock.parse({ learnerId: id, orgId: randomUUID() })).toThrow()
    expect(() => S.sound.parse({ learnerId: id, soundEnabled: true, musicEnabled: true, role: 'tutor' })).toThrow()
    expect(() => S.markWork.parse({ responseId: id, verdict: 'good', feedback: '', gradedBy: id })).toThrow()
    expect(() => S.addChild.parse({ name: 'Ayu', grade: 2, avatar: 'fox', pin: ['sun', 'moon', 'star', 'cat'], guardianId: id })).toThrow()
  })

  it('ganti pelajaran: id sesi UUID, id skill berbentuk benar, kolom asing ditolak', () => {
    expect(S.sessionSkill.parse({ questId: id, skillId: 'm2.place-value' })).toBeTruthy()
    expect(() => S.sessionSkill.parse({ questId: 'x', skillId: 'm2.place-value' })).toThrow()
    expect(() => S.sessionSkill.parse({ questId: id, skillId: "m2.place-value'; drop table quest" })).toThrow()
    expect(() => S.sessionSkill.parse({ questId: id, skillId: 'm2.place-value', learnerId: id })).toThrow()
  })

  it('menolak id yang bukan UUID', () => {
    expect(() => S.unlock.parse({ learnerId: 'abc' })).toThrow()
    expect(() => S.quest.parse({ questId: '1' })).toThrow()
  })

  it('batas waktu layar 15 sampai 180 menit dan hari istirahat 0 sampai 6', () => {
    expect(S.limits.parse({ learnerId: id, screenLimitMin: 15, restWeekdays: [0, 6] })).toBeTruthy()
    expect(() => S.limits.parse({ learnerId: id, screenLimitMin: 14, restWeekdays: [] })).toThrow()
    expect(() => S.limits.parse({ learnerId: id, screenLimitMin: 181, restWeekdays: [] })).toThrow()
    expect(() => S.limits.parse({ learnerId: id, screenLimitMin: 60, restWeekdays: [7] })).toThrow()
  })

  it('PIN harus 4 gambar dari daftar, nama 1 sampai 40 karakter, kelas 1 sampai 6', () => {
    const ok = { name: ' Ayu ', grade: 6, avatar: 'cat', pin: ['sun', 'moon', 'star', 'cat'], guardianConsent: true }
    expect(S.addChild.parse(ok).name).toBe('Ayu')
    // Persetujuan orang tua wajib true: tidak dikirim atau false ditolak.
    const { guardianConsent: _omit, ...withoutConsent } = ok
    expect(() => S.addChild.parse(withoutConsent)).toThrow()
    expect(() => S.addChild.parse({ ...ok, guardianConsent: false })).toThrow()
    expect(() => S.addChild.parse({ ...ok, pin: ['sun', 'moon', 'star'] })).toThrow()
    expect(() => S.addChild.parse({ ...ok, pin: ['sun', 'moon', 'star', 'dog'] })).toThrow()
    expect(() => S.addChild.parse({ ...ok, name: '' })).toThrow()
    expect(() => S.addChild.parse({ ...ok, name: 'x'.repeat(41) })).toThrow()
    expect(() => S.addChild.parse({ ...ok, grade: 7 })).toThrow()
    expect(() => S.addChild.parse({ ...ok, avatar: 'dragon' })).toThrow()
  })

  it('aturan hari: preset tanpa isi, Kustom dengan Senin sampai Sabtu lengkap, nilai asing ditolak', () => {
    expect(S.dayRules.parse({ learnerId: id, preset: 'ringan', rules: null })).toBeTruthy()
    expect(S.dayRules.parse({ learnerId: id, preset: 'kustom', rules: presetRules('penuh') })).toBeTruthy()
    const bad = structuredClone(presetRules('penuh')) as Record<string, Record<string, Record<string, string>>>
    bad['1']!.math!.latihan = 'wajib'
    expect(() => S.dayRules.parse({ learnerId: id, preset: 'kustom', rules: bad })).toThrow()
    const missing = structuredClone(presetRules('penuh')) as Record<string, unknown>
    delete missing['6']
    expect(() => S.dayRules.parse({ learnerId: id, preset: 'kustom', rules: missing })).toThrow()
    expect(() => S.dayRules.parse({ learnerId: id, preset: 'bebas', rules: null })).toThrow()
  })

  it('jumlah soal 5 sampai 30, penilaian hanya Bagus atau Coba lagi', () => {
    expect(S.questionCount.parse({ questId: id, questionCount: 5 })).toBeTruthy()
    expect(() => S.questionCount.parse({ questId: id, questionCount: 4 })).toThrow()
    expect(() => S.questionCount.parse({ questId: id, questionCount: 31 })).toThrow()
    expect(() => S.markWork.parse({ responseId: id, verdict: 'maybe', feedback: '' })).toThrow()
    expect(() => S.markWork.parse({ responseId: id, verdict: 'good', feedback: 'x'.repeat(501) })).toThrow()
  })
})
