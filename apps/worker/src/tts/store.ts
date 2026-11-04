import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isTtsKey, isVoiceVersion, ttsKeyInput, TTS_SERVED_VERSION_FILE, TTS_VOICE_VERSION, type TtsStyleId } from '@kira/core/tts'

/**
 * Klip suara di KIRA_DATA_DIR/tts/<sha256 dari versi suara, peran, dan teks>.mp3. Sama dengan apps/web/src/server/tts.ts.
 *
 *   publik    KIRA_DATA_DIR/tts/<kunci>.mp3  teks konten bersama (soal, pelajaran, bacaan, ejaan dari repo). Disajikan
 *             tanpa sesi dan boleh di-cache lama oleh proxy.
 *   keluarga  KIRA_DATA_DIR/tts/private/<orgId>/<kunci>.mp3  teks soal milik satu org. Hanya lewat sesi org itu.
 *
 * Klip tidak pernah memuat jawaban atau nama anak: hanya teks soal, pelajaran, dan bacaan yang dibacakan.
 */

export type ClipScope = { kind: 'public' } | { kind: 'org'; orgId: string }
export const PUBLIC_SCOPE: ClipScope = { kind: 'public' }

export function ttsRoot(dataDir: string): string {
  return join(dataDir, 'tts')
}

export function clipKey(text: string, style: TtsStyleId, version: string = TTS_VOICE_VERSION): string {
  return createHash('sha256').update(ttsKeyInput(text, style, version)).digest('hex')
}

/** Versi suara yang sedang disajikan ke anak (penunjuk atomik). Tanpa berkas atau isi tak valid: versi kode. */
export async function readServedVersion(dataDir: string): Promise<string> {
  try {
    const v = (await readFile(join(ttsRoot(dataDir), TTS_SERVED_VERSION_FILE), 'utf8')).trim()
    return isVoiceVersion(v) ? v : TTS_VOICE_VERSION
  } catch {
    return TTS_VOICE_VERSION
  }
}

/** Pindahkan penunjuk dengan rename (atomik). Dipakai hanya oleh pnpm tts:promote. */
export async function writeServedVersion(dataDir: string, version: string): Promise<void> {
  if (!isVoiceVersion(version)) throw new Error('Versi suara tidak valid')
  await mkdir(ttsRoot(dataDir), { recursive: true })
  const dest = join(ttsRoot(dataDir), TTS_SERVED_VERSION_FILE)
  const tmp = `${dest}.${process.pid}.tmp`
  await writeFile(tmp, version + '\n', { mode: 0o644 })
  await rename(tmp, dest)
}

const ORG_RE = /^[0-9a-f-]{36}$/

function clipFile(dataDir: string, key: string, scope: ClipScope): string {
  if (!isTtsKey(key)) throw new Error('Kunci klip tidak valid')
  if (scope.kind === 'public') return join(ttsRoot(dataDir), `${key}.mp3`)
  if (!ORG_RE.test(scope.orgId)) throw new Error('Org tidak valid')
  return join(ttsRoot(dataDir), 'private', scope.orgId, `${key}.mp3`)
}

export async function hasClip(dataDir: string, key: string, scope: ClipScope = PUBLIC_SCOPE): Promise<boolean> {
  try {
    return (await stat(clipFile(dataDir, key, scope))).size > 0
  } catch {
    return false
  }
}

/** Tulis lewat berkas sementara lalu rename, supaya web tidak pernah menyajikan klip setengah jadi. */
export async function writeClip(dataDir: string, key: string, audio: Buffer, scope: ClipScope = PUBLIC_SCOPE): Promise<void> {
  const dest = clipFile(dataDir, key, scope)
  await mkdir(join(dest, '..'), { recursive: true, mode: 0o700 })
  const tmp = `${dest}.${process.pid}.tmp`
  try {
    await writeFile(tmp, audio, { mode: 0o644 })
    await rename(tmp, dest)
  } catch (e) {
    await rm(tmp, { force: true }).catch(() => undefined)
    throw e
  }
}
