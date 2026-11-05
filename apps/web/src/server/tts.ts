import 'server-only'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { isTtsKey, isVoiceVersion, ttsKeyInput, TTS_ID_SERVED_VERSION_FILE, TTS_SERVED_VERSION_FILE, TTS_VOICE_VERSION, type TtsStyleId } from '@kira/core/tts'
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

/** Layanan pembuat klip diisi: klip baru boleh diminta. Tanpa ini, klip yang sudah ada tetap disajikan (lihat clipsServed). */
export function ttsEnabled(): boolean {
  return Boolean(env().TTS_URL)
}

/**
 * Anak bisa mendengar klip: layanan aktif, atau klip jadi sudah dipromosikan ke folder data (ada penunjuk versi).
 * Pilot memakai klip jadi tanpa layanan tts, jadi TTS_URL kosong tidak boleh mematikan semua tombol suara.
 */
export function clipsServed(): boolean {
  if (ttsEnabled()) return true
  return existsSync(join(env().KIRA_DATA_DIR, 'tts', TTS_SERVED_VERSION_FILE))
}

let served: { at: number; v: string } | null = null

/** Versi suara yang disajikan (penunjuk di folder klip, dibaca ulang tiap 5 detik). Tanpa berkas: versi kode. */
export function servedVoiceVersion(): string {
  const now = Date.now()
  if (served && now - served.at < 5000) return served.v
  let v = TTS_VOICE_VERSION
  try {
    const raw = readFileSync(join(env().KIRA_DATA_DIR, 'tts', TTS_SERVED_VERSION_FILE), 'utf8').trim()
    if (isVoiceVersion(raw)) v = raw
  } catch {
    // belum ada penunjuk
  }
  served = { at: now, v }
  return v
}

let servedId: { at: number; v: string | null } | null = null

/** Versi suara Indonesia yang disajikan, atau null bila belum dipromosikan. Tidak bergantung pada penunjuk bahasa Inggris. */
export function servedIdVoiceVersion(): string | null {
  const now = Date.now()
  if (servedId && now - servedId.at < 5000) return servedId.v
  let v: string | null = null
  try {
    const raw = readFileSync(join(env().KIRA_DATA_DIR, 'tts', TTS_ID_SERVED_VERSION_FILE), 'utf8').trim()
    if (isVoiceVersion(raw)) v = raw
  } catch {
    // belum dipromosikan
  }
  servedId = { at: now, v }
  return v
}

export function clipKeyOf(text: string, style: TtsStyleId): string {
  return createHash('sha256').update(ttsKeyInput(text, style, servedVoiceVersion())).digest('hex')
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
