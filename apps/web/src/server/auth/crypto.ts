import 'server-only'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from '../env'

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function sha256hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function hmac(value: string, purpose: string): string {
  return createHmac('sha256', `${env().KIRA_SECRET}:${purpose}`).update(value).digest('base64url')
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab)
    return false
  }
  return timingSafeEqual(ab, bb)
}

/** Hash IP untuk log dan rate limit, tidak menyimpan IP mentah. */
export function ipHash(ip: string | null): string {
  return ip ? hmac(ip, 'ip').slice(0, 16) : 'tanpa-ip'
}
