import 'server-only'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { isTtsKey, ttsKeyInput, type TtsStyleId } from '@kira/core/tts'
import { env } from './env'

/**
 * Klip suara bahasa Inggris di KIRA_DATA_DIR/tts/<sha256 teks+gaya>.mp3, dibuat worker (tts.batch dan tts.clip).
 * Sama dengan apps/worker/src/tts/store.ts. Web hanya membaca.
 */

/** Suara Qwen aktif bila alamat layanan tts diisi. Kalau tidak, tablet memakai suara bawaan. */
export function ttsEnabled(): boolean {
  return Boolean(env().TTS_URL)
}

export function clipKeyOf(text: string, style: TtsStyleId): string {
  return createHash('sha256').update(ttsKeyInput(text, style)).digest('hex')
}

function clipPath(key: string): string {
  if (!isTtsKey(key)) throw new Error('Kunci klip tidak valid')
  return join(env().KIRA_DATA_DIR, 'tts', `${key}.mp3`)
}

export async function clipExists(key: string): Promise<boolean> {
  try {
    return (await stat(clipPath(key))).size > 0
  } catch {
    return false
  }
}

export async function readClip(key: string): Promise<Buffer | null> {
  try {
    return await readFile(clipPath(key))
  } catch {
    return null
  }
}
