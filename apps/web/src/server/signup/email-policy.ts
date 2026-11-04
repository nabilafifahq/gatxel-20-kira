import { EMAIL_SHAPE, emailKey, splitEmail } from '@kira/core/email'
import { resolveMx } from 'node:dns/promises'
import { DISPOSABLE_SNAPSHOT } from './disposable-snapshot'

/**
 * Aturan alamat email untuk pendaftaran, pengiriman ulang, dan daftar kabar (di server).
 * - Normalisasi untuk keunikan: huruf kecil; Gmail tanpa titik; +tag dibuang di semua domain.
 * - Tolak domain email sekali pakai (snapshot CC0 + daftar tambahan; subdomain ikut) dan domain tanpa MX.
 * Modul ini sengaja bebas dari server-only dan database supaya mudah diuji.
 */

/** Domain tambahan di luar snapshot (layanan email sementara yang sering dipakai). Subdomain ikut diblokir. */
export const EXTRA_DISPOSABLE_DOMAINS: readonly string[] = [
  'temp-mail.org',
  'temp-mail.io',
  'tmailor.com',
  'internxt.com',
  'tmail.pk',
  'noopmail.org',
  'tempmail.email',
  'tempmailo.com',
  'mailtemp.net',
  'guerrillamail.com',
  'mailinator.com',
  '10minutemail.com',
  'yopmail.com',
  'sharklasers.com',
  'trashmail.com',
]

const BLOCKED = new Set<string>([...DISPOSABLE_SNAPSHOT, ...EXTRA_DISPOSABLE_DOMAINS])
export { EMAIL_SHAPE, emailKey, splitEmail }

/** True bila domain (atau induknya) ada di daftar sekali pakai. */
export function isDisposableDomain(domain: string): boolean {
  const labels = domain.trim().toLowerCase().replace(/\.$/, '').split('.')
  for (let i = 0; i < labels.length - 1; i++) {
    if (BLOCKED.has(labels.slice(i).join('.'))) return true
  }
  return false
}

export function isDisposableEmail(email: string): boolean {
  const parts = splitEmail(email)
  return parts ? isDisposableDomain(parts.domain) : false
}

export type MxResolver = (domain: string) => Promise<{ exchange: string }[]>

const MX_TIMEOUT_MS = 3000
const POSITIVE_TTL_MS = 6 * 3600 * 1000
const NEGATIVE_TTL_MS = 10 * 60 * 1000
const mxCache = new Map<string, { ok: boolean; until: number }>()

export function clearMxCache(): void {
  mxCache.clear()
}

/**
 * True bila domain punya MX, false bila DNS menjawab bahwa tidak ada. Gagal terbuka (true) hanya bila DNS
 * sendiri bermasalah (timeout, SERVFAIL, tidak ada jaringan), supaya gangguan DNS tidak menutup pendaftaran.
 */
export async function domainAcceptsMail(domain: string, resolver: MxResolver = resolveMx, now: () => number = Date.now): Promise<boolean> {
  const key = domain.toLowerCase()
  const hit = mxCache.get(key)
  if (hit && hit.until > now()) return hit.ok
  let timer: NodeJS.Timeout | undefined
  try {
    const records = await Promise.race([
      resolver(key),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), MX_TIMEOUT_MS)
      }),
    ])
    const ok = records.some((r) => r.exchange && r.exchange !== '.')
    mxCache.set(key, { ok, until: now() + (ok ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS) })
    return ok
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'ENOTFOUND' || code === 'ENODATA') {
      mxCache.set(key, { ok: false, until: now() + NEGATIVE_TTL_MS })
      return false
    }
    return true
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export type EmailVerdict = { ok: true; key: string; email: string } | { ok: false; reason: 'shape' | 'disposable' | 'no-mx'; message: string }

export const EMAIL_MESSAGES = {
  shape: 'Tulis alamat email lengkap, dengan @ dan nama domain.',
  disposable: 'Alamat email sementara belum bisa dipakai di Kira. Pakai email yang Anda baca setiap hari, supaya kabar tentang akun Anda sampai.',
  'no-mx': 'Alamat email ini sepertinya belum bisa menerima surat. Periksa penulisannya, atau pakai alamat lain.',
} as const

export async function checkEmail(raw: string, opts: { resolver?: MxResolver } = {}): Promise<EmailVerdict> {
  const parts = splitEmail(raw)
  if (!parts || raw.length > 200) return { ok: false, reason: 'shape', message: EMAIL_MESSAGES.shape }
  if (isDisposableDomain(parts.domain)) return { ok: false, reason: 'disposable', message: EMAIL_MESSAGES.disposable }
  if (!(await domainAcceptsMail(parts.domain, opts.resolver))) return { ok: false, reason: 'no-mx', message: EMAIL_MESSAGES['no-mx'] }
  return { ok: true, key: emailKey(raw), email: `${parts.local}@${parts.domain}` }
}
