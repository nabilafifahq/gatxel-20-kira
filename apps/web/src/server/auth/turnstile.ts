import 'server-only'
import { env } from '../env'
import { invalid } from '../errors'
import { log } from '../log'

/**
 * Cloudflare Turnstile untuk halaman auth publik (daftar, masuk, reset, daftar tunggu).
 * Aktif hanya bila KIRA_TURNSTILE_SITE_KEY dan KIRA_TURNSTILE_SECRET sama-sama diisi. Diverifikasi di server.
 * Area learner tidak pernah memuat skrip ini, kecuali langkah kode keluarga di /masuk/anak, sebelum ada sesi anak.
 */
export function turnstileSiteKey(): string | null {
  const e = env()
  return e.KIRA_TURNSTILE_SITE_KEY && e.KIRA_TURNSTILE_SECRET ? e.KIRA_TURNSTILE_SITE_KEY : null
}

export async function verifyTurnstile(token: string | undefined | null, ip: string | null): Promise<void> {
  if (!turnstileSiteKey()) return
  const message = 'Pemeriksaan keamanan belum selesai. Muat ulang halaman lalu coba lagi.'
  if (!token || token.length > 2048) throw invalid(message)
  try {
    const body = new URLSearchParams({ secret: env().KIRA_TURNSTILE_SECRET!, response: token })
    if (ip) body.set('remoteip', ip)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(5000) })
    const json = (await res.json()) as { success?: boolean }
    if (!json.success) throw invalid(message)
  } catch (e) {
    if (e instanceof Error && e.name === 'AppError') throw e
    log.warn('turnstile tidak bisa diverifikasi', { error: e })
    throw invalid(message)
  }
}
