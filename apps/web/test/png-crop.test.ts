import { crc32, deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { cropPngFraction, decodePng, encodePng, MIN_CROP_SIDE, pngInfo, PngError } from '@/server/png-crop'

/** Gambar RGB 120x80 dengan warna yang bergantung pada posisi, supaya potongan bisa dicocokkan piksel demi piksel. */
function sample(width = 120, height = 80): { png: Buffer; pixels: Buffer } {
  const pixels = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3
      pixels[i] = (x * 4) & 0xff
      pixels[i + 1] = (y * 6) & 0xff
      pixels[i + 2] = (x + y) & 0xff
    }
  }
  return { png: encodePng(pixels, width, height, 2), pixels }
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** PNG yang ditulis dengan filter 1 sampai 4 bergantian, seperti hasil pdftoppm, untuk menguji pembuka filter. */
function filteredPng(pixels: Buffer, width: number, height: number): Buffer {
  const bpp = 3
  const stride = width * bpp
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    const filter = (y % 4) + 1
    raw[y * (stride + 1)] = filter
    for (let x = 0; x < stride; x++) {
      const v = pixels[y * stride + x]!
      const a = x >= bpp ? pixels[y * stride + x - bpp]! : 0
      const b = y > 0 ? pixels[(y - 1) * stride + x]! : 0
      const c = x >= bpp && y > 0 ? pixels[(y - 1) * stride + x - bpp]! : 0
      const pred = filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : paeth(a, b, c)
      raw[y * (stride + 1) + 1 + x] = (v - pred) & 0xff
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8)
    head.writeUInt32BE(data.length, 0)
    head.write(type, 4, 'latin1')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0)
    return Buffer.concat([head, data, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

describe('png-crop', () => {
  it('menulis dan membaca PNG dengan piksel yang sama', () => {
    const { png, pixels } = sample()
    expect(pngInfo(png)).toEqual({ width: 120, height: 80 })
    const d = decodePng(png)
    expect(d.colorType).toBe(2)
    expect(d.pixels.equals(pixels)).toBe(true)
  })

  it('membuka semua jenis filter baris (sub, up, average, paeth)', () => {
    const { pixels } = sample()
    expect(decodePng(filteredPng(pixels, 120, 80)).pixels.equals(pixels)).toBe(true)
  })

  it('memotong sesuai kotak pecahan dan piksel hasilnya sama dengan sumber', () => {
    const { png, pixels } = sample()
    const r = cropPngFraction(png, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 })
    expect(r.width).toBe(60)
    expect(r.height).toBe(40)
    const out = decodePng(r.png)
    expect(out.width).toBe(60)
    for (let y = 0; y < 40; y++) {
      const src = ((20 + y) * 120 + 30) * 3
      expect(out.pixels.subarray(y * 60 * 3, (y + 1) * 60 * 3).equals(pixels.subarray(src, src + 60 * 3))).toBe(true)
    }
  })

  it('kotak yang melewati tepi dipaskan ke gambar', () => {
    const { png } = sample()
    const r = cropPngFraction(png, { x: 0.5, y: 0.5, w: 1, h: 1 })
    expect(r.width).toBe(60)
    expect(r.height).toBe(40)
  })

  it('kotak terlalu kecil, nilai tidak valid, atau berkas bukan PNG ditolak dengan pesan jelas', () => {
    const { png } = sample()
    expect(() => cropPngFraction(png, { x: 0, y: 0, w: 0.1, h: 0.1 })).toThrow(PngError)
    expect(() => cropPngFraction(png, { x: Number.NaN, y: 0, w: 1, h: 1 })).toThrow(/tidak valid/)
    expect(() => cropPngFraction(Buffer.from('bukan png sama sekali, hanya teks biasa'), { x: 0, y: 0, w: 1, h: 1 })).toThrow(/bukan PNG/)
    expect(MIN_CROP_SIDE).toBeGreaterThan(8)
  })

  it('PNG terpotong atau berinterlace ditolak', () => {
    const { png } = sample()
    expect(() => decodePng(png.subarray(0, png.length - 20))).toThrow(PngError)
    const inter = Buffer.from(png)
    inter[8 + 8 + 12] = 1 // byte interlace di IHDR
    expect(() => pngInfo(inter)).toThrow(/interlace/)
  })

  it('palet dan abu-abu ikut terbawa', () => {
    const w = 40
    const h = 30
    const idx = Buffer.alloc(w * h)
    for (let i = 0; i < idx.length; i++) idx[i] = i % 3
    const plte = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255])
    const png = encodePng(idx, w, h, 3, [{ type: 'PLTE', data: plte }])
    const r = cropPngFraction(png, { x: 0, y: 0, w: 1, h: 1 })
    expect(decodePng(r.png).extra.map((c) => c.type)).toEqual(['PLTE'])
    const gray = encodePng(Buffer.alloc(w * h, 200), w, h, 0)
    expect(decodePng(cropPngFraction(gray, { x: 0, y: 0, w: 1, h: 1 }).png).colorType).toBe(0)
  })
})
