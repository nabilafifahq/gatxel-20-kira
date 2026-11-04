import { readdir, readFile, rm, stat } from 'node:fs/promises'
import { isAbsolute, join, normalize, sep } from 'node:path'

/**
 * Lampiran halaman Bantuan di KIRA_DATA_DIR/support/<yyyy-mm>/<uuid>.<ext>. Folder ini di luar web root dan tidak
 * disajikan proxy. Berkas dihapus setelah email terkirim, paling lama setelah SUPPORT_FILE_DAYS.
 */
export const SUPPORT_FILE_DAYS = 14

export function supportRoot(dataDir: string): string {
  return normalize(join(dataDir, 'support'))
}

/** Path absolut yang aman untuk path relatif dari database. Melempar bila path mencoba keluar dari folder. */
export function safeSupportPath(dataDir: string, rel: string): string {
  if (typeof rel !== 'string' || rel.length === 0 || rel.length > 200 || rel.includes('\0') || isAbsolute(rel)) throw new Error('Path lampiran tidak valid')
  const root = supportRoot(dataDir)
  const abs = normalize(join(root, rel))
  if (!abs.startsWith(root + sep)) throw new Error('Path lampiran tidak valid')
  return abs
}

export async function readSupportFile(dataDir: string, rel: string): Promise<Buffer> {
  return readFile(safeSupportPath(dataDir, rel))
}

export async function deleteSupportFile(dataDir: string, rel: string): Promise<void> {
  await rm(safeSupportPath(dataDir, rel), { force: true })
}

/** Hapus semua berkas yang lebih tua dari masa simpan, juga yang tidak punya baris lagi. Mengembalikan jumlahnya. */
export async function sweepSupportFiles(dataDir: string, now: Date = new Date()): Promise<number> {
  const root = supportRoot(dataDir)
  const cutoff = now.getTime() - SUPPORT_FILE_DAYS * 86_400_000
  let removed = 0
  let months: string[]
  try {
    months = await readdir(root)
  } catch {
    return 0
  }
  for (const month of months) {
    const dir = join(root, month)
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      continue
    }
    for (const f of files) {
      const abs = join(dir, f)
      const info = await stat(abs).catch(() => null)
      if (info?.isFile() && info.mtimeMs < cutoff) {
        await rm(abs, { force: true })
        removed++
      }
    }
    if (files.length && (await readdir(dir).catch(() => ['x'])).length === 0) await rm(dir, { recursive: true, force: true })
  }
  return removed
}
