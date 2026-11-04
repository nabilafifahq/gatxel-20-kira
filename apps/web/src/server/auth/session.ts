import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { and, eq, gt, inArray, isNull, ne, sql } from 'drizzle-orm'
import { tables } from '@kira/db'
import { authDb } from '../db'
import { kvConfigured, kvDel, kvGet, kvSet } from '../kv'
import { log } from '../log'
import { clearCookie, readCookie, SESSION_ABSOLUTE_MS, SESSION_COOKIE, SESSION_IDLE_MS, writeCookie } from './cookies'
import { randomToken, sha256hex } from './crypto'
import type { UiLang } from '@/lib/i18n/lang'

const { session, userAccount, device } = tables

export type SessionInfo = {
  sessionId: string
  userId: string
  orgId: string
  kind: 'adult' | 'learner'
  role: 'tutor' | 'guardian' | 'learner'
  name: string
  email: string | null
  deviceId: string | null
  createdAt: Date
  /** Bahasa tampilan anak, ikut terbaca bersama sesi supaya tidak ada query tambahan. Opsional hanya untuk fixture tes. */
  uiLang?: UiLang
  /** Orang tua mengizinkan anak mengganti bahasa tampilan sendiri. */
  uiLangSwitch?: boolean
}

/**
 * Cache sesi singkat: satu pencarian database per sesi per 15 detik, bukan per halaman. Disimpan di Valkey
 * (dibagi semua replika web); tanpa Valkey, di memori proses dengan umur lebih pendek. Dihapus saat keluar, pencabutan,
 * dan ganti password. Perangkat yang dicabut atau akun yang dinonaktifkan paling lama terlihat 15 detik.
 */
const CACHE_TTL_S = 15
const LOCAL_TTL_MS = 5000
type CachedSession = { info: Omit<SessionInfo, 'createdAt'> & { createdAt: string }; expiresAt: number; lastSeenAt: number }
const local = new Map<string, { at: number; v: CachedSession }>()
const touched = new Set<string>()
let flusher: NodeJS.Timeout | null = null

const cacheKey = (id: string) => `sess:${id}`

/** KIRA_TODAY_CACHE=off (CI e2e, yang mengubah database langsung) mematikan juga cache sesi. */
const cacheOff = () => process.env.KIRA_TODAY_CACHE === 'off'

async function cacheGet(id: string): Promise<CachedSession | null> {
  if (cacheOff()) return null
  const raw = await kvGet(cacheKey(id))
  if (raw) {
    try {
      return JSON.parse(raw) as CachedSession
    } catch {
      return null
    }
  }
  if (kvConfigured()) return null
  const l = local.get(id)
  if (l && Date.now() - l.at < LOCAL_TTL_MS) return l.v
  return null
}

async function cachePut(id: string, v: CachedSession): Promise<void> {
  if (cacheOff()) return
  local.set(id, { at: Date.now(), v })
  if (local.size > 5000) local.clear()
  await kvSet(cacheKey(id), JSON.stringify(v), CACHE_TTL_S)
}

/** Hapus cache sesi (semua replika bila Valkey tersedia). */
export async function invalidateSessions(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  for (const id of ids) local.delete(id)
  await kvDel(...ids.map(cacheKey))
}

/** Tandai sesi dipakai; tulis last_seen_at sekali per 20 detik untuk semua sesi sekaligus. */
function touch(id: string): void {
  touched.add(id)
  if (flusher) return
  flusher = setInterval(() => void flushTouched(), 20_000)
  flusher.unref()
}

export async function flushTouched(): Promise<void> {
  if (touched.size === 0) return
  const ids = [...touched]
  touched.clear()
  try {
    await authDb()
      .update(session)
      .set({ lastSeenAt: new Date() })
      .where(and(inArray(session.id, ids), sql`${session.lastSeenAt} < now() - interval '30 seconds'`))
  } catch (e) {
    log.warn('catatan terakhir terlihat gagal ditulis', { error: e instanceof Error ? e.message : String(e) })
  }
}

function toInfo(c: CachedSession): SessionInfo {
  return { ...c.info, createdAt: new Date(c.info.createdAt) }
}

/** Sesi aktif untuk request ini (di-cache per request). Null bila tidak ada atau kedaluwarsa. */
export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const token = await readCookie(SESSION_COOKIE)
  if (!token || token.length < 30 || token.length > 100) return null
  const id = sha256hex(token)
  const hit = await cacheGet(id)
  if (hit) {
    const t = Date.now()
    if (hit.expiresAt > t && hit.lastSeenAt + SESSION_IDLE_MS > t) {
      touch(id)
      return toInfo(hit)
    }
  }
  const rows = await authDb()
    .select({
      id: session.id,
      userId: session.userId,
      orgId: session.orgId,
      kind: session.kind,
      deviceId: session.deviceId,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      role: userAccount.role,
      name: userAccount.name,
      email: userAccount.email,
      uiLang: userAccount.uiLang,
      uiLangSwitch: userAccount.uiLangSwitch,
    })
    .from(session)
    .innerJoin(userAccount, eq(session.userId, userAccount.id))
    .where(and(eq(session.id, id), isNull(session.revokedAt), isNull(userAccount.disabledAt)))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  const now = Date.now()
  if (row.expiresAt.getTime() <= now || row.lastSeenAt.getTime() + SESSION_IDLE_MS <= now) {
    await authDb().update(session).set({ revokedAt: new Date() }).where(eq(session.id, id))
    return null
  }
  if (row.kind === 'learner') {
    if (!row.deviceId) return null
    const dev = await authDb()
      .select({ id: device.id, learnerIds: device.learnerIds })
      .from(device)
      .where(and(eq(device.id, row.deviceId), isNull(device.revokedAt), gt(device.expiresAt, new Date())))
      .limit(1)
    if (!dev[0] || !dev[0].learnerIds.includes(row.userId)) return null
  }
  touch(id)
  const info: SessionInfo = {
    sessionId: row.id,
    userId: row.userId,
    orgId: row.orgId,
    kind: row.kind,
    role: row.role,
    name: row.name,
    email: row.email,
    deviceId: row.deviceId,
    createdAt: row.createdAt,
    uiLang: row.uiLang,
    uiLangSwitch: row.uiLangSwitch,
  }
  await cachePut(id, { info: { ...info, createdAt: info.createdAt.toISOString() }, expiresAt: row.expiresAt.getTime(), lastSeenAt: Math.max(row.lastSeenAt.getTime(), now) })
  return info
})

/** Buat sesi baru dan pasang cookie. Sesi lama di browser ini dicabut (rotasi ID). */
export async function startSession(user: { id: string; orgId: string; kind: 'adult' | 'learner' }, deviceId: string | null = null): Promise<void> {
  await endCurrentSession()
  const token = randomToken(32)
  const ua = (await headers()).get('user-agent')?.slice(0, 200) ?? null
  await authDb()
    .insert(session)
    .values({
      id: sha256hex(token),
      userId: user.id,
      orgId: user.orgId,
      kind: user.kind,
      deviceId,
      expiresAt: new Date(Date.now() + SESSION_ABSOLUTE_MS),
      userAgent: ua,
    })
  await writeCookie(SESSION_COOKIE, token, SESSION_ABSOLUTE_MS)
  log.info('sesi dimulai', { userId: user.id, kind: user.kind })
}

export async function endCurrentSession(): Promise<void> {
  const token = await readCookie(SESSION_COOKIE)
  if (token) {
    await authDb().update(session).set({ revokedAt: new Date() }).where(eq(session.id, sha256hex(token)))
    await invalidateSessions([sha256hex(token)])
    await clearCookie(SESSION_COOKIE)
  }
}

/** Cabut semua sesi pengguna, kecuali sesi yang sedang dipakai bila diminta. */
export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  const cond = exceptSessionId
    ? and(eq(session.userId, userId), isNull(session.revokedAt), ne(session.id, exceptSessionId))
    : and(eq(session.userId, userId), isNull(session.revokedAt))
  const rows = await authDb().update(session).set({ revokedAt: new Date() }).where(cond).returning({ id: session.id })
  await invalidateSessions(rows.map((r) => r.id))
}

/** Hapus cache semua sesi learner di satu perangkat (perangkat dicabut atau daftar learner berubah). */
export async function invalidateDeviceSessions(deviceId: string): Promise<void> {
  const rows = await authDb().select({ id: session.id }).from(session).where(and(eq(session.deviceId, deviceId), isNull(session.revokedAt)))
  await invalidateSessions(rows.map((r) => r.id))
}
