/**
 * Buang metadata dari foto sebelum dikirim ke AI (ADR 0004: foto jawaban tanpa EXIF).
 * Foto HP menyimpan lokasi GPS, jam, dan merek perangkat di EXIF; data piksel tidak diubah.
 * - JPEG: segmen APP1 (EXIF dan XMP), APP13 (IPTC), dan COM dibuang.
 * - PNG: chunk eXIf, tEXt, iTXt, zTXt, dan tIME dibuang.
 * - WebP: chunk EXIF dan "XMP " dibuang, bendera di VP8X dibersihkan.
 * Mengembalikan null bila struktur berkas rusak, supaya pemanggil tidak mengirim berkas mentah.
 */
export function stripImageMetadata(buf: Buffer, mime: string): Buffer | null {
  if (mime === 'image/jpeg') return stripJpeg(buf)
  if (mime === 'image/png') return stripPng(buf)
  if (mime === 'image/webp') return stripWebp(buf)
  if (mime === 'image/gif') return buf
  return null
}

function stripJpeg(buf: Buffer): Buffer | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null
  const out: Buffer[] = [buf.subarray(0, 2)]
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null
    let j = i + 1
    while (j < buf.length && buf[j] === 0xff) j++ // byte pengisi
    if (j >= buf.length) return null
    const marker = buf[j]!
    if (marker === 0xda || marker === 0xd9) {
      // Start of scan atau end of image: sisa berkas adalah data gambar.
      out.push(buf.subarray(j - 1))
      return Buffer.concat(out)
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(buf.subarray(j - 1, j + 1))
      i = j + 1
      continue
    }
    if (j + 3 > buf.length) return null
    const len = buf.readUInt16BE(j + 1)
    const end = j + 1 + len
    if (len < 2 || end > buf.length) return null
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe
    if (!drop) out.push(buf.subarray(j - 1, end))
    i = end
  }
  return null
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PNG_DROP = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME'])

function stripPng(buf: Buffer): Buffer | null {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) return null
  const out: Buffer[] = [PNG_SIG]
  let i = 8
  while (i < buf.length) {
    if (i + 12 > buf.length) return null
    const len = buf.readUInt32BE(i)
    const type = buf.subarray(i + 4, i + 8).toString('latin1')
    const end = i + 12 + len
    if (end > buf.length) return null
    if (!PNG_DROP.has(type)) out.push(buf.subarray(i, end))
    i = end
    if (type === 'IEND') return Buffer.concat(out)
  }
  return null
}

function stripWebp(buf: Buffer): Buffer | null {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return null
  const chunks: Buffer[] = []
  let i = 12
  while (i < buf.length) {
    if (i + 8 > buf.length) return null
    const fourcc = buf.toString('latin1', i, i + 4)
    const size = buf.readUInt32LE(i + 4)
    const end = i + 8 + size + (size % 2)
    if (i + 8 + size > buf.length) return null
    if (fourcc !== 'EXIF' && fourcc !== 'XMP ') {
      const chunk = Buffer.from(buf.subarray(i, Math.min(end, buf.length)))
      if (fourcc === 'VP8X' && size >= 1) chunk[8] = chunk[8]! & ~(0x08 | 0x04)
      chunks.push(chunk)
    }
    i = end
  }
  const body = Buffer.concat(chunks)
  const header = Buffer.alloc(12)
  header.write('RIFF', 0, 'latin1')
  header.writeUInt32LE(body.length + 4, 4)
  header.write('WEBP', 8, 'latin1')
  return Buffer.concat([header, body])
}
