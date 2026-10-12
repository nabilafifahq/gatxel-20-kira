import { describe, expect, it } from 'vitest'
import { confirmNameMatches, consentHistory, deletionSchedule, joinTitles, purposeText, type ConsentRow } from '@/server/dal/privacy'
import { privacyNoticeData } from '@/server/legal'

const MAMA = 'guardian-1'
const TUTOR = 'tutor-1'
const names = new Map([
  [MAMA, 'Mama Contoh'],
  [TUTOR, 'Tutor Contoh'],
])

function row(purpose: ConsentRow['purpose'], granted: boolean, at: string, extra: Partial<ConsentRow> = {}): ConsentRow {
  return { purpose, granted, method: 'in-app', noticeVersion: '2026-10-12', evidence: null, recordedBy: MAMA, at: new Date(at), ...extra }
}

describe('tujuan persetujuan', () => {
  it('judul dan isi sama dengan Kebijakan Privasi, urutannya sama', () => {
    const notice = privacyNoticeData().purposes
    expect(purposeText('learning')).toEqual(notice[0])
    expect(purposeText('progress-email')).toEqual(notice[1])
    expect(purposeText('audio')).toEqual(notice[2])
    expect(purposeText('photo')).toEqual(notice[3])
    expect(purposeText('ai-drafts')).toEqual(notice[4])
    expect(notice).toHaveLength(5)
  })
})

describe('consentHistory', () => {
  it('menggabungkan perubahan yang dicatat bersamaan dan mengurutkan terbaru dulu', () => {
    const rows = [
      row('learning', true, '2026-10-12T10:16:51.219Z'),
      row('progress-email', true, '2026-10-12T10:16:51.219Z'),
      row('audio', true, '2026-10-12T10:16:51.900Z'),
      row('audio', false, '2026-10-14T13:00:00Z'),
    ]
    const h = consentHistory(rows, names, 'Aisha')
    expect(h).toHaveLength(2)
    expect(h[0]).toEqual({ date: '2026-10-14T13:00:00.000Z', text: 'Rekaman suara ditarik di aplikasi oleh Mama Contoh, Kebijakan Privasi versi 2026-10-12.' })
    expect(h[1]!.text).toBe('Belajar di Kira, laporan mingguan lewat email, dan rekaman suara disetujui di aplikasi oleh Mama Contoh, Kebijakan Privasi versi 2026-10-12.')
  })

  it('menarik persetujuan belajar menyebut akun dijeda; persetujuan tertulis menyebut pencatat dan bukti', () => {
    const h = consentHistory(
      [
        row('learning', false, '2026-10-15T01:00:00Z'),
        row('photo', true, '2026-10-01T01:00:00Z', { method: 'offline', recordedBy: TUTOR, evidence: 'Formulir kertas, 1 Oktober 2026' }),
      ],
      names,
      'Aisha',
    )
    expect(h[0]!.text).toBe('Belajar di Kira ditarik di aplikasi oleh Mama Contoh, Kebijakan Privasi versi 2026-10-12. Akun Aisha dijeda.')
    expect(h[1]!.text).toBe('Foto dan gambar jawaban disetujui dicatat dari persetujuan tertulis oleh Tutor Contoh, Kebijakan Privasi versi 2026-10-12. Bukti: Formulir kertas, 1 Oktober 2026.')
  })

  it('arah atau pencatat yang berbeda tidak digabung', () => {
    const h = consentHistory([row('audio', true, '2026-10-12T10:00:00Z'), row('photo', false, '2026-10-12T10:00:00Z'), row('ai-drafts', true, '2026-10-12T10:00:00Z', { recordedBy: TUTOR })], names, 'A')
    expect(h).toHaveLength(3)
  })

  it('tanpa catatan tidak ada riwayat', () => {
    expect(consentHistory([], names, 'A')).toEqual([])
  })
})

describe('joinTitles', () => {
  it('menyambung dengan dan, huruf kecil kecuali singkatan', () => {
    expect(joinTitles(['Rekaman suara'])).toBe('Rekaman suara')
    expect(joinTitles(['Rekaman suara', 'Foto dan gambar jawaban'])).toBe('Rekaman suara dan foto dan gambar jawaban')
    expect(joinTitles(['A', 'AI untuk tutor', 'Laporan'])).toBe('A, AI untuk tutor, dan laporan')
  })
})

describe('deletionSchedule', () => {
  it('tujuh hari setelah hari ini, job pukul 00.00 WIB tanggal itu', () => {
    const s = deletionSchedule('2026-10-12')
    expect(s.scheduledFor).toBe('2026-10-19')
    expect(s.runAfter.toISOString()).toBe('2026-10-18T17:00:00.000Z')
  })

  it('lintas bulan dan tahun', () => {
    expect(deletionSchedule('2026-12-28').scheduledFor).toBe('2027-01-04')
  })
})

describe('confirmNameMatches', () => {
  it('mengabaikan spasi tepi dan huruf besar kecil', () => {
    expect(confirmNameMatches('  aisha ', 'Aisha')).toBe(true)
    expect(confirmNameMatches('AISHA', 'Aisha')).toBe(true)
    expect(confirmNameMatches('Putri  Syakira', 'Putri Syakira')).toBe(true)
  })
  it('menolak nama lain atau kosong', () => {
    expect(confirmNameMatches('Aish', 'Aisha')).toBe(false)
    expect(confirmNameMatches('Raka', 'Aisha')).toBe(false)
    expect(confirmNameMatches('   ', 'Aisha')).toBe(false)
  })
})
