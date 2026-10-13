import { createHash } from 'node:crypto'
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isTtsKey, ttsKeyInput, type TtsStyleId } from '@kira/core/tts'

/**
 * Klip suara di KIRA_DATA_DIR/tts/<sha256 dari teks dan gaya>.mp3. Sama dengan apps/web/src/server/tts.ts.
 * Klip tidak berisi data anak (hanya teks soal), jadi dipakai bersama semua org.
 */

export function ttsRoot(dataDir: string): string {
  return join(dataDir, 'tts')
}

export function clipKey(text: string, style: TtsStyleId): string {
  return createHash('sha256').update(ttsKeyInput(text, style)).digest('hex')
}

function clipFile(dataDir: string, key: string): string {
  if (!isTtsKey(key)) throw new Error('Kunci klip tidak valid')
  return join(ttsRoot(dataDir), `${key}.mp3`)
}

export async function hasClip(dataDir: string, key: string): Promise<boolean> {
  try {
    return (await stat(clipFile(dataDir, key))).size > 0
  } catch {
    return false
  }
}

/** Tulis lewat berkas sementara lalu rename, supaya web tidak pernah menyajikan klip setengah jadi. */
export async function writeClip(dataDir: string, key: string, audio: Buffer): Promise<void> {
  const dest = clipFile(dataDir, key)
  await mkdir(ttsRoot(dataDir), { recursive: true, mode: 0o700 })
  const tmp = `${dest}.${process.pid}.tmp`
  try {
    await writeFile(tmp, audio, { mode: 0o600 })
    await rename(tmp, dest)
  } catch (e) {
    await rm(tmp, { force: true }).catch(() => undefined)
    throw e
  }
}
