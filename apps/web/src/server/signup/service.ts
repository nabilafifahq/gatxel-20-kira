import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { tables } from '@kira/db'
import { authDb } from '../db'
import { env, origin } from '../env'
import { AppError, invalid } from '../errors'
import { log } from '../log'
import { NOTICE_VERSION, TERMS_VERSION } from '../auth/accounts'
import { randomToken, sha256hex } from '../auth/crypto'
import { hashSecret, passwordProblem } from '../auth/password'
import { signupExistingEmail, signupVerifyEmail, waitlistConfirmEmail, waitlistWelcomeEmail } from '@kira/core/email-templates'
import { queuePublicMail } from '../dal/outbox'
import { emailIdentity } from '../email'
import { emailSendAllowed } from '../auth/ratelimit'
import { audit } from '../audit'
import { checkEmail, emailKey } from './email-policy'
import { TERMS_MESSAGE } from '@/lib/required-rules'

const { signup, userAccount, waitlist } = tables

export const SIGNUP_TTL_MS = 24 * 3600 * 1000
export const RESEND_GAP_MS = 60 * 1000
export const RESEND_MAX = 5

export const WAITLIST_CONSENT_TEXT = 'Saya setuju dikabari lewat email saat kursi beta Kira dibuka lagi, dan kabar singkat tentang Kira. Saya bisa berhenti kapan saja.'

/** Teks terpisah dari kode supaya halaman dan pengujian membaca satu sumber. */
export type SeatInfo = { total: number; taken: number; left: number; full: boolean }

export async function seatInfo(): Promise<SeatInfo> {
  const rows = await authDb().execute(sql`select kira_seats_taken() as n`)
  const taken = Number((rows as unknown as { n: number }[])[0]?.n ?? 0)
  const total = env().KIRA_BETA_SEATS
  const left = Math.max(0, total - taken)
  return { total, taken, left, full: left <= 0 }
}

export const SEATS_FULL_MESSAGE = 'Kursi beta sudah penuh. Tinggalkan email di daftar tunggu, nanti kami kabari saat kursi dibuka lagi.'

const verifyUrl = (token: string) => `${origin()}/daftar/konfirmasi/${token}`
export const unsubscribeUrl = (token: string) => `${origin()}/kabar/berhenti/${token}`
const unsubscribeApiUrl = (token: string) => `${origin()}/api/kabar/berhenti/${token}`

async function emailTaken(emailNorm: string, emailLower: string): Promise<boolean> {
  const rows = await authDb()
    .select({ id: userAccount.id })
    .from(userAccount)
    .where(sql`${userAccount.emailNorm} = ${emailNorm} or lower(${userAccount.email}) = ${emailLower}`)
    .limit(1)
  return Boolean(rows[0])
}

async function sendVerification(to: string, token: string): Promise<void> {
  if (!emailSendAllowed('verify', to)) return
  const mail = signupVerifyEmail(emailIdentity(), { url: verifyUrl(token) })
  await queuePublicMail({ to, ...mail, kind: 'signup-verify' })
}

async function sendAlreadyHaveAccount(to: string): Promise<void> {
  if (!emailSendAllowed('verify', to)) return
  const mail = signupExistingEmail(emailIdentity(), { loginUrl: `${origin()}/masuk` })
  await queuePublicMail({ to, ...mail, kind: 'signup-existing' })
}

/**
 * Mulai pendaftaran: simpan pendaftar yang belum terverifikasi dan kirim email konfirmasi.
 * Pemanggil menampilkan jawaban yang sama apa pun hasilnya, supaya tidak membocorkan email yang sudah terdaftar.
 * Melempar hanya untuk kesalahan yang aman ditampilkan: bentuk, email sekali pakai, password lemah, kursi penuh.
 */
export async function startSignup(input: { name: string; email: string; password: string; consent: boolean; marketing?: boolean; ipHash: string }): Promise<void> {
  if (input.consent !== true) throw invalid(TERMS_MESSAGE, { consent: TERMS_MESSAGE })
  const name = input.name.trim()
  if (name.length < 2 || name.length > 80) throw invalid('Tulis nama orang tua, 2 sampai 80 huruf.', { name: 'Tulis nama orang tua, 2 sampai 80 huruf.' })
  const verdict = await checkEmail(input.email)
  if (!verdict.ok) throw invalid(verdict.message, { email: verdict.message })
  const problem = await passwordProblem(input.password, { email: verdict.email, name })
  if (problem) throw invalid(problem, { password: problem })
  if ((await seatInfo()).full) throw new AppError('unavailable', SEATS_FULL_MESSAGE)

  // Hash dihitung di semua cabang supaya waktu respons tidak membedakan email yang sudah terdaftar.
  const passwordHash = await hashSecret(input.password)
  if (await emailTaken(verdict.key, verdict.email)) {
    await sendAlreadyHaveAccount(verdict.email)
    return
  }
  const token = randomToken(32)
  const now = new Date()
  // Hanya true yang dihitung setuju. Pilihan terbaru menggantikan pilihan di pendaftaran sebelumnya.
  const marketing = { marketingOptIn: input.marketing === true, marketingOptInAt: input.marketing === true ? now : null }
  const existing = (await authDb().select({ lastSentAt: signup.lastSentAt }).from(signup).where(eq(signup.emailNorm, verdict.key)).limit(1))[0]
  if (existing && now.getTime() - existing.lastSentAt.getTime() < RESEND_GAP_MS) return
  await authDb()
    .insert(signup)
    .values({
      email: verdict.email,
      emailNorm: verdict.key,
      name,
      passwordHash,
      tokenHash: sha256hex(token),
      expiresAt: new Date(now.getTime() + SIGNUP_TTL_MS),
      termsVersion: TERMS_VERSION,
      noticeVersion: NOTICE_VERSION,
      ipHash: input.ipHash,
      ...marketing,
    })
    .onConflictDoUpdate({
      target: signup.emailNorm,
      set: { email: verdict.email, name, passwordHash, tokenHash: sha256hex(token), expiresAt: new Date(now.getTime() + SIGNUP_TTL_MS), termsVersion: TERMS_VERSION, noticeVersion: NOTICE_VERSION, ipHash: input.ipHash, ...marketing, lastSentAt: now, sentCount: sql`${signup.sentCount} + 1` },
    })
  await sendVerification(verdict.email, token)
}

/** Kirim ulang email konfirmasi. Diam bila tidak ada pendaftar, terlalu sering, atau sudah lima kali. */
export async function resendVerification(emailRaw: string): Promise<void> {
  const verdict = await checkEmail(emailRaw)
  if (!verdict.ok) throw invalid(verdict.message, { email: verdict.message })
  const row = (await authDb().select().from(signup).where(eq(signup.emailNorm, verdict.key)).limit(1))[0]
  if (!row) {
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 200))
    return
  }
  const now = new Date()
  if (now.getTime() - row.lastSentAt.getTime() < RESEND_GAP_MS || row.sentCount >= RESEND_MAX) return
  // Cek batas email sebelum memutar token: tanpa email baru, tautan lama harus tetap berlaku.
  if (!emailSendAllowed('verify', row.email)) return
  const token = randomToken(32)
  await authDb()
    .update(signup)
    .set({ tokenHash: sha256hex(token), expiresAt: new Date(now.getTime() + SIGNUP_TTL_MS), lastSentAt: now, sentCount: sql`${signup.sentCount} + 1` })
    .where(eq(signup.id, row.id))
  await sendVerification(row.email, token)
}

/** True bila email ini menunggu konfirmasi (dipakai untuk pesan ramah di halaman masuk). Tidak dipakai di jawaban publik. */
export async function hasPendingSignup(emailRaw: string): Promise<boolean> {
  const rows = await authDb().select({ id: signup.id }).from(signup).where(eq(signup.emailNorm, emailKey(emailRaw))).limit(1)
  return Boolean(rows[0])
}

export type VerifyOutcome = { status: 'ok'; userId: string; orgId: string } | { status: 'full' | 'invalid' | 'taken' }

/**
 * Verifikasi token: buat keluarga dan ambil kursi sekaligus, di bawah kunci database.
 * Keputusan pemilik untuk pilot: tautan di email cukup, tanpa memasukkan password lagi. Risiko sisa: orang lain
 * mendaftar dengan email korban memakai password-nya sendiri, dan korban menekan tautan yang tidak dia minta
 * (pre-hijack). Emailnya meminta mengabaikan tautan bila bukan dia yang mendaftar.
 */
export async function verifySignup(token: string): Promise<VerifyOutcome> {
  if (token.length < 20 || token.length > 100) return { status: 'invalid' }
  const rows = await authDb().execute(sql`select status, user_id, org_id from kira_verify_signup(${sha256hex(token)}, ${env().KIRA_BETA_SEATS})`)
  const r = (rows as unknown as { status: string; user_id: string | null; org_id: string | null }[])[0]
  if (r?.status === 'ok' && r.user_id && r.org_id) return { status: 'ok', userId: r.user_id, orgId: r.org_id }
  if (r?.status === 'full' || r?.status === 'taken') return { status: r.status }
  return { status: 'invalid' }
}

/** Apakah token konfirmasi masih berlaku (tanpa memakainya). */
export async function signupTokenValid(token: string): Promise<boolean> {
  if (token.length < 20 || token.length > 100) return false
  const rows = await authDb().select({ id: signup.id }).from(signup).where(and(eq(signup.tokenHash, sha256hex(token)), sql`${signup.expiresAt} > now()`)).limit(1)
  return Boolean(rows[0])
}

// ---------------------------------------------------------------------------
// Daftar tunggu kabar

function waitlistMail(kind: 'confirm' | 'welcome', to: string, token: string) {
  if (kind === 'confirm' && !emailSendAllowed('waitlist', to)) return Promise.resolve()
  const id = emailIdentity()
  const unsub = unsubscribeUrl(token)
  const mail = kind === 'confirm' ? waitlistConfirmEmail(id, { url: `${origin()}/kabar/konfirmasi/${token}`, unsubscribeUrl: unsub }) : waitlistWelcomeEmail(id, { unsubscribeUrl: unsub })
  return queuePublicMail({
    to,
    ...mail,
    kind: kind === 'confirm' ? 'waitlist-confirm' : 'waitlist-welcome',
    listUnsubscribe: unsubscribeApiUrl(token),
  })
}

/** Gabung daftar tunggu. Jawaban publik selalu sama; alamat yang sudah punya akun atau sudah terdaftar tidak dibocorkan. */
export async function joinWaitlist(input: { email: string; consent: boolean }): Promise<void> {
  if (!input.consent) throw invalid('Centang persetujuan untuk dikabari.', { consent: 'Centang persetujuan untuk dikabari.' })
  const verdict = await checkEmail(input.email)
  if (!verdict.ok) throw invalid(verdict.message, { email: verdict.message })
  if (await emailTaken(verdict.key, verdict.email)) return
  const existing = (await authDb().select().from(waitlist).where(eq(waitlist.emailNorm, verdict.key)).limit(1))[0]
  if (existing && !existing.unsubscribedAt) {
    // Sudah terdaftar. Bila belum dikonfirmasi, kirim ulang konfirmasi (maksimal sekali per menit lewat throttle IP).
    if (!existing.confirmedAt) await waitlistMail('confirm', existing.email, existing.token)
    return
  }
  const token = randomToken(24)
  if (existing) {
    await authDb().update(waitlist).set({ email: verdict.email, token, unsubscribedAt: null, confirmedAt: null, invitedAt: null, consentText: WAITLIST_CONSENT_TEXT, consentedAt: new Date(), source: 'form' }).where(eq(waitlist.id, existing.id))
  } else {
    await authDb().insert(waitlist).values({ email: verdict.email, emailNorm: verdict.key, token, source: 'form', consentText: WAITLIST_CONSENT_TEXT }).onConflictDoNothing()
  }
  await waitlistMail('confirm', verdict.email, token)
}

export async function confirmWaitlist(token: string): Promise<boolean> {
  if (token.length < 20 || token.length > 100) return false
  const row = (await authDb().select().from(waitlist).where(and(eq(waitlist.token, token), sql`${waitlist.unsubscribedAt} is null`)).limit(1))[0]
  if (!row) return false
  if (row.confirmedAt) return true
  await authDb().update(waitlist).set({ confirmedAt: new Date() }).where(eq(waitlist.id, row.id))
  try {
    await waitlistMail('welcome', row.email, row.token)
  } catch (e) {
    log.error('email selamat datang daftar tunggu gagal masuk antrean', { error: e })
  }
  return true
}

/** Berhenti berlangganan. Idempotent. Mengembalikan false bila tautan tidak dikenal. */
export async function unsubscribeWaitlist(token: string): Promise<boolean> {
  if (token.length < 20 || token.length > 100) return false
  const rows = await authDb()
    .update(waitlist)
    .set({ unsubscribedAt: sql`coalesce(${waitlist.unsubscribedAt}, now())` })
    .where(eq(waitlist.token, token))
    .returning({ id: waitlist.id })
  return rows.length > 0
}

/**
 * Tautan berhenti di /kabar/berhenti: token daftar tunggu atau token email kabar di akun. Idempotent.
 * Hanya menghentikan email kabar; laporan belajar dan email akun tidak terpengaruh.
 */
export async function unsubscribeByToken(token: string): Promise<'waitlist' | 'account' | null> {
  if (await unsubscribeWaitlist(token)) return 'waitlist'
  if (token.length < 20 || token.length > 100) return null
  const [row] = await authDb().select({ id: userAccount.id, orgId: userAccount.orgId, role: userAccount.role, optIn: userAccount.marketingOptIn }).from(userAccount).where(eq(userAccount.marketingToken, token)).limit(1)
  if (!row) return null
  if (row.optIn) {
    await authDb().update(userAccount).set({ marketingOptIn: false, marketingWithdrawnAt: new Date() }).where(eq(userAccount.id, row.id))
    await audit({ orgId: row.orgId, userId: row.id, role: row.role === 'tutor' ? 'tutor' : 'guardian' }, 'marketing.withdrawn', row.id, { via: 'link' })
  }
  return 'account'
}
