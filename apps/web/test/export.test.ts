import { describe, expect, it } from 'vitest'
import { exportFilename, pseudonymize } from '@/server/dal/data-export'
import { restDaysLabel, reportWeek, safeErrorText, scrubEmails } from '@/server/dal/console-report'

describe('exportFilename', () => {
  it('kira-data-<nama>-<tanggal>.json tanpa spasi dan aksen', () => {
    expect(exportFilename('Aisha', '2026-10-12')).toBe('kira-data-aisha-2026-10-12.json')
    expect(exportFilename('Putri Syakira Fathin', '2026-10-12')).toBe('kira-data-putri-syakira-fathin-2026-10-12.json')
    expect(exportFilename('Zoë', '2026-10-12')).toBe('kira-data-zoe-2026-10-12.json')
    expect(exportFilename('learner_1', '2026-10-12')).toBe('kira-data-learner_1-2026-10-12.json')
    expect(exportFilename('!!!', '2026-10-12')).toBe('kira-data-learner-2026-10-12.json')
  })
})

describe('pseudonymize', () => {
  it('mengganti nama utuh di semua string, tanpa beda huruf besar kecil', () => {
    const data = { learner: { name: 'Raka', grade: 4 }, notes: [{ body: 'Raka cepat. RAKA suka soal bergambar, bukan Rakaman.' }], answer: { text: 'my name is raka' }, at: '2026-10-12' }
    expect(pseudonymize(data, 'Raka', 'learner_1')).toEqual({
      learner: { name: 'learner_1', grade: 4 },
      notes: [{ body: 'learner_1 cepat. learner_1 suka soal bergambar, bukan Rakaman.' }],
      answer: { text: 'my name is learner_1' },
      at: '2026-10-12',
    })
  })

  it('nama dengan karakter khusus aman dipakai sebagai pola', () => {
    expect(pseudonymize(['Ana (kecil)', 'Ana.'], 'Ana (kecil)', 'learner_1')).toEqual(['learner_1', 'Ana.'])
  })
})

describe('laporan: bantuan teks', () => {
  it('hari istirahat ditulis urut Senin dulu', () => {
    expect(restDaysLabel([0])).toBe('Minggu')
    expect(restDaysLabel([0, 6])).toBe('Sabtu dan Minggu')
    expect(restDaysLabel([3, 0, 6])).toBe('Rabu, Sabtu, dan Minggu')
    expect(restDaysLabel([])).toBe('tidak ada')
  })

  it('minggu laporan dinormalkan ke Senin dan tidak melewati minggu ini', () => {
    expect(reportWeek(null, '2026-10-16')).toBe('2026-10-12')
    expect(reportWeek('2026-10-08', '2026-10-16')).toBe('2026-10-05')
    expect(reportWeek('2026-11-02', '2026-10-16')).toBe('2026-10-12')
  })

  it('alamat email dibersihkan dari teks error', () => {
    expect(scrubEmails('gagal ke mama@contoh.test dan "papa.x+1@sub.contoh.id"')).toBe('gagal ke [email] dan "[email]"')
    const drizzleLike = Object.assign(new Error('Failed query: insert into outbox_email ... params: mama@contoh.test,<html>Aisha</html>'), {
      cause: new Error('new row violates row-level security policy for table "outbox_email"'),
    })
    expect(safeErrorText(drizzleLike)).toBe('new row violates row-level security policy for table "outbox_email"')
    expect(safeErrorText(new Error('Failed query: select ... params: x@y.z'))).toBe('Error')
  })
})
