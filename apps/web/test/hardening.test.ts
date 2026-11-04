import { describe, expect, it } from 'vitest'
import { httpsRedirectTarget, viaCloudflare, visitorScheme } from '@/lib/https-redirect'
import { cleanJpeg, cleanPng, cleanWebp } from '@/lib/image-clean'
import { pickClientIp } from '@/server/auth/ratelimit'

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null })

describe('pickClientIp', () => {
  it('memakai CF-Connecting-IP dan mengabaikan X-Forwarded-For palsu', () => {
    expect(pickClientIp(h({ 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('203.0.113.9')
  })
  it('tanpa Cloudflare memakai entri terakhir X-Forwarded-For, bukan yang pertama', () => {
    expect(pickClientIp(h({ 'x-forwarded-for': '6.6.6.6, 172.18.0.2' }))).toBe('172.18.0.2')
  })
  it('menolak nilai yang bukan alamat IP', () => {
    expect(pickClientIp(h({ 'cf-connecting-ip': '<script>', 'x-forwarded-for': 'abc def' }))).toBeNull()
  })
})

describe('pengalihan https', () => {
  it('mengalihkan http di balik Cloudflare ke https', () => {
    expect(httpsRedirectTarget(h({ 'x-forwarded-proto': 'http', 'cf-ray': 'x', host: 'kira.gatxel.com' }), '/masuk?x=1', true)).toBe('https://kira.gatxel.com/masuk?x=1')
  })
  it('CF-Visitor https menang atas X-Forwarded-Proto http dari proxy tengah (tanpa loop)', () => {
    expect(httpsRedirectTarget(h({ 'x-forwarded-proto': 'http', 'cf-visitor': '{"scheme":"https"}', host: 'kira.gatxel.com' }), '/', true)).toBeNull()
  })
  it('tidak mengalihkan permintaan tanpa header Cloudflare (pemeriksaan kesehatan proxy)', () => {
    expect(httpsRedirectTarget(h({ 'x-forwarded-proto': 'http', host: 'kira.gatxel.com' }), '/', true)).toBeNull()
  })
  it('tidak mengalihkan localhost, nama layanan, IP, atau non-produksi', () => {
    for (const host of ['localhost:3000', 'web:3000', '127.0.0.1:3000', '192.168.1.5'])
      expect(httpsRedirectTarget(h({ 'x-forwarded-proto': 'http', host }), '/', true)).toBeNull()
    expect(httpsRedirectTarget(h({ 'x-forwarded-proto': 'http', 'cf-ray': 'x', host: 'kira.gatxel.com' }), '/', false)).toBeNull()
  })
  it('tidak bisa dipakai sebagai open redirect lewat path //', () => {
    expect(httpsRedirectTarget(h({ 'x-forwarded-proto': 'http', 'cf-ray': 'x', host: 'kira.gatxel.com' }), '//evil.com', true)).toBe('https://kira.gatxel.com/')
  })
  it('KIRA_ORIGIN https menang atas Host palsu', () => {
    expect(httpsRedirectTarget(h({ 'x-forwarded-proto': 'http', 'cf-ray': 'x', host: 'evil.example.com' }), '/masuk', true, 'https://kira.gatxel.com')).toBe('https://kira.gatxel.com/masuk')
  })
  it('menolak host dengan karakter aneh', () => {
    expect(httpsRedirectTarget(h({ 'x-forwarded-proto': 'http', 'cf-ray': 'x', host: 'evil.com/@x' }), '/', true)).toBeNull()
  })
  it('visitorScheme dan viaCloudflare', () => {
    expect(visitorScheme(h({}))).toBeNull()
    expect(viaCloudflare(h({ 'cf-ray': 'abc' }))).toBe(true)
    expect(viaCloudflare(h({ host: 'web' }))).toBe(false)
  })
})

describe('pembersih gambar', () => {
  it('JPEG: membuang segmen EXIF, mempertahankan data piksel', () => {
    const exif = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 0x0c]), Buffer.from('Exif\0\0GPS!')])
    const jfif = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46])
    const sos = Buffer.from([0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0x11, 0x22, 0x33])
    const src = Buffer.concat([Buffer.from([0xff, 0xd8]), jfif, exif, sos, Buffer.from([0xff, 0xd9])])
    const out = cleanJpeg(src)!
    expect(out.includes(Buffer.from('GPS!'))).toBe(false)
    expect(out.includes(Buffer.from([0x11, 0x22, 0x33]))).toBe(true)
    expect(out.length).toBeLessThan(src.length)
  })
  it('JPEG rusak ditolak', () => {
    expect(cleanJpeg(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x7f, 0xff, 0x00]))).toBeNull()
  })
  it('PNG: membuang eXIf dan tEXt', () => {
    const chunk = (t: string, d: Buffer) => {
      const len = Buffer.alloc(4)
      len.writeUInt32BE(d.length)
      return Buffer.concat([len, Buffer.from(t, 'latin1'), d, Buffer.alloc(4)])
    }
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const src = Buffer.concat([sig, chunk('IHDR', Buffer.alloc(13)), chunk('tEXt', Buffer.from('Author\0Rahasia')), chunk('IDAT', Buffer.from('xyz')), chunk('IEND', Buffer.alloc(0))])
    const out = cleanPng(src)!
    expect(out.includes(Buffer.from('Rahasia'))).toBe(false)
    expect(out.includes(Buffer.from('IDAT'))).toBe(true)
    expect(cleanPng(src.subarray(0, src.length - 5))).toBeNull()
  })
  it('WebP: membuang chunk EXIF', () => {
    const chunk = (t: string, d: Buffer) => {
      const len = Buffer.alloc(4)
      len.writeUInt32LE(d.length)
      return Buffer.concat([len.length ? Buffer.from(t, 'latin1') : Buffer.alloc(0), len, d, d.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)])
    }
    const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), chunk('VP8 ', Buffer.from('1234')), chunk('EXIF', Buffer.from('LOKASI!!'))])
    const head = Buffer.alloc(8)
    head.write('RIFF', 0, 'latin1')
    head.writeUInt32LE(body.length, 4)
    const out = cleanWebp(Buffer.concat([head, body]))!
    expect(out.includes(Buffer.from('LOKASI'))).toBe(false)
    expect(out.includes(Buffer.from('VP8 '))).toBe(true)
  })
})

import { simpleEmail } from '@/server/dal/outbox'
import { safeNext } from '@/server/auth/actor'

describe('email dan pengalihan', () => {
  it('simpleEmail meng-escape judul, baris, tombol, dan tautan (nama anak berisi HTML)', () => {
    const evil = '<img src=x onerror=alert(1)>"\'&'
    const { html } = simpleEmail({ title: evil, lines: [evil], buttonLabel: evil, buttonUrl: 'https://kira.test/x?a="><script>alert(1)</script>', footer: evil })
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script>')
    expect(html).not.toMatch(/onerror=alert\(1\)>/)
    expect(html).toContain('&lt;img')
  })
  it('safeNext hanya menerima path lokal', () => {
    for (const bad of ['//evil.com', 'https://evil.com', '/' + String.fromCharCode(92) + 'evil.com', 'javascript:alert(1)', 'evil', '/' + 'a'.repeat(400)])
      expect(safeNext(bad, '/ok')).toBe('/ok')
    expect(safeNext('/keluarga?x=1', '/ok')).toBe('/keluarga?x=1')
  })
})
