import { describe, expect, it } from 'vitest'
import { deflateSync } from 'node:zlib'
import { stripImageMetadata } from '../src/images'

function seg(marker: number, payload: Buffer): Buffer {
  const head = Buffer.alloc(4)
  head[0] = 0xff
  head[1] = marker
  head.writeUInt16BE(payload.length + 2, 2)
  return Buffer.concat([head, payload])
}

describe('stripImageMetadata', () => {
  it('JPEG: APP1 EXIF (GPS) dan COM dibuang, APP0 dan data gambar tetap', () => {
    const soi = Buffer.from([0xff, 0xd8])
    const app0 = seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1'))
    const exif = seg(0xe1, Buffer.from('Exif\0\0GPS-6.97,112.63', 'latin1'))
    const com = seg(0xfe, Buffer.from('Kamera HP Mama', 'latin1'))
    const dqt = seg(0xdb, Buffer.alloc(65, 1))
    const sos = Buffer.concat([seg(0xda, Buffer.alloc(10, 2)), Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56]), Buffer.from([0xff, 0xd9])])
    const out = stripImageMetadata(Buffer.concat([soi, app0, exif, com, dqt, sos]), 'image/jpeg')!
    expect(out).toEqual(Buffer.concat([soi, app0, dqt, sos]))
    expect(out.toString('latin1')).not.toMatch(/GPS|Kamera/)
  })

  it('JPEG rusak: null, berkas mentah tidak dikirim', () => {
    expect(stripImageMetadata(Buffer.from([0xff, 0xd8, 0x00, 0x01]), 'image/jpeg')).toBeNull()
    expect(stripImageMetadata(Buffer.from('bukan gambar'), 'image/jpeg')).toBeNull()
  })

  it('PNG: chunk tEXt dan eXIf dibuang', () => {
    const chunk = (type: string, data: Buffer) => {
      const len = Buffer.alloc(4)
      len.writeUInt32BE(data.length)
      return Buffer.concat([len, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)])
    }
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const ihdr = chunk('IHDR', Buffer.alloc(13))
    const text = chunk('tEXt', Buffer.from('Author\0Mama', 'latin1'))
    const exif = chunk('eXIf', Buffer.from('GPS', 'latin1'))
    const idat = chunk('IDAT', deflateSync(Buffer.alloc(4)))
    const iend = chunk('IEND', Buffer.alloc(0))
    const out = stripImageMetadata(Buffer.concat([sig, ihdr, text, exif, idat, iend]), 'image/png')!
    expect(out).toEqual(Buffer.concat([sig, ihdr, idat, iend]))
  })

  it('WebP: chunk EXIF dibuang, bendera VP8X dibersihkan, ukuran RIFF diperbarui', () => {
    const chunk = (fourcc: string, data: Buffer) => {
      const head = Buffer.alloc(8)
      head.write(fourcc, 0, 'latin1')
      head.writeUInt32LE(data.length, 4)
      return Buffer.concat([head, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)])
    }
    const vp8x = Buffer.alloc(10)
    vp8x[0] = 0x08 | 0x04 | 0x10
    const body = Buffer.concat([chunk('VP8X', vp8x), chunk('VP8 ', Buffer.alloc(6, 7)), chunk('EXIF', Buffer.from('GPS-lokasi', 'latin1')), chunk('XMP ', Buffer.from('<x/>', 'latin1'))])
    const riff = Buffer.alloc(12)
    riff.write('RIFF', 0, 'latin1')
    riff.writeUInt32LE(body.length + 4, 4)
    riff.write('WEBP', 8, 'latin1')
    const out = stripImageMetadata(Buffer.concat([riff, body]), 'image/webp')!
    expect(out.toString('latin1')).not.toMatch(/EXIF|GPS|XMP/)
    expect(out.readUInt32LE(4)).toBe(out.length - 8)
    expect(out[20]! & 0x0c).toBe(0)
    expect(out[20]! & 0x10).toBe(0x10)
  })

  it('jenis lain ditolak', () => {
    expect(stripImageMetadata(Buffer.from('x'), 'image/svg+xml')).toBeNull()
  })
})
