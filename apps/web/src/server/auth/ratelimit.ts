import 'server-only'
import { headers } from 'next/headers'
import { and, eq, gt, sql } from 'drizzle-orm'
import { tables } from '@kira/db'
import { authDb } from '../db'
import { AppError } from '../errors'
import { pickClientIp } from '@/lib/client-ip'

/**
 * Pembatas laju. Akun: jeda bertambah setelah 3 kali gagal dalam 15 menit dan
 * akun dikunci 15 menit setelah 20 kali gagal (GTX: kunci akun, bukan IP; jangan 5 kali).
 * IP: ember token di memori untuk menahan banjir permintaan.
 */
const buckets = new Map<string, { tokens: number; at: number }>()

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
  const key = `${action}:${scope ?? ip}`
  const now = Date.now()
  const b = buckets.get(key) ?? { tokens: perMinute, at: now }
  b.tokens = Math.min(perMinute, b.tokens + ((now - b.at) / 60000) * perMinute)
  b.at = now
  if (b.tokens < 1) {
    buckets.set(key, b)
    const retryAfter = Math.max(1, Math.ceil(((1 - b.tokens) / perMinute) * 60))
    throw new AppError('rate-limited', 'Terlalu banyak percobaan dari perangkat ini. Tunggu satu menit lalu coba lagi.', undefined, retryAfter)
  }
  b.tokens -= 1
  buckets.set(key, b)
  if (buckets.size > 5000) buckets.clear()
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
    .where(and(eq(tables.loginAttempt.key, key), eq(tables.loginAttempt.success, false), gt(tables.loginAttempt.at, new Date(Date.now() - WINDOW_MS))))
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
