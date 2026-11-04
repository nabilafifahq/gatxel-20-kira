import 'server-only'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { isTtsKey, isVoiceVersion, ttsKeyInput, TTS_SERVED_VERSION_FILE, TTS_VOICE_VERSION, type TtsStyleId } from '@kira/core/tts'
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

/**
 * Klip publik yang sudah pernah terlihat di proses ini. Nama berkas adalah hash versi suara, peran, dan teks, jadi isinya tidak
 * berubah. Folder data lewat bind mount Windows dan satu stat bisa puluhan milidetik, sedangkan satu anak punya ratusan klip per hari.
 */
const knownPublic = new Set<string>()
const KNOWN_PUBLIC_MAX = 200_000

/** Lupakan klip yang pernah terlihat (dipakai tes yang menghapus berkas klip; di produksi klip tidak pernah berubah). */
export function forgetKnownClips(): void {
  knownPublic.clear()
}

/** Klip ada di folder publik. */
export async function clipExists(key: string): Promise<boolean> {
  if (knownPublic.has(key)) return true
  const found = (await clipFile(key, { kind: 'public' })) !== null
  if (found && knownPublic.size < KNOWN_PUBLIC_MAX) knownPublic.add(key)
  return found
}

/** Klip ada untuk org ini: publik, atau milik org itu. */
export async function clipExistsFor(key: string, orgId: string): Promise<boolean> {
  return (await clipExists(key)) || (await clipFile(key, { kind: 'org', orgId })) !== null
}
