import { describe, expect, it } from 'vitest'
import { buildImportedItem, libraryRefs } from '@/server/dal/console-import'
import { normalizeSection } from '@/server/dal/paper-library'

describe('normalizeSection', () => {
  it('bagian ditulis sebagai kode huruf besar', () => {
    expect(normalizeSection('A')).toBe('A')
    expect(normalizeSection('bagian b')).toBe('B')
    expect(normalizeSection('Part C')).toBe('C')
    expect(normalizeSection(' sesi 2 ')).toBe('2')
    expect(normalizeSection('Babak A1')).toBe('A1')
  })

  it('kosong atau penuh menjadi penuh', () => {
    expect(normalizeSection(null)).toBe('penuh')
    expect(normalizeSection('')).toBe('penuh')
    expect(normalizeSection('Penuh')).toBe('penuh')
    expect(normalizeSection('Full paper')).toBe('penuh')
    expect(normalizeSection('***')).toBe('penuh')
  })

  it('kode dipotong empat karakter', () => {
    expect(normalizeSection('ABCDEFG')).toBe('ABCD')
  })
})

describe('libraryRefs', () => {
  const stored = (number: number, approved: boolean, orgItemId: string | null) => ({
    number, prompt: 'p', options: ['a', 'b'], answer: 0, answerFromKey: 0, status: 'ok' as const, approved, orgItemId,
  })

  it('hanya soal yang sudah disetujui, urut nomor soal, sebagai ref org', () => {
    const refs = libraryRefs([stored(3, true, 'c'), stored(1, true, 'a'), stored(2, false, null), null, stored(4, true, null)])
    expect(refs).toEqual(['org:a', 'org:c'])
  })
})

describe('buildImportedItem dengan gambar soal', () => {
  const ctx = { skillId: 'm2.oly-patterns', lang: 'en-GB' as const, tags: ['ikmc', 'keep-order'] }
  const base = { prompt: 'Which shape comes next in the row?', options: ['circle', 'square', 'triangle'], answer: 1 }

  it('figur clip ikut ke soal dan lolos skema', () => {
    const r = buildImportedItem(
      { ...base, figure: { mediaId: '3f2b8f0e-5c1a-4d7e-9b1a-0c6e2d4f8a11', width: 320, height: 200, alt: 'A row of shapes with one blank.' } },
      ctx,
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.item.figure).toMatchObject({ kind: 'clip', width: 320, height: 200 })
  })

  it('tanpa gambar soal tetap seperti sebelumnya', () => {
    const r = buildImportedItem(base, ctx)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.item.figure).toBeUndefined()
  })

  it('teks pengganti yang terlalu pendek ditolak oleh skema', () => {
    const r = buildImportedItem({ ...base, figure: { mediaId: '3f2b8f0e-5c1a-4d7e-9b1a-0c6e2d4f8a11', width: 320, height: 200, alt: 'Pic' } }, ctx)
    expect(r.ok).toBe(false)
  })
})
