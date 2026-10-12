import { describe, expect, it } from 'vitest'
import { familyWeekNav } from '@/server/dal/family'

const L = '7416ea31-7602-42e3-923b-dddb96916da2'

describe('familyWeekNav', () => {
  it('bawaan minggu ini; tidak ada minggu berikutnya', () => {
    const n = familyWeekNav({ param: null, today: '2026-10-16', startedOn: '2026-09-01', learnerId: L })
    expect(n.monday).toBe('2026-10-12')
    expect(n.nextWeekHref).toBeNull()
    expect(n.prevWeekHref).toBe(`/keluarga?learner=${L}&minggu=2026-10-05`)
  })

  it('tanggal mana pun dinormalkan ke Senin, dengan tautan dua arah', () => {
    const n = familyWeekNav({ param: '2026-09-24', today: '2026-10-16', startedOn: '2026-09-01', learnerId: L })
    expect(n.monday).toBe('2026-09-21')
    expect(n.prevWeekHref).toContain('minggu=2026-09-14')
    expect(n.nextWeekHref).toContain('minggu=2026-09-28')
  })

  it('tidak bisa sebelum minggu learner mulai, dan minggu depan dikembalikan ke minggu ini', () => {
    expect(familyWeekNav({ param: '2026-08-01', today: '2026-10-16', startedOn: '2026-09-03', learnerId: L })).toMatchObject({ monday: '2026-08-31', prevWeekHref: null })
    expect(familyWeekNav({ param: '2026-12-01', today: '2026-10-16', startedOn: '2026-09-03', learnerId: L })).toMatchObject({ monday: '2026-10-12', nextWeekHref: null })
  })

  it('learner yang mulai minggu ini atau belum pernah belajar hanya punya minggu ini', () => {
    expect(familyWeekNav({ param: null, today: '2026-10-12', startedOn: '2026-10-12', learnerId: L })).toEqual({ monday: '2026-10-12', prevWeekHref: null, nextWeekHref: null })
    expect(familyWeekNav({ param: '2026-09-01', today: '2026-10-12', startedOn: null, learnerId: L })).toEqual({ monday: '2026-10-12', prevWeekHref: null, nextWeekHref: null })
  })
})
