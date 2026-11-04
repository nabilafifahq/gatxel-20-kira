import 'server-only'
import { headers } from 'next/headers'
import { and, eq, gt, sql } from 'drizzle-orm'
import { tables } from '@kira/db'
import { authDb } from '../db'
import { AppError } from '../errors'
import { pickClientIp } from '@/lib/client-ip'
import { ipPrefix } from '@/lib/access-log'
import { log } from '../log'
import { takeToken } from '../limiter'

/**
 * Pembatas laju. Akun: jeda bertambah setelah 3 kali gagal dalam 15 menit dan
 * akun dikunci 15 menit setelah banyak kali gagal (GTX: kunci akun, bukan IP; jangan 5 kali).
 * IP: ember token di Valkey (dibagi semua replika web), cadangan di memori bila Valkey mati.
 */

export { pickClientIp }

export async function clientIp(): Promise<string | null> {
  return pickClientIp(await headers())
}

/**
 * Batas per IP (ember token). Sekolah memakai satu IP untuk banyak orang tua, jadi batas IP sengaja
 * longgar dan perlindungan utama untuk login ada di kunci per akun. `scope` (mis. id akun) mengganti IP
 * sebagai kunci ember untuk rute tulis. Melempar AppError('rate-limited') dengan retryAfter detik.
 */
export async function throttleIp(action: string, perMinute: number, scope?: string): Promise<void> {
  const ip = (await clientIp()) ?? 'unknown'
  const wait = await takeToken(`ip:${action}:${scope ?? ip}`, perMinute)
  if (wait > 0) {
    log.warn('keamanan: batas laju terlampaui', { event: 'ratelimit', action, scoped: scope !== undefined, ipPrefix: ipPrefix(ip === 'unknown' ? null : ip) })
    throw new AppError('rate-limited', 'Terlalu banyak percobaan dari perangkat ini. Tunggu satu menit lalu coba lagi.', undefined, wait)
  }
}

/** Untuk Route Handler: Response 429 dengan Retry-After bila ember habis, selain itu null. */
export async function throttleResponse(action: string, perMinute: number, scope?: string): Promise<Response | null> {
  try {
    await throttleIp(action, perMinute, scope)
    return null
  } catch (e) {
    if (e instanceof AppError && e.code === 'rate-limited') {
      return new Response(JSON.stringify({ error: 'rate-limited' }), {
        status: 429,
        headers: { 'Retry-After': String(e.retryAfter ?? 60), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      })
    }
    throw e
  }
}

const WINDOW_MS = 15 * 60 * 1000

export async function recentFailures(key: string): Promise<number> {
  const rows = await authDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(tables.loginAttempt)
    .where(
      and(
        eq(tables.loginAttempt.key, key),
        eq(tables.loginAttempt.success, false),
        gt(tables.loginAttempt.at, new Date(Date.now() - WINDOW_MS)),
        // Masuk berhasil atau atur ulang password membuka kunci: yang dihitung hanya kegagalan sesudahnya.
        sql`${tables.loginAttempt.at} > coalesce((select max(la.at) from auth.login_attempt la where la.key = ${key} and la.success), 'epoch'::timestamptz)`,
      ),
    )
  return rows[0]?.n ?? 0
}

export async function recordAttempt(key: string, success: boolean): Promise<void> {
  await authDb().insert(tables.loginAttempt).values({ key, success })
}

/** Jeda bertahap: 0 untuk 3 kegagalan pertama, lalu 0,5 s, 1 s, 2 s, sampai 5 s. */
export async function escalatingDelay(failures: number): Promise<void> {
  if (failures < 3) return
  const ms = Math.min(5000, 250 * 2 ** (failures - 2))
  await new Promise((r) => setTimeout(r, ms))
}

export const ACCOUNT_LOCK_AFTER = 20
export const ACCOUNT_LOCK_MS = 15 * 60 * 1000

const emailBuckets = new Map<string, number[]>()
const EMAIL_PER_HOUR = 5

/**
 * Batas email keluar per alamat tujuan: paling banyak 5 per jam per jenis (konfirmasi, reset), supaya Kira tidak
 * dipakai membanjiri kotak masuk orang lain. Mengembalikan false bila batas habis. Pemanggil tidak boleh
 * membedakan jawabannya ke pengunjung: email dilewati diam-diam dan jawaban tetap sama.
 */
export function emailSendAllowed(kind: string, emailNorm: string): boolean {
  const key = `${kind}:${emailNorm.trim().toLowerCase()}`
  const now = Date.now()
  const recent = (emailBuckets.get(key) ?? []).filter((t) => now - t < 3_600_000)
  if (recent.length >= EMAIL_PER_HOUR) {
    emailBuckets.set(key, recent)
    log.warn('keamanan: batas email per alamat terlampaui', { event: 'ratelimit', action: `email-${kind}`, scoped: true })
    return false
  }
  recent.push(now)
  emailBuckets.set(key, recent)
  if (emailBuckets.size > 5000) emailBuckets.clear()
  return true
}
