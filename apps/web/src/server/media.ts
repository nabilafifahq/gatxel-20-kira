import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, normalize, sep } from 'node:path'
import { env } from './env'

/**
 * Berkas (rekaman, gambar, PDF) disimpan di KIRA_DATA_DIR/media/<org>/<yyyy-mm>/<uuid>.<ext>.
 * Jenis berkas dicek dari byte awal, bukan dari nama atau header yang dikirim browser.
 */
export type MediaKind = 'audio' | 'image' | 'drawing' | 'pdf' | 'page' | 'figure'

const LIMITS: Record<MediaKind, number> = { audio: 10 * 1024 * 1024, image: 8 * 1024 * 1024, drawing: 6 * 1024 * 1024, pdf: 60 * 1024 * 1024, page: 8 * 1024 * 1024, figure: 8 * 1024 * 1024 }

export function sniff(buf: Buffer): { mime: string; ext: string } | null {
  const ascii = (a: number, b: number) => buf.subarray(a, b).toString('latin1')
  if (buf.length < 12) return null
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { mime: 'audio/webm', ext: 'webm' }
  if (ascii(0, 4) === 'OggS') return { mime: 'audio/ogg', ext: 'ogg' }
  // ftyp: hanya merek audio MP4/M4A. HEIC/HEIF dan video ditolak.
  if (ascii(4, 8) === 'ftyp') return /^(M4A |M4B |M4P |mp42|isom|iso2)$/.test(ascii(8, 12)) ? { mime: 'audio/mp4', ext: 'm4a' } : null
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return { mime: 'audio/wav', ext: 'wav' }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' }
  if (buf[0] === 0x89 && ascii(1, 4) === 'PNG') return { mime: 'image/png', ext: 'png' }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (ascii(0, 5) === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' }
  return null
}

export function allowedFor(kind: MediaKind, mime: string): boolean {
  if (kind === 'audio') return mime.startsWith('audio/')
  if (kind === 'pdf') return mime === 'application/pdf'
  return mime.startsWith('image/')
}

export function limitFor(kind: MediaKind, role: 'tutor' | 'guardian' | 'learner' = 'tutor'): number {
  // Anak tidak perlu berkas besar: rekaman 2 menit sekitar 1 MB, foto jawaban dikecilkan di tablet.
  if (role === 'learner') return Math.min(LIMITS[kind], kind === 'audio' ? 5 * 1024 * 1024 : kind === 'drawing' ? 3 * 1024 * 1024 : 6 * 1024 * 1024)
  return LIMITS[kind]
}

/** Jatah unggah dalam 24 jam terakhir. Anak: 40 berkas atau 60 MB. Dewasa: 300 berkas atau 800 MB. */
export function dailyQuota(role: 'tutor' | 'guardian' | 'learner'): { files: number; bytes: number } {
  return role === 'learner' ? { files: 40, bytes: 60 * 1024 * 1024 } : { files: 300, bytes: 800 * 1024 * 1024 }
}

function root(): string {
  return join(env().KIRA_DATA_DIR, 'media')
}

export async function storeFile(orgId: string, buf: Buffer, ext: string): Promise<{ path: string; sha256: string }> {
  const now = new Date()
  const rel = join(orgId, `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`, `${randomUUID()}.${ext}`)
  const abs = join(root(), rel)
  await mkdir(join(abs, '..'), { recursive: true, mode: 0o700 })
  await writeFile(abs, buf, { mode: 0o600 })
  return { path: rel, sha256: createHash('sha256').update(buf).digest('hex') }
}

function safeAbs(rel: string): string {
  const abs = normalize(join(root(), rel))
  if (!abs.startsWith(root() + sep)) throw new Error('Path media tidak valid')
  return abs
}

export async function readStored(rel: string): Promise<Buffer> {
  return readFile(safeAbs(rel))
}

export async function deleteStored(rel: string): Promise<void> {
  await rm(safeAbs(rel), { force: true })
}
