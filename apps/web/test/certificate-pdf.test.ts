import { writeFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { dictFor } from '@/lib/i18n'
import { certificatePdf } from '@/server/certificate-pdf'

const stream = (b: Buffer) => b.toString('latin1')

describe('sertifikat PDF', () => {
  it('bintang menghadap ke atas', () => {
    const pdf = stream(certificatePdf({ name: 'Aisha', days: 7, date: '2026-11-05' }))
    const m = /([\d.]+) ([\d.]+) m /.exec(pdf)!
    expect(Number(m[1])).toBe(421)
    expect(Number(m[2])).toBe(508)
  })

  it('judul dan nama benar-benar di tengah halaman', () => {
    const pdf = stream(certificatePdf({ name: 'Aisha', days: 7, date: '2026-11-05' }))
    const title = /BT \/F2 40\.0 Tf [\d. ]+rg ([\d.]+) 385 Td/.exec(pdf)!
    // Lebar "Certificate of achievement" di Helvetica-Bold 40 adalah 497,9: sisi kiri 172,0.
    expect(Number(title[1])).toBeCloseTo(172.0, 0)
  })

  it('nama sangat panjang mengecil dan tetap di dalam bingkai', () => {
    const pdf = stream(certificatePdf({ name: 'W'.repeat(40), days: 7, date: '2026-11-05' }))
    const m = /BT \/F2 ([\d.]+) Tf [\d. ]+rg ([\d.]+) 285 Td/.exec(pdf)!
    expect(Number(m[1])).toBeLessThan(44)
    expect(Number(m[2])).toBeGreaterThanOrEqual(60)
  })

  it('tanggal mudah dibaca di kedua bahasa', () => {
    expect(stream(certificatePdf({ name: 'Aisha', days: 7, date: '2026-11-05' }, dictFor('en').world.certificate))).toContain('Awarded on 5 November 2026')
    expect(stream(certificatePdf({ name: 'Aisha', days: 7, date: '2026-11-05' }, dictFor('id').world.certificate))).toContain('Diberikan pada 5 November 2026')
  })

  it('menulis contoh untuk dilihat bila diminta', () => {
    const out = process.env.KIRA_CERT_SAMPLE
    if (out) {
      writeFileSync(`${out}-en.pdf`, certificatePdf({ name: 'Aisha', days: 7, date: '2026-11-05' }, dictFor('en').world.certificate))
      writeFileSync(`${out}-id.pdf`, certificatePdf({ name: 'Aisha', days: 7, date: '2026-11-05' }, dictFor('id').world.certificate))
    }
    expect(true).toBe(true)
  })
})
