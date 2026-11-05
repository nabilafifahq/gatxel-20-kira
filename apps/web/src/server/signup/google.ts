import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { splitEmail } from '@kira/core/email'
import { signupActivatedEmail } from '@kira/core/email-templates'
import { tables } from '@kira/db'
import { audit } from '../audit'
import { homeFor, safeNext } from '../auth/actor'
import { NOTICE_VERSION, normaliseEmail, TERMS_VERSION } from '../auth/accounts'
import { ipHash, safeEqual } from '../auth/crypto'
import { clientIp } from '../auth/ratelimit'
import { exchangeCode, GoogleRefused, takeGoogleFlow, verifyIdToken, writePendingGoogle, type GoogleClaims, type GoogleConfig } from '../auth/google'
import { startSession } from '../auth/session'
import { authDb } from '../db'
import { queuePublicMail } from '../dal/outbox'
import { emailIdentity } from '../email'
import { env, origin } from '../env'
import { log } from '../log'
import { checkEmail, emailKey, type MxResolver } from './email-policy'
import { seatInfo } from './service'

const { googleIdentity, signup, userAccount } = tables

/**
 * Keputusan akun setelah Google membuktikan email: tautkan dan masuk, atau tahan untuk langkah persetujuan orang tua baru.
 * Hanya orang tua yang bisa dibuat lewat jalur ini. Tutor boleh masuk bila akunnya sudah ada; anak tidak pernah.
 */
export type GoogleUser = { id: string; orgId: string; role: 'tutor' | 'guardian' }
type GoogleDecline = 'full' | 'other-account' | 'disabled' | 'not-adult' | 'use-password' | 'disposable' | 'no-mx' | 'shape'
export type GoogleResolution = { status: 'signed-in'; user: GoogleUser; linked: boolean } | { status: 'new' } | { status: GoogleDecline }

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])

/**
 * Bentuk baku email juga membuang +tag di semua domain, tetapi di luar Gmail tidak ada jaminan a+b@x dan a@x kotak surat
 * yang sama. Bukti dari Google berlaku untuk alamat persisnya, jadi di luar Gmail hanya alamat persis yang boleh ditautkan.
 */
function sameMailbox(accountEmail: string | null, googleEmail: string): boolean {
  if (accountEmail && normaliseEmail(accountEmail) === googleEmail) return true
  const domain = splitEmail(googleEmail)?.domain
  return domain !== undefined && GMAIL_DOMAINS.has(domain)
}

/** Pendaftar menunggu dengan email ini dibuang, tidak pernah diaktifkan: password tersimpannya bisa berasal dari orang lain. */
async function discardPendingSignup(email: string): Promise<void> {
  await authDb().delete(signup).where(eq(signup.emailNorm, emailKey(email)))
}

type AccountRow = { id: string; orgId: string; kind: 'adult' | 'learner'; role: 'tutor' | 'guardian' | 'learner'; email: string | null; disabledAt: Date | null }
const accountColumns = { id: userAccount.id, orgId: userAccount.orgId, kind: userAccount.kind, role: userAccount.role, email: userAccount.email, disabledAt: userAccount.disabledAt }

function usable(row: AccountRow): { status: 'not-adult' | 'disabled' } | GoogleUser {
  if (row.kind !== 'adult' || row.role === 'learner') return { status: 'not-adult' }
  if (row.disabledAt) return { status: 'disabled' }
  return { id: row.id, orgId: row.orgId, role: row.role }
}

export async function resolveGoogleSignIn(claims: GoogleClaims, opts: { resolver?: MxResolver } = {}): Promise<GoogleResolution> {
  const email = normaliseEmail(claims.email)
  const linked = (await authDb().select(accountColumns).from(googleIdentity).innerJoin(userAccount, eq(googleIdentity.userId, userAccount.id)).where(eq(googleIdentity.sub, claims.sub)).limit(1))[0]
  if (linked) {
    const user = usable(linked)
    if ('status' in user) return user
    await discardPendingSignup(email)
    return { status: 'signed-in', user, linked: false }
  }
  // Alamat persis menang atas bentuk bakunya bila keduanya cocok dengan akun berbeda (akun lama).
  const account = (
    await authDb()
      .select(accountColumns)
      .from(userAccount)
      .where(sql`lower(${userAccount.email}) = ${email} or ${userAccount.emailNorm} = ${emailKey(email)}`)
      .orderBy(sql`(lower(${userAccount.email}) = ${email}) desc`)
      .limit(1)
  )[0]
  if (account) {
    const user = usable(account)
    if ('status' in user) return user
    if (!sameMailbox(account.email, email)) return { status: 'use-password' }
    await authDb().insert(googleIdentity).values({ sub: claims.sub, userId: user.id }).onConflictDoNothing()
    // Baca lagi: akun yang sudah tertaut ke sub lain ditolak, juga bila dua permintaan balapan.
    const bound = (await authDb().select({ sub: googleIdentity.sub }).from(googleIdentity).where(and(eq(googleIdentity.userId, user.id), eq(googleIdentity.sub, claims.sub))).limit(1))[0]
    if (!bound) return { status: 'other-account' }
    await discardPendingSignup(email)
    return { status: 'signed-in', user, linked: true }
  }
  const verdict = await checkEmail(email, opts)
  if (!verdict.ok) return { status: verdict.reason }
  if ((await seatInfo()).full) return { status: 'full' }
  return { status: 'new' }
}

export type GoogleSignupOutcome = { status: 'ok'; userId: string; orgId: string } | { status: 'full' | 'taken' | 'disposable' | 'no-mx' | 'shape' }

/** Buat keluarga dan ambil kursi di bawah kunci yang sama dengan verifikasi email. Persetujuan sudah diperiksa pemanggil. */
export async function completeGoogleSignup(input: { claims: GoogleClaims; marketing: boolean; ipHash: string; resolver?: MxResolver }): Promise<GoogleSignupOutcome> {
  const verdict = await checkEmail(input.claims.email, { resolver: input.resolver })
  if (!verdict.ok) return { status: verdict.reason }
  const rows = await authDb().execute(
    sql`select status, user_id, org_id from kira_google_signup(${input.claims.sub}, ${verdict.email}, ${verdict.key}, ${input.claims.name}, ${env().KIRA_BETA_SEATS}, ${TERMS_VERSION}, ${NOTICE_VERSION}, ${input.ipHash}, ${input.marketing === true})`,
  )
  const r = (rows as unknown as { status: string; user_id: string | null; org_id: string | null }[])[0]
  if (r?.status === 'ok' && r.user_id && r.org_id) {
    try {
      const mail = signupActivatedEmail(emailIdentity(), { loginUrl: `${origin()}/masuk` })
      await queuePublicMail({ to: verdict.email, ...mail, kind: 'signup-active' })
    } catch (e) {
      log.error('email akun aktif gagal masuk antrean', { error: e })
    }
    return { status: 'ok', userId: r.user_id, orgId: r.org_id }
  }
  return { status: r?.status === 'full' ? 'full' : 'taken' }
}

export const GOOGLE_FAILED = '/masuk?notice=google-failed'
const DECLINE_PATH: Record<GoogleDecline, string> = {
  full: '/daftar',
  'other-account': '/masuk?notice=google-other-account',
  disabled: '/masuk?notice=google-disabled',
  'not-adult': '/masuk?notice=google-not-adult',
  'use-password': '/masuk?notice=google-use-password',
  disposable: '/masuk?notice=google-disposable',
  'no-mx': '/masuk?notice=google-no-mail',
  shape: '/masuk?notice=google-no-mail',
}

export function googleConsentPath(status: GoogleSignupOutcome['status']): string {
  if (status === 'ok') return '/mulai'
  return status === 'taken' ? '/masuk?notice=google-taken' : DECLINE_PATH[status]
}

const callbackSchema = z
  .object({
    state: z.string().min(1).max(200),
    code: z.string().min(1).max(2048).optional(),
    error: z.string().min(1).max(100).optional(),
  })
  .strict()

const pick = (params: URLSearchParams, key: string) => params.get(key) ?? undefined

/**
 * Kembali dari Google. Mengembalikan alamat tujuan lokal. CSRF dijaga state dari cookie alur; nonce mengikat ID token ke alur ini.
 * Google menambah parameter lain (scope, authuser, hd, prompt), jadi hanya tiga yang dipakai yang diambil lalu diperiksa ketat.
 */
export async function googleCallback(cfg: GoogleConfig, params: URLSearchParams, opts: { resolver?: MxResolver } = {}): Promise<string> {
  const flow = await takeGoogleFlow()
  const query = callbackSchema.safeParse({ state: pick(params, 'state'), code: pick(params, 'code'), error: pick(params, 'error') })
  if (!flow || !query.success || !safeEqual(query.data.state, flow.state)) {
    log.warn('keamanan: masuk Google ditolak', { event: 'google.refused', reason: 'state' })
    return GOOGLE_FAILED
  }
  if (query.data.error) return query.data.error === 'access_denied' ? '/masuk?notice=google-cancelled' : GOOGLE_FAILED
  if (!query.data.code) return GOOGLE_FAILED
  let claims: GoogleClaims
  try {
    claims = await verifyIdToken(cfg, await exchangeCode(cfg, query.data.code, flow.verifier), flow.nonce)
  } catch (e) {
    const reason = e instanceof GoogleRefused ? e.reason : 'unknown'
    log.warn('keamanan: masuk Google ditolak', { event: 'google.refused', reason })
    return reason === 'unverified' ? '/masuk?notice=google-unverified' : GOOGLE_FAILED
  }
  const result = await resolveGoogleSignIn(claims, opts)
  if (result.status === 'new') {
    await writePendingGoogle(claims)
    return '/daftar/google'
  }
  if (result.status !== 'signed-in') {
    log.info('masuk Google tidak dilanjutkan', { event: 'google.declined', reason: result.status })
    return DECLINE_PATH[result.status]
  }
  const { user, linked } = result
  await startSession({ id: user.id, orgId: user.orgId, kind: 'adult' })
  await authDb().update(userAccount).set({ lastLoginAt: new Date(), failedLogins: 0 }).where(eq(userAccount.id, user.id))
  const ctx = { orgId: user.orgId, userId: user.id, role: user.role }
  if (linked) await audit(ctx, 'google.linked', user.id, { ipHash: ipHash(await clientIp()) })
  await audit(ctx, 'login.google', user.id)
  return safeNext(flow.next, homeFor(user.role))
}
