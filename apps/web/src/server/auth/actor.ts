import 'server-only'
import { redirect } from 'next/navigation'
import type { OrgContext } from '@kira/db/client'
import { forbidden, unauthenticated } from '../errors'
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

/** Hanya izinkan alamat relatif di dalam Kira untuk parameter next. */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || next.length > 300) return fallback
  return next
}
