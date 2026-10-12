import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { and, eq, gt, isNull, ne } from 'drizzle-orm'
import { tables } from '@kira/db'
import { authDb } from '../db'
import { log } from '../log'
import { clearCookie, readCookie, SESSION_ABSOLUTE_MS, SESSION_COOKIE, SESSION_IDLE_MS, writeCookie } from './cookies'
import { randomToken, sha256hex } from './crypto'

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
}

/** Sesi aktif untuk request ini (di-cache per request). Null bila tidak ada atau kedaluwarsa. */
export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const token = await readCookie(SESSION_COOKIE)
  if (!token || token.length < 30 || token.length > 100) return null
  const id = sha256hex(token)
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
  if (now - row.lastSeenAt.getTime() > 60_000) {
    await authDb().update(session).set({ lastSeenAt: new Date() }).where(eq(session.id, id))
  }
  return {
    sessionId: row.id,
    userId: row.userId,
    orgId: row.orgId,
    kind: row.kind,
    role: row.role,
    name: row.name,
    email: row.email,
    deviceId: row.deviceId,
    createdAt: row.createdAt,
  }
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
    await clearCookie(SESSION_COOKIE)
  }
}

/** Cabut semua sesi pengguna, kecuali sesi yang sedang dipakai bila diminta. */
export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  const cond = exceptSessionId
    ? and(eq(session.userId, userId), isNull(session.revokedAt), ne(session.id, exceptSessionId))
    : and(eq(session.userId, userId), isNull(session.revokedAt))
  await authDb().update(session).set({ revokedAt: new Date() }).where(cond)
}
