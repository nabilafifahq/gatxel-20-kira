import 'server-only'
import { cookies } from 'next/headers'

/**
 * Cookie sesi dan perangkat. Awalan __Host- memaksa Secure, Path=/, dan tanpa Domain.
 * Token tidak pernah disimpan di localStorage.
 */
export const SESSION_COOKIE = '__Host-kira.session'
export const DEVICE_COOKIE = '__Host-kira.device'

export const SESSION_ABSOLUTE_MS = 24 * 60 * 60 * 1000
export const SESSION_IDLE_MS = 60 * 60 * 1000
export const DEVICE_TTL_MS = 90 * 24 * 60 * 60 * 1000

export async function readCookie(name: string): Promise<string | null> {
  const store = await cookies()
  return store.get(name)?.value ?? null
}

export async function writeCookie(name: string, value: string, maxAgeMs: number): Promise<void> {
  const store = await cookies()
  store.set(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(maxAgeMs / 1000),
  })
}

export async function clearCookie(name: string): Promise<void> {
  const store = await cookies()
  store.set(name, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
}
