/**
 * Pembersih gambar tanpa dependensi: membuang EXIF/XMP/komentar (lokasi GPS, nama perangkat) dan
 * memastikan struktur berkas masuk akal. Mengembalikan null bila berkas rusak atau mencurigakan,
 * sehingga unggahan ditolak. Tidak ada SVG: hanya JPEG, PNG, dan WebP yang dikenal.
 */

export function cleanJpeg(buf: Buffer): Buffer | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null
  const out: Buffer[] = [buf.subarray(0, 2)]
  let i = 2
  let sawScan = false
  while (i + 2 <= buf.length) {
    if (buf[i] !== 0xff) return null
    let marker = buf[i + 1]!
    while (marker === 0xff && i + 2 < buf.length) {
      i++
      marker = buf[i + 1]!
    }
    if (marker === 0xd9) {
      out.push(buf.subarray(i, i + 2))
      return sawScan ? Buffer.concat(out) : null
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      out.push(buf.subarray(i, i + 2))
      i += 2
      continue
    }
    if (i + 4 > buf.length) return null
    const len = buf.readUInt16BE(i + 2)
    if (len < 2 || i + 2 + len > buf.length) return null
    const seg = buf.subarray(i, i + 2 + len)
    // APP1 (EXIF/XMP), APP2 (ICC, FlashPix), APP12 sampai APP15 dan COM dibuang. APP0 (JFIF) dan APP14 (Adobe) dipertahankan.
    const drop = marker === 0xe1 || marker === 0xe2 || (marker >= 0xec && marker <= 0xef && marker !== 0xee) || marker === 0xfe
    if (!drop) out.push(seg)
    i += 2 + len
    if (marker === 0xda) {
      // Data pemindaian sampai penanda berikutnya yang bukan RST atau 0x00.
      sawScan = true
      let j = i
      while (j + 1 < buf.length) {
        if (buf[j] === 0xff && buf[j + 1] !== 0x00 && !(buf[j + 1]! >= 0xd0 && buf[j + 1]! <= 0xd7)) break
        j++
      }
      out.push(buf.subarray(i, j))
      i = j
    }
  }
  return null
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME', 'iCCP'])

export function cleanPng(buf: Buffer): Buffer | null {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIG)) return null
  const out: Buffer[] = [buf.subarray(0, 8)]
  let i = 8
  let first = true
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i)
    const type = buf.subarray(i + 4, i + 8).toString('latin1')
    if (len > buf.length || i + 12 + len > buf.length) return null
    if (first && type !== 'IHDR') return null
    first = false
    if (!PNG_DROP.has(type)) out.push(buf.subarray(i, i + 12 + len))
    i += 12 + len
    if (type === 'IEND') return Buffer.concat(out)
  }
  return null
}

export function cleanWebp(buf: Buffer): Buffer | null {
  if (buf.length < 20 || buf.subarray(0, 4).toString('latin1') !== 'RIFF' || buf.subarray(8, 12).toString('latin1') !== 'WEBP') return null
  const end = buf.readUInt32LE(4) + 8
  if (end > buf.length) return null
  const chunks: Buffer[] = []
  let i = 12
  while (i + 8 <= end) {
    const type = buf.subarray(i, i + 4).toString('latin1')
    const len = buf.readUInt32LE(i + 4)
    if (i + 8 + len > end) return null
    const total = 8 + len + (len % 2)
    if (type !== 'EXIF' && type !== 'XMP ') chunks.push(buf.subarray(i, Math.min(i + total, end)))
    i += total
  }
  if (chunks.length === 0) return null
  const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), ...chunks])
  const head = Buffer.alloc(8)
  head.write('RIFF', 0, 'latin1')
  head.writeUInt32LE(body.length, 4)
  return Buffer.concat([head, body])
}

/** Bersihkan sesuai jenis. Null berarti berkas ditolak. */
export function cleanImage(mime: string, buf: Buffer): Buffer | null {
  if (mime === 'image/jpeg') return cleanJpeg(buf)
  if (mime === 'image/png') return cleanPng(buf)
  if (mime === 'image/webp') return cleanWebp(buf)
  return null
}
