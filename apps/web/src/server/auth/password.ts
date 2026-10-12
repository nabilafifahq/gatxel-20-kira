import 'server-only'
import { createHash } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'
import { env } from '../env'
import { log } from '../log'

/** Argon2id m=19456, t=2, p=1 (GTX-ENG-001). Algorithm.Argon2id = 2. */
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, algorithm: 2 as never }

export const PASSWORD_MIN = 15
export const PASSWORD_MAX = 128

export function hashSecret(secret: string): Promise<string> {
  return hash(secret, OPTIONS)
}

export async function verifySecret(stored: string, secret: string): Promise<boolean> {
  try {
    return await verify(stored, secret)
  } catch {
    return false
  }
}

/** Hash tiruan supaya waktu respons akun tidak dikenal sama dengan password salah. */
let dummy: string | null = null
export async function burnVerify(secret: string): Promise<void> {
  dummy ??= await hashSecret('kira-dummy-password-untuk-waktu-respons')
  await verifySecret(dummy, secret)
}

/**
 * Cek HaveIBeenPwned dengan k-anonymity (hanya 5 karakter awal SHA-1 yang dikirim).
 * Kalau layanan tidak bisa dihubungi, password tetap diterima dan kejadian dicatat.
 */
export async function isPwned(password: string): Promise<boolean> {
  if (env().KIRA_HIBP === 'off') return false
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'Kira-home-server' },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) throw new Error(`HIBP ${res.status}`)
    const body = await res.text()
    return body.split('\n').some((line) => {
      const [hashSuffix, count] = line.trim().split(':')
      return hashSuffix === suffix && Number(count) > 0
    })
  } catch (e) {
    log.warn('cek HIBP gagal, password diterima tanpa cek', { error: (e as Error).message })
    return false
  }
}

/** Pesan validasi password dalam Bahasa Indonesia, atau null bila diterima. */
export async function passwordProblem(password: string, context: { email?: string; name?: string }): Promise<string | null> {
  if (password.length < PASSWORD_MIN) return `Password minimal ${PASSWORD_MIN} karakter. Kalimat pendek yang mudah diingat juga boleh.`
  if (password.length > PASSWORD_MAX) return `Password paling panjang ${PASSWORD_MAX} karakter.`
  const lower = password.toLowerCase()
  if (context.email && lower.includes(context.email.toLowerCase().split('@')[0] ?? '\u0000')) return 'Password tidak boleh memuat alamat email.'
  if (/^(.)\1+$/.test(password)) return 'Password tidak boleh satu karakter yang diulang.'
  if (await isPwned(password)) return 'Password ini pernah bocor di situs lain menurut HaveIBeenPwned. Pilih password lain.'
  return null
}
