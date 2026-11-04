import 'server-only'
import { redirect } from 'next/navigation'
import type { OrgContext } from '@kira/db/client'
import { AppError, forbidden, unauthenticated } from '../errors'
import { throttleIp } from './ratelimit'
import { getSession, type SessionInfo } from './session'

export type Role = 'tutor' | 'guardian' | 'learner'

export type Actor = SessionInfo

export function orgCtx(actor: Actor): OrgContext {
  return { orgId: actor.orgId, userId: actor.userId, role: actor.role }
}

export async function getActor(): Promise<Actor | null> {
  return getSession()
}

/** Untuk Server Action dan Route Handler: lempar error, jangan redirect. */
export async function requireActor(opts: { roles?: Role[] } = {}): Promise<Actor> {
  const actor = await getSession()
  if (!actor) throw unauthenticated()
  if (opts.roles && !opts.roles.includes(actor.role)) throw forbidden()
  // Batas longgar per akun untuk semua Server Action tulis: anak sungguhan tidak pernah menyentuhnya
  // (15 aksi per detik), tetapi skrip yang membanjiri server berhenti.
  try {
    await throttleIp(`u:${actor.role}`, actor.role === 'learner' ? 900 : 300, actor.userId)
  } catch (e) {
    if (e instanceof AppError && e.code === 'rate-limited' && actor.role === 'learner')
      throw new AppError('rate-limited', 'Slow down a little. Try again in a moment.', undefined, e.retryAfter)
    throw e
  }
  return actor
}

export function requireTutor(): Promise<Actor> {
  return requireActor({ roles: ['tutor'] })
}

export function requireAdult(): Promise<Actor> {
  return requireActor({ roles: ['tutor', 'guardian'] })
}

export function requireLearner(): Promise<Actor> {
  return requireActor({ roles: ['learner'] })
}

export function homeFor(role: Role): string {
  return role === 'tutor' ? '/konsol' : role === 'guardian' ? '/keluarga' : '/today'
}

/** Untuk halaman: alihkan ke halaman masuk yang sesuai bila belum masuk atau salah peran. */
export async function pageActor(roles: Role[], next?: string): Promise<Actor> {
  const actor = await getSession()
  if (!actor) {
    if (roles.includes('learner') && roles.length === 1) redirect('/')
    redirect(next ? `/masuk?next=${encodeURIComponent(next)}` : '/masuk')
  }
  if (!roles.includes(actor.role)) redirect(homeFor(actor.role))
  return actor
}

/**
 * Hanya izinkan alamat relatif di dalam Kira untuk parameter next. Browser membuang tab dan baris baru dari URL dan
 * membaca garis miring terbalik sebagai garis miring, jadi `/<tab>/situs-lain` sama dengan `//situs-lain`.
 * Karakter kontrol dan garis miring terbalik di mana pun ditolak.
 */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || typeof next !== 'string' || next.length > 300 || !next.startsWith('/') || next.startsWith('//')) return fallback
  // eslint-disable-next-line no-control-regex -- justru karakter kontrol yang ditolak
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback
  return next
}
