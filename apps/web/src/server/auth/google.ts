import 'server-only'
import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose'
import { z } from 'zod'
import { isEmbeddedBrowser } from '@/lib/embedded-browser'
import { origin } from '../env'
import { clearCookie, readCookie, writeCookie } from './cookies'
import { hmac, randomToken, safeEqual } from './crypto'

/**
 * Masuk dengan Google (OpenID Connect, authorization code dengan PKCE) untuk orang tua. Mati dan tidak terlihat sampai
 * KIRA_GOOGLE_CLIENT_ID dan KIRA_GOOGLE_CLIENT_SECRET sama-sama diisi.
 * Modul ini hanya protokolnya: alur di cookie, tukar kode, dan pemeriksaan ID token. Tidak ada token yang disimpan atau
 * dicatat; access token dari Google tidak pernah dipakai. Keputusan akun ada di server/signup/google.ts.
 */
export const GOOGLE_SCOPES = 'openid email profile'
export const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback'
export const GOOGLE_FLOW_COOKIE = '__Host-kira.google-alur'
export const GOOGLE_PENDING_COOKIE = '__Host-kira.google-baru'
const FLOW_TTL_MS = 10 * 60 * 1000
const PENDING_TTL_MS = 15 * 60 * 1000
const FALLBACK_NAME = 'Orang tua'

export type GoogleConfig = { clientId: string; clientSecret: string; authorizeUrl: string; tokenUrl: string; jwksUrl: string; issuers: string[] }

export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.KIRA_GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.KIRA_GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null
  // Server OIDC palsu untuk tes dan uji lokal. Build produksi selalu memakai alamat Google.
  const fake = process.env.NODE_ENV !== 'production' ? process.env.KIRA_GOOGLE_TEST_OIDC?.trim() : undefined
  if (fake) return { clientId, clientSecret, authorizeUrl: `${fake}/authorize`, tokenUrl: `${fake}/token`, jwksUrl: `${fake}/jwks`, issuers: [fake] }
  return {
    clientId,
    clientSecret,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
  }
}

export const googleEnabled = (): boolean => googleConfig() !== null

/** Tombol tampil bila fitur aktif dan browser bukan WebView. Halaman pemanggilnya selalu dinamis. */
export async function googleButtonVisible(): Promise<boolean> {
  if (!googleEnabled()) return false
  return !isEmbeddedBrowser((await headers()).get('user-agent') ?? '')
}

// ---------------------------------------------------------------------------
// Cookie bertanda tangan

function seal(purpose: string, value: object): string {
  const body = Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${body}.${hmac(body, purpose)}`
}

function open<T extends { exp: number }>(purpose: string, raw: string | null, schema: z.ZodType<T>, now = Date.now()): T | null {
  if (!raw || raw.length > 4000) return null
  const dot = raw.indexOf('.')
  if (dot < 1) return null
  const body = raw.slice(0, dot)
  if (!safeEqual(raw.slice(dot + 1), hmac(body, purpose))) return null
  try {
    const parsed = schema.safeParse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')))
    return parsed.success && parsed.data.exp > now ? parsed.data : null
  } catch {
    return null
  }
}

const flowSchema = z.object({ state: z.string().min(20).max(100), nonce: z.string().min(20).max(100), verifier: z.string().min(43).max(128), next: z.string().max(300).nullable(), exp: z.number().int() }).strict()
export type GoogleFlow = z.infer<typeof flowSchema>

const pendingSchema = z.object({ sub: z.string().min(1).max(255), email: z.string().min(3).max(200), name: z.string().min(1).max(80), exp: z.number().int() }).strict()
export type GoogleClaims = Omit<z.infer<typeof pendingSchema>, 'exp'>

/** Mulai alur: state, nonce, dan verifier PKCE masuk cookie singkat, lalu kembalikan alamat persetujuan Google. */
export async function beginGoogleFlow(cfg: GoogleConfig, next: string | null): Promise<string> {
  const flow: GoogleFlow = { state: randomToken(32), nonce: randomToken(32), verifier: randomToken(48), next, exp: Date.now() + FLOW_TTL_MS }
  await writeCookie(GOOGLE_FLOW_COOKIE, seal('google-flow', flow), FLOW_TTL_MS)
  const url = new URL(cfg.authorizeUrl)
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: `${origin()}${GOOGLE_CALLBACK_PATH}`,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: createHash('sha256').update(flow.verifier).digest('base64url'),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString()
  return url.toString()
}

/** Ambil dan hapus cookie alur: satu cookie hanya berlaku untuk satu kali kembali dari Google. */
export async function takeGoogleFlow(): Promise<GoogleFlow | null> {
  const raw = await readCookie(GOOGLE_FLOW_COOKIE)
  if (raw) await clearCookie(GOOGLE_FLOW_COOKIE)
  return open('google-flow', raw, flowSchema)
}

/** Identitas yang sudah diperiksa, menunggu langkah persetujuan orang tua baru. Hanya sub, email, dan nama. */
export async function writePendingGoogle(claims: GoogleClaims): Promise<void> {
  await writeCookie(GOOGLE_PENDING_COOKIE, seal('google-pending', { sub: claims.sub, email: claims.email, name: claims.name, exp: Date.now() + PENDING_TTL_MS }), PENDING_TTL_MS)
}

export async function readPendingGoogle(): Promise<GoogleClaims | null> {
  const row = open('google-pending', await readCookie(GOOGLE_PENDING_COOKIE), pendingSchema)
  return row ? { sub: row.sub, email: row.email, name: row.name } : null
}

export const clearPendingGoogle = (): Promise<void> => clearCookie(GOOGLE_PENDING_COOKIE)

// ---------------------------------------------------------------------------
// Tukar kode dan periksa ID token

export type GoogleRefusal = 'exchange' | 'token' | 'nonce' | 'unverified'

/** Alasan penolakan. Pesan dan isi token tidak pernah dibawa, supaya aman masuk log. */
export class GoogleRefused extends Error {
  constructor(readonly reason: GoogleRefusal) {
    super(`google:${reason}`)
    this.name = 'GoogleRefused'
  }
}

/** Tukar kode di endpoint token. Hanya id_token yang diambil dari jawabannya. */
export async function exchangeCode(cfg: GoogleConfig, code: string, verifier: string): Promise<string> {
  let body: unknown
  try {
    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: `${origin()}${GOOGLE_CALLBACK_PATH}` }),
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new GoogleRefused('exchange')
    body = await res.json()
  } catch {
    throw new GoogleRefused('exchange')
  }
  const idToken = (body as { id_token?: unknown } | null)?.id_token
  if (typeof idToken !== 'string' || idToken.length > 8192) throw new GoogleRefused('exchange')
  return idToken
}

const jwksByUrl = new Map<string, JWTVerifyGetKey>()

function jwksFor(url: string): JWTVerifyGetKey {
  let set = jwksByUrl.get(url)
  if (!set) {
    set = createRemoteJWKSet(new URL(url), { timeoutDuration: 5000 })
    jwksByUrl.set(url, set)
  }
  return set
}

const claimsSchema = z.object({ sub: z.string().min(1).max(255), email: z.string().min(3).max(200) })

/** Nama dari Google hanya dipakai untuk tampilan. Karakter kontrol dibuang; nama kosong atau terlalu pendek diganti. */
export function cleanGoogleName(raw: unknown): string {
  if (typeof raw !== 'string') return FALLBACK_NAME
  // eslint-disable-next-line no-control-regex -- justru karakter kontrol yang dibuang
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80).trim()
  return name.length >= 2 ? name : FALLBACK_NAME
}

/**
 * Tanda tangan terhadap JWKS Google, algoritma RS256, aud, iss, exp, dan azp bila ada, lalu nonce dari cookie alur.
 * email_verified harus benar-benar true: tanpa itu, email belum terbukti milik orang yang masuk.
 */
export async function verifyIdToken(cfg: GoogleConfig, idToken: string, nonce: string): Promise<GoogleClaims> {
  let payload: JWTPayload
  try {
    const verified = await jwtVerify(idToken, jwksFor(cfg.jwksUrl), { issuer: cfg.issuers, audience: cfg.clientId, algorithms: ['RS256'], requiredClaims: ['sub', 'email', 'exp', 'iat'] })
    payload = verified.payload
  } catch {
    throw new GoogleRefused('token')
  }
  if (payload.azp !== undefined && payload.azp !== cfg.clientId) throw new GoogleRefused('token')
  if (typeof payload.nonce !== 'string' || !safeEqual(payload.nonce, nonce)) throw new GoogleRefused('nonce')
  if (payload.email_verified !== true) throw new GoogleRefused('unverified')
  const parsed = claimsSchema.safeParse(payload)
  if (!parsed.success) throw new GoogleRefused('token')
  return { sub: parsed.data.sub, email: parsed.data.email, name: cleanGoogleName(payload.name) }
}
