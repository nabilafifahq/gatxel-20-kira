import 'server-only'
import { createHash } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { isTtsKey, ttsKeyInput, type TtsStyleId } from '@kira/core/tts'
import { env } from './env'
import type { ClipFile } from './tts-serve'

/**
 * Klip suara bahasa Inggris, dibuat worker (tts.batch dan tts.clip). Sama dengan apps/worker/src/tts/store.ts.
 *
 *   KIRA_DATA_DIR/tts/<kunci>.mp3                  publik: teks konten bersama, disajikan tanpa sesi
 *   KIRA_DATA_DIR/tts/private/<orgId>/<kunci>.mp3  keluarga: teks soal milik satu org, hanya lewat sesi org itu
 *
 * <kunci> = sha256 dari versi suara, peran, dan teks (ttsKeyInput). Web hanya membaca.
 */

/** Suara aktif bila alamat layanan tts diisi. Kalau tidak, tablet memakai suara bawaan. */
export function ttsEnabled(): boolean {
  return Boolean(env().TTS_URL)
}

export function clipKeyOf(text: string, style: TtsStyleId): string {
  return createHash('sha256').update(ttsKeyInput(text, style)).digest('hex')
}

const ORG_RE = /^[0-9a-f-]{36}$/

export type ClipScope = { kind: 'public' } | { kind: 'org'; orgId: string }

function clipPath(key: string, scope: ClipScope): string {
  if (!isTtsKey(key)) throw new Error('Kunci klip tidak valid')
  if (scope.kind === 'public') return join(env().KIRA_DATA_DIR, 'tts', `${key}.mp3`)
  if (!ORG_RE.test(scope.orgId)) throw new Error('Org tidak valid')
  return join(env().KIRA_DATA_DIR, 'tts', 'private', scope.orgId, `${key}.mp3`)
}

/** Info berkas klip, atau null bila tidak ada atau kosong. */
export async function clipFile(key: string, scope: ClipScope): Promise<ClipFile | null> {
  try {
    const path = clipPath(key, scope)
    const s = await stat(path)
    return s.isFile() && s.size > 0 ? { path, size: s.size, mtimeMs: s.mtimeMs } : null
  } catch {
    return null
  }
}

/** Klip ada di folder publik. */
export async function clipExists(key: string): Promise<boolean> {
  return (await clipFile(key, { kind: 'public' })) !== null
}

/** Klip ada untuk org ini: publik, atau milik org itu. */
export async function clipExistsFor(key: string, orgId: string): Promise<boolean> {
  return (await clipExists(key)) || (await clipFile(key, { kind: 'org', orgId })) !== null
}
