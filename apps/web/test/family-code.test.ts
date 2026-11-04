import { describe, expect, it } from 'vitest'
import { firstNameChoices, formatFamilyCode, isFamilyCode, normalizeFamilyCode } from '@/lib/family-code'

describe('kode keluarga', () => {
  it('menerima ketikan dengan huruf kecil, spasi, dan tanda hubung', () => {
    expect(normalizeFamilyCode(' bcdf-gh23 ')).toBe('BCDFGH23')
    expect(isFamilyCode('BCDFGH23')).toBe(true)
  })

  it('menolak karakter yang membingungkan dan panjang yang salah', () => {
    for (const bad of ['BCDFGH20', 'BCDFGH2O', 'BCDFGH21', 'BCDFGH2I', 'BCDFGH2L', 'BCDFGH2A', 'BCDFGH2', 'BCDFGH234', '']) expect(isFamilyCode(bad)).toBe(false)
  })

  it('menampilkan empat dan empat', () => {
    expect(formatFamilyCode('BCDFGH23')).toBe('BCDF-GH23')
    expect(formatFamilyCode('bcd')).toBe('BCD')
    expect(formatFamilyCode('bcdfgh23999')).toBe('BCDF-GH23')
  })
})

describe('nama depan', () => {
  it('hanya kata pertama, urut nama', () => {
    expect(firstNameChoices([{ id: '2', name: 'Raka Pratama' }, { id: '1', name: ' Aisha  Putri ' }])).toEqual([
      { id: '1', firstName: 'Aisha' },
      { id: '2', firstName: 'Raka' },
    ])
  })

  it('saudara bernama depan sama tetap bisa dibedakan', () => {
    expect(firstNameChoices([{ id: '1', name: 'Ani Putri' }, { id: '2', name: 'Ani Sari' }]).map((c) => c.firstName)).toEqual(['Ani P.', 'Ani S.'])
    expect(firstNameChoices([{ id: '1', name: 'Ani' }, { id: '2', name: 'Ani' }]).map((c) => c.firstName)).toEqual(['Ani 1', 'Ani 2'])
  })
})
