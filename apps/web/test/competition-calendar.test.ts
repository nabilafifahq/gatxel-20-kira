import { describe, expect, it } from 'vitest'
import { buildMonths, dateLabel, defaultStatus, sortRows, subjectLine, timelineWhen, type EventForTimeline } from '@/server/dal/console-competitions'

describe('kalender lomba', () => {
  it('garis waktu 12 bulan mulai bulan ini, lintas tahun', () => {
    const events: EventForTimeline[] = [
      { id: 'a', name: 'KMNR', date: '2026-11-22', dateIsEstimate: true, status: 'not-registered' },
      { id: 'b', name: 'ESMO final', date: '2026-11-11', dateIsEstimate: false, status: 'registered' },
      { id: 'c', name: 'IKMC', date: '2027-03-31', dateIsEstimate: true, status: 'not-open' },
      { id: 'd', name: 'Tanpa tanggal', date: null, dateIsEstimate: true, status: 'check' },
      { id: 'e', name: 'Tidak ikut', date: '2026-12-01', dateIsEstimate: false, status: 'skip' },
      { id: 'f', name: 'Jauh', date: '2027-10-01', dateIsEstimate: false, status: 'check' },
      { id: 'g', name: 'KSNR', date: '2026-10-10', dateIsEstimate: false, status: 'done' },
    ]
    const months = buildMonths(events, '2026-10-12')
    expect(months).toHaveLength(12)
    expect(months[0]).toMatchObject({ key: '2026-10', name: 'Oktober 2026', rows: [{ id: 'g', name: 'KSNR', when: '10 Oktober, selesai' }] })
    expect(months[1]!.rows).toEqual([
      { id: 'b', name: 'ESMO final', when: '11 November' },
      { id: 'a', name: 'KMNR', when: 'November' },
    ])
    expect(months[2]!.rows).toEqual([])
    expect(months[3]).toMatchObject({ key: '2027-01', name: 'Januari 2027' })
    expect(months[11]!.key).toBe('2027-09')
    expect(months.flatMap((m) => m.rows.map((r) => r.id))).not.toContain('e')
    expect(months.flatMap((m) => m.rows.map((r) => r.id))).not.toContain('f')
  })

  it('label tanggal: pasti, perkiraan, dan belum diumumkan', () => {
    expect(dateLabel('2027-04-17', false)).toBe('17 April 2027')
    expect(dateLabel('2026-11-22', true)).toBe('Perkiraan November 2026')
    expect(dateLabel(null, true)).toBe('Tanggal belum diumumkan')
    expect(timelineWhen('2027-04-17', false, 'registered')).toBe('17 April')
  })

  it('baris mapel mengikuti urutan mapel dan bahasa katalog', () => {
    expect(subjectLine(['english', 'math'], ['id', 'en-GB'])).toBe('Math dan English')
    expect(subjectLine(['math'], ['id'])).toBe('Math, soal berbahasa Indonesia')
    expect(subjectLine(['science', 'math', 'english'], ['en-GB'])).toBe('Math, English, dan Science, soal berbahasa Inggris')
    expect(subjectLine([], null)).toBe('Mapel belum dipilih')
  })

  it('tabel: yang akan datang dulu, lalu tanpa tanggal, lalu yang sudah lewat (terbaru dulu)', () => {
    const rows = [
      { name: 'Lewat lama', date: '2026-01-01' },
      { name: 'Nanti', date: '2027-01-01' },
      { name: 'Tanpa tanggal', date: null },
      { name: 'Segera', date: '2026-10-20' },
      { name: 'Lewat baru', date: '2026-09-01' },
    ]
    expect(sortRows(rows, '2026-10-12').map((r) => r.name)).toEqual(['Segera', 'Nanti', 'Tanpa tanggal', 'Lewat baru', 'Lewat lama'])
  })

  it('status awal lomba baru', () => {
    expect(defaultStatus('2026-11-01', '2026-10-12')).toBe('not-registered')
    expect(defaultStatus('2026-10-01', '2026-10-12')).toBe('check')
    expect(defaultStatus(null, '2026-10-12')).toBe('check')
  })
})
