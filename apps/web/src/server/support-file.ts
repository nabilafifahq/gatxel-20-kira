import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, normalize, sep } from 'node:path'

/**
 * Lampiran halaman Bantuan. Jenis berkas ditentukan dari byte awal, tidak pernah dari nama atau tipe kiriman browser.
 * Berkas disimpan di KIRA_DATA_DIR/support/<yyyy-mm>/<uuid>.<ext>, di luar web root dan tanpa alamat publik.
 * Worker melampirkannya ke email lalu menghapusnya.
 */
export type SupportFileType = { mime: 'image/png' | 'image/jpeg' | 'application/pdf' | 'video/mp4'; ext: 'png' | 'jpg' | 'pdf' | 'mp4' }

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
/** Merek MP4 video. HEIC dan M4A sengaja tidak ada di daftar. */
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'M4VH', 'M4VP', 'dash', 'qt  '])

export function sniffAttachment(buf: Buffer): SupportFileType | null {
  if (buf.length < 12) return null
  if (buf.subarray(0, 8).equals(PNG_SIG)) return { mime: 'image/png', ext: 'png' }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (buf.toString('latin1', 0, 5) === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' }
  if (buf.toString('latin1', 4, 8) === 'ftyp' && MP4_BRANDS.has(buf.toString('latin1', 8, 12))) {
    const box = buf.readUInt32BE(0)
    if (box >= 16 && box <= buf.length && box % 4 === 0) return { mime: 'video/mp4', ext: 'mp4' }
  }
  return null
}

/** Nama untuk email: huruf, angka, titik, garis, spasi saja, dan ekstensi mengikuti isi berkas. Tanpa path atau karakter header. */
export function safeAttachmentName(raw: string | null | undefined, ext: SupportFileType['ext']): string {
  const base = (raw ?? '').split(/[\\/]/).pop() ?? ''
  const stem = base
    .replace(/\.[^.]*$/, '')
    .replace(/[^A-Za-z0-9 ._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[ .]+|[ .]+$/g, '')
    .slice(0, 100)
  return `${stem || 'lampiran'}.${ext}`
}

const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Nomor referensi pesan: delapan karakter acak, tanpa huruf yang mudah tertukar. */
export function newTicketReference(): string {
  const bytes = randomBytes(8)
  let out = ''
  for (const b of bytes) out += BASE32[b % 32]
  return `KR-${out}`
}

export function supportDir(dataDir: string): string {
  return normalize(join(dataDir, 'support'))
}

/** Simpan berkas. Path yang dikembalikan relatif terhadap folder support dan memakai garis miring, juga di Windows. */
export async function storeSupportFile(dataDir: string, buf: Buffer, ext: string, now: Date = new Date()): Promise<string> {
  if (!/^[a-z0-9]{1,5}$/.test(ext)) throw new Error('Ekstensi lampiran tidak valid')
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const name = `${randomUUID()}.${ext}`
  const dir = join(supportDir(dataDir), month)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  await writeFile(join(dir, name), buf, { mode: 0o600, flag: 'wx' })
  return `${month}/${name}`
}

export async function removeSupportFile(dataDir: string, rel: string): Promise<void> {
  const abs = normalize(join(supportDir(dataDir), rel))
  if (!abs.startsWith(supportDir(dataDir) + sep)) throw new Error('Path lampiran tidak valid')
  await rm(abs, { force: true })
}
