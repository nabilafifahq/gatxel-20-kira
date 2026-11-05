import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { privacyNoticeData } from '@/server/legal'
import { safePagePath, SUPPORT_CATEGORIES, WHATSAPP_DISPLAY, WHATSAPP_HELP_URL, WHATSAPP_PARTNER_URL } from '@/lib/support'
import { newTicketReference, removeSupportFile, safeAttachmentName, sniffAttachment, storeSupportFile, supportDir } from '@/server/support-file'

const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)])
const jpg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)])
const pdf = () => Buffer.from('%PDF-1.7\n%aaaaaaaaaaaaaaaaaaaaaaaaaaaa')
const mp4 = (brand: string, box = 24) => {
  const b = Buffer.alloc(40)
  b.writeUInt32BE(box, 0)
  b.write('ftyp', 4, 'latin1')
  b.write(brand, 8, 'latin1')
  return b
}

describe('jenis lampiran dibaca dari byte', () => {
  it('menerima PNG, JPG, PDF, dan MP4 asli', () => {
    expect(sniffAttachment(png())?.mime).toBe('image/png')
    expect(sniffAttachment(jpg())?.mime).toBe('image/jpeg')
    expect(sniffAttachment(pdf())?.mime).toBe('application/pdf')
    expect(sniffAttachment(mp4('isom'))?.mime).toBe('video/mp4')
    expect(sniffAttachment(mp4('mp42'))?.ext).toBe('mp4')
  })

  it('menolak berkas lain walau namanya meyakinkan', () => {
    expect(sniffAttachment(Buffer.from('ini sebenarnya teks biasa, bukan gambar sama sekali'))).toBeNull()
    expect(sniffAttachment(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull()
    expect(sniffAttachment(Buffer.from('<!doctype html><script>alert(1)</script>'))).toBeNull()
    expect(sniffAttachment(Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff'))).toBeNull()
    expect(sniffAttachment(Buffer.from('PK\x03\x04aaaaaaaaaaaaaaaaaaaa'))).toBeNull()
  })

  it('tanda tangan PNG harus lengkap delapan byte', () => {
    expect(sniffAttachment(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(32)]))).toBeNull()
  })

  it('HEIC, M4A, dan kotak ftyp yang rusak ditolak', () => {
    expect(sniffAttachment(mp4('heic'))).toBeNull()
    expect(sniffAttachment(mp4('M4A '))).toBeNull()
    expect(sniffAttachment(mp4('isom', 1_000_000))).toBeNull()
    expect(sniffAttachment(mp4('isom', 4))).toBeNull()
  })

  it('berkas terlalu pendek ditolak', () => {
    expect(sniffAttachment(Buffer.from([0x89, 0x50]))).toBeNull()
    expect(sniffAttachment(Buffer.alloc(0))).toBeNull()
  })
})

describe('nama lampiran', () => {
  it('membuang path, karakter header, dan mengikuti jenis asli', () => {
    expect(safeAttachmentName('../../etc/passwd.png', 'png')).toBe('passwd.png')
    expect(safeAttachmentName('C:\\Users\\x\\foto.PNG', 'png')).toBe('foto.png')
    expect(safeAttachmentName('foto\r\nContent-Type: image.png', 'png')).toBe('foto Content-Type image.png')
    expect(safeAttachmentName('virus.exe', 'pdf')).toBe('virus.pdf')
    expect(safeAttachmentName('', 'jpg')).toBe('lampiran.jpg')
    expect(safeAttachmentName(null, 'mp4')).toBe('lampiran.mp4')
    expect(safeAttachmentName(`${'a'.repeat(300)}.png`, 'png').length).toBeLessThanOrEqual(104)
  })
})

describe('nomor referensi', () => {
  it('berbentuk KR dan delapan karakter, tanpa huruf yang mudah tertukar', () => {
    for (let i = 0; i < 50; i++) expect(newTicketReference()).toMatch(/^KR-[0-9A-HJKMNP-TV-Z]{8}$/)
    expect(new Set(Array.from({ length: 200 }, newTicketReference)).size).toBe(200)
  })
})

describe('penyimpanan lampiran', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kira-support-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('menyimpan di folder support, dan bisa dihapus', async () => {
    const rel = await storeSupportFile(dir, Buffer.from('isi'), 'png', new Date('2026-11-05T00:00:00Z'))
    expect(rel).toMatch(/^2026-11\/[0-9a-f-]{36}\.png$/)
    const abs = join(supportDir(dir), rel)
    expect(readFileSync(abs, 'utf8')).toBe('isi')
    expect(abs).not.toContain('public')
    await removeSupportFile(dir, rel)
    expect(() => statSync(abs)).toThrow()
  })

  it('menolak ekstensi aneh dan path yang keluar dari folder', async () => {
    await expect(storeSupportFile(dir, Buffer.from('x'), '../x')).rejects.toThrow()
    await expect(removeSupportFile(dir, '../../rahasia')).rejects.toThrow()
  })
})

describe('halaman asal', () => {
  it('hanya path Kira, tanpa query, dan token disamarkan', () => {
    expect(safePagePath('/keluarga')).toBe('/keluarga')
    expect(safePagePath('/keluarga/minggu?learner=abc')).toBe('/keluarga/minggu')
    expect(safePagePath('/reset/AbCdEfGhIjKlMnOpQrStUvWxYz012345')).toBe('/reset/[kode]')
    expect(safePagePath('/daftar/konfirmasi/AbCdEfGhIjKlMnOpQrStUvWxYz012345')).toBe('/daftar/konfirmasi/[kode]')
    for (const bad of ['https://evil.test/x', '//evil.test', 'javascript:alert(1)', '/a b', '/<script>', '/\\evil', `/${'a'.repeat(300)}`, null, undefined, '']) expect(safePagePath(bad)).toBe('')
  })
})

describe('WhatsApp dan kategori', () => {
  it('tautan WhatsApp memakai nomor Gatxel dan pesan yang sudah terisi', () => {
    expect(WHATSAPP_HELP_URL.startsWith('https://wa.me/6287794551486?text=')).toBe(true)
    expect(decodeURIComponent(WHATSAPP_HELP_URL.split('text=')[1]!)).toContain('butuh bantuan')
    expect(WHATSAPP_PARTNER_URL.startsWith('https://wa.me/6287794551486?text=')).toBe(true)
    expect(decodeURIComponent(WHATSAPP_PARTNER_URL.split('text=')[1]!)).toContain('bermitra')
    expect(WHATSAPP_DISPLAY).toBe('0877 9455 1486')
  })

  it('lima kategori sesuai permintaan', () => {
    expect(SUPPORT_CATEGORIES.map((c) => c.label)).toEqual(['Masalah atau bug', 'Saran dan perbaikan', 'Koreksi soal atau materi', 'Kemitraan dengan Gatxel', 'Lainnya'])
  })
})

describe('Kebijakan Privasi', () => {
  it('versi naik dan pesan bantuan beserta masa simpannya tercatat', () => {
    const notice = privacyNoticeData()
    expect(notice.meta.version).toBe('2026-11-05.3')
    const rows = notice.dataRows.map((r) => r.data)
    expect(rows).toContain('Pesan bantuan')
    expect(rows).toContain('Lampiran pesan bantuan')
    expect(notice.dataRows.find((r) => r.data === 'Pesan bantuan')?.retention).toContain('12 bulan')
    expect(notice.dataRows.find((r) => r.data === 'Lampiran pesan bantuan')?.retention).toContain('14 hari')
    expect(notice.recipients.some((r) => r.name.startsWith('WhatsApp'))).toBe(true)
    expect(notice.dataRows.find((r) => r.data === 'Email kabar produk (opsional)')?.basis).toMatch(/Persetujuan, bisa ditarik kapan saja/)
  })
})
