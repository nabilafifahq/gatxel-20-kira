import { crc32, deflateSync, inflateSync } from 'node:zlib'

/**
 * Potong gambar halaman PDF (PNG hasil pdftoppm) tanpa pustaka gambar: PNG dibaca dengan zlib bawaan Node,
 * baris dibuka filternya, dipotong, lalu ditulis ulang tanpa filter. Mendukung PNG 8 bit tanpa interlace
 * (skala abu-abu, RGB, palet, abu-abu+alfa, RGBA), yaitu yang dihasilkan pdftoppm. Selain itu ditolak dengan pesan jelas.
 */

export type CropRect = { x: number; y: number; w: number; h: number }
export type PngInfo = { width: number; height: number }

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
/** Sisi terkecil potongan (piksel); lebih kecil dari ini dianggap salah pilih. */
export const MIN_CROP_SIDE = 16
/** Batas piksel hasil potongan, supaya berkas tetap kecil. */
export const MAX_CROP_PIXELS = 6_000_000

export class PngError extends Error {
  override name = 'PngError'
}

type Chunk = { type: string; data: Buffer }

function readChunks(buf: Buffer): Chunk[] {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new PngError('Berkas bukan PNG yang utuh.')
  const chunks: Chunk[] = []
  let p = 8
  while (p + 12 <= buf.length) {
    const len = buf.readUInt32BE(p)
    const type = buf.toString('latin1', p + 4, p + 8)
    if (p + 12 + len > buf.length) throw new PngError('Berkas PNG terpotong.')
    chunks.push({ type, data: buf.subarray(p + 8, p + 8 + len) })
    p += 12 + len
    if (type === 'IEND') break
  }
  if (!chunks.some((c) => c.type === 'IEND')) throw new PngError('Berkas PNG terpotong.')
  return chunks
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }

function parseHeader(chunks: Chunk[]): { width: number; height: number; colorType: number; bpp: number } {
  const ihdr = chunks[0]
  if (!ihdr || ihdr.type !== 'IHDR' || ihdr.data.length !== 13) throw new PngError('Header PNG rusak.')
  const width = ihdr.data.readUInt32BE(0)
  const height = ihdr.data.readUInt32BE(4)
  const depth = ihdr.data[8]!
  const colorType = ihdr.data[9]!
  const interlace = ihdr.data[12]!
  const channels = CHANNELS[colorType]
  if (depth !== 8 || channels === undefined) throw new PngError('Format PNG ini belum didukung (hanya 8 bit per kanal).')
  if (interlace !== 0) throw new PngError('PNG berinterlace belum didukung.')
  if (width < 1 || height < 1 || width * height > 80_000_000) throw new PngError('Ukuran gambar tidak masuk akal.')
  return { width, height, colorType, bpp: channels }
}

export function pngInfo(buf: Buffer): PngInfo {
  const { width, height } = parseHeader(readChunks(buf))
  return { width, height }
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** Buka filter semua baris. Hasilnya piksel mentah: height x (width * bpp). */
function unfilter(raw: Buffer, width: number, height: number, bpp: number): Buffer {
  const stride = width * bpp
  if (raw.length !== height * (stride + 1)) throw new PngError('Data piksel PNG tidak lengkap.')
  const out = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!
    const src = y * (stride + 1) + 1
    const dst = y * stride
    const prev = dst - stride
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x]!
      const a = x >= bpp ? out[dst + x - bpp]! : 0
      const b = y > 0 ? out[prev + x]! : 0
      const c = x >= bpp && y > 0 ? out[prev + x - bpp]! : 0
      let r: number
      switch (filter) {
        case 0: r = v; break
        case 1: r = v + a; break
        case 2: r = v + b; break
        case 3: r = v + ((a + b) >> 1); break
        case 4: r = v + paeth(a, b, c); break
        default: throw new PngError('Filter PNG tidak dikenal.')
      }
      out[dst + x] = r & 0xff
    }
  }
  return out
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'latin1')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0)
  return Buffer.concat([head, data, crc])
}

/** Tulis PNG 8 bit tanpa interlace dari piksel mentah. `extra` = chunk tambahan (PLTE, tRNS) yang ditulis sebelum IDAT. */
export function encodePng(pixels: Buffer, width: number, height: number, colorType: number, extra: Chunk[] = []): Buffer {
  const bpp = CHANNELS[colorType]
  if (bpp === undefined) throw new PngError('Jenis warna PNG tidak dikenal.')
  const stride = width * bpp
  if (pixels.length !== stride * height) throw new PngError('Jumlah piksel tidak cocok dengan ukuran.')
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = colorType
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), ...extra.map((c) => chunk(c.type, c.data)), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

/** Piksel mentah dan keterangan warna dari PNG, untuk tes dan pemotongan. */
export function decodePng(buf: Buffer): { width: number; height: number; colorType: number; pixels: Buffer; extra: Chunk[] } {
  const chunks = readChunks(buf)
  const { width, height, colorType, bpp } = parseHeader(chunks)
  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data))
  let raw: Buffer
  try {
    raw = inflateSync(idat)
  } catch {
    throw new PngError('Data piksel PNG rusak.')
  }
  const extra = chunks.filter((c) => c.type === 'PLTE' || c.type === 'tRNS')
  if (colorType === 3 && !extra.some((c) => c.type === 'PLTE')) throw new PngError('Palet warna PNG tidak ada.')
  return { width, height, colorType, pixels: unfilter(raw, width, height, bpp), extra }
}

/**
 * Potong PNG dengan kotak dalam pecahan 0 sampai 1 dari lebar dan tinggi gambar (kiri, atas, lebar, tinggi).
 * Kotak dipaskan ke batas gambar. Hasilnya PNG baru.
 */
export function cropPngFraction(buf: Buffer, rect: CropRect): { png: Buffer; width: number; height: number } {
  const { width, height, colorType, pixels, extra } = decodePng(buf)
  const nums = [rect.x, rect.y, rect.w, rect.h]
  if (nums.some((n) => !Number.isFinite(n))) throw new PngError('Kotak potong tidak valid.')
  const x0 = Math.max(0, Math.min(width - 1, Math.round(rect.x * width)))
  const y0 = Math.max(0, Math.min(height - 1, Math.round(rect.y * height)))
  const x1 = Math.max(x0 + 1, Math.min(width, Math.round((rect.x + rect.w) * width)))
  const y1 = Math.max(y0 + 1, Math.min(height, Math.round((rect.y + rect.h) * height)))
  const w = x1 - x0
  const h = y1 - y0
  if (w < MIN_CROP_SIDE || h < MIN_CROP_SIDE) throw new PngError('Kotak potong terlalu kecil. Tarik kotak yang menutup seluruh gambar soal.')
  if (w * h > MAX_CROP_PIXELS) throw new PngError('Kotak potong terlalu besar untuk satu gambar soal.')
  const bpp = CHANNELS[colorType]!
  const out = Buffer.alloc(w * h * bpp)
  for (let y = 0; y < h; y++) pixels.copy(out, y * w * bpp, ((y0 + y) * width + x0) * bpp, ((y0 + y) * width + x1) * bpp)
  return { png: encodePng(out, w, h, colorType, extra), width: w, height: h }
}
