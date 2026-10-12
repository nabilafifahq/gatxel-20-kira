import { describe, expect, it } from 'vitest'
import { JobError, PostponeError, UsageLimitError, abortError } from '../src/errors'
import { MAX_ATTEMPTS, decide } from '../src/queue'

const now = new Date('2026-10-12T09:00:00Z') // 16.00 WIB

describe('decide: keputusan setelah handler gagal', () => {
  it('kesalahan yang bisa dicoba lagi: jeda 2^attempts menit', () => {
    const d1 = decide(new JobError('Server Claude sedang bermasalah (kode 500).'), 1, false, now)
    expect(d1).toMatchObject({ action: 'retry', refund: false })
    expect(d1.runAfter).toEqual(new Date(now.getTime() + 2 * 60_000))
    expect(d1.message).toBe('Server Claude sedang bermasalah (kode 500). Dicoba lagi otomatis pukul 16.02 WIB.')
    expect(decide(new JobError('x'), 2, false, now).runAfter).toEqual(new Date(now.getTime() + 4 * 60_000))
  })

  it(`gagal permanen setelah ${MAX_ATTEMPTS} percobaan`, () => {
    const d = decide(new JobError('Claude tidak menjawab dalam 5 menit.'), MAX_ATTEMPTS, false, now)
    expect(d).toMatchObject({ action: 'fail', runAfter: null })
    expect(d.message).toBe('Claude tidak menjawab dalam 5 menit. Gagal setelah 3 kali percobaan.')
  })

  it('kesalahan yang tidak bisa dicoba lagi langsung gagal, result ikut', () => {
    const d = decide(new JobError('AI belum diatur. Pilih provider di file .env lalu mulai ulang worker.', { retryable: false, result: { ok: false } }), 1, false, now)
    expect(d).toMatchObject({ action: 'fail', message: 'AI belum diatur. Pilih provider di file .env lalu mulai ulang worker.', result: { ok: false } })
  })

  it('batas pemakaian: diantrekan sampai reset tanpa memakai jatah', () => {
    const reset = new Date('2026-10-12T11:35:00Z')
    const d = decide(new UsageLimitError(reset, 'Claude'), 2, false, now)
    expect(d).toMatchObject({ action: 'requeue', refund: true })
    expect(d.runAfter).toEqual(new Date(reset.getTime() + 60_000))
    expect(d.message).toBe('Batas pemakaian Claude sedang tercapai. Job dijalankan lagi sekitar pukul 18.36 WIB.')
  })

  it('batas pemakaian tanpa waktu reset: 30 menit lagi', () => {
    const d = decide(new UsageLimitError(null, 'Claude'), 1, false, now)
    expect(d.runAfter).toEqual(new Date(now.getTime() + 30 * 60_000))
    expect(d.refund).toBe(true)
  })

  it('waktu reset yang sudah lewat atau terlalu jauh diganti 30 menit', () => {
    expect(decide(new UsageLimitError(new Date(now.getTime() - 1000), 'Claude'), 1, false, now).runAfter).toEqual(new Date(now.getTime() + 30 * 60_000))
    expect(decide(new UsageLimitError(new Date(now.getTime() + 30 * 86400000), 'Claude'), 1, false, now).runAfter).toEqual(new Date(now.getTime() + 30 * 60_000))
  })

  it('reset hari lain menyebut tanggalnya', () => {
    const d = decide(new UsageLimitError(new Date('2026-10-13T02:00:00Z'), 'Claude'), 1, false, now)
    expect(d.message).toBe('Batas pemakaian Claude sedang tercapai. Job dijalankan lagi sekitar 13 Oktober 2026 pukul 09.01 WIB.')
  })

  it('penundaan dan penghentian worker tidak memakai jatah', () => {
    const at = new Date('2026-10-14T17:00:00Z')
    expect(decide(new PostponeError(at, 'Penghapusan dijadwalkan 15 Oktober 2026.'), 1, false, now)).toMatchObject({ action: 'requeue', runAfter: at, refund: true })
    expect(decide(abortError(), 1, true, now)).toMatchObject({ action: 'requeue', runAfter: now, refund: true })
  })

  it('kesalahan tak terduga: pesan umum dengan kode rujukan, tanpa isi kesalahan asli', () => {
    const d = decide(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=rahasia'), 1, false, now)
    expect(d.action).toBe('retry')
    expect(d.ref).toMatch(/^W-[0-9A-F]{6}$/)
    expect(d.message).toContain(d.ref!)
    expect(d.message).not.toMatch(/ECONNREFUSED|rahasia/)
  })

  it('pesan tanpa em dash atau en dash', () => {
    for (const e of [new JobError('a'), new UsageLimitError(null, 'Claude'), new Error('x')]) {
      expect(decide(e, 1, false, now).message).not.toMatch(/[\u2013\u2014]/)
    }
  })
})
