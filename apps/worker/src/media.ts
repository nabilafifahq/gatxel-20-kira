import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, join, normalize, sep } from 'node:path'

/**
 * Berkas media di KIRA_DATA_DIR/media/<org>/<yyyy-mm>/<uuid>.<ext>, sama dengan
 * apps/web/src/server/media.ts. Kolom media.path menyimpan bagian relatifnya.
 * Folder 0700, berkas 0600. Setiap path relatif dicek supaya tidak keluar dari folder media.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function mediaRoot(dataDir: string): string {
  return normalize(join(dataDir, 'media'))
}

/** Path absolut yang aman untuk path relatif dari database. Melempar bila path mencoba keluar dari folder media. */
export function safeMediaPath(dataDir: string, rel: string): string {
  if (typeof rel !== 'string' || rel.length === 0 || rel.length > 300 || rel.includes('\0') || isAbsolute(rel)) {
    throw new Error('Path media tidak valid')
  }
  const root = mediaRoot(dataDir)
  const abs = normalize(join(root, rel))
  if (!abs.startsWith(root + sep)) throw new Error('Path media tidak valid')
  return abs
}

export async function ensureMediaRoot(dataDir: string): Promise<void> {
  await mkdir(mediaRoot(dataDir), { recursive: true, mode: 0o700 })
}

export async function storeFile(
  dataDir: string,
  orgId: string,
  buf: Buffer,
  ext: string,
  now: Date = new Date(),
): Promise<{ path: string; sha256: string; size: number }> {
  if (!UUID.test(orgId)) throw new Error('orgId tidak valid')
  if (!/^[a-z0-9]{1,5}$/.test(ext)) throw new Error('Ekstensi berkas tidak valid')
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const rel = join(orgId, month, `${randomUUID()}.${ext}`)
  const abs = safeMediaPath(dataDir, rel)
  await mkdir(join(abs, '..'), { recursive: true, mode: 0o700 })
  await writeFile(abs, buf, { mode: 0o600, flag: 'wx' })
  return { path: rel, sha256: createHash('sha256').update(buf).digest('hex'), size: buf.length }
}

export async function readStored(dataDir: string, rel: string): Promise<Buffer> {
  return readFile(safeMediaPath(dataDir, rel))
}

/** Hapus berkas; berkas yang sudah tidak ada dianggap berhasil. */
export async function deleteStored(dataDir: string, rel: string): Promise<void> {
  await rm(safeMediaPath(dataDir, rel), { force: true })
}
