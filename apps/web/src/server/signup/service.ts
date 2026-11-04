import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { tables } from '@kira/db'
import { authDb } from '../db'
import { env, origin } from '../env'
import { AppError, invalid } from '../errors'
import { log } from '../log'
import { NOTICE_VERSION, TERMS_VERSION } from '../auth/accounts'
import { randomToken, sha256hex } from '../auth/crypto'
import { burnVerify, hashSecret, passwordProblem, verifySecret } from '../auth/password'
import { signupActivatedEmail, signupExistingEmail, signupVerifyEmail, waitlistConfirmEmail, waitlistWelcomeEmail } from '@kira/core/email-templates'
import { queuePublicMail } from '../dal/outbox'
import { emailIdentity } from '../email'
import { emailSendAllowed } from '../auth/ratelimit'
import { checkEmail, emailKey } from './email-policy'

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

/** Pemanggil sudah mengecek batas email sebelum memutar token, supaya tautan lama tidak mati tanpa email baru. */
async function sendVerification(to: string, token: string): Promise<void> {
  const mail = signupVerifyEmail(emailIdentity(), { url: verifyUrl(token) })
  await queuePublicMail({ to, ...mail, kind: 'signup-verify' })
}

async function sendAlreadyHaveAccount(to: string): Promise<void> {
  if (!emailSendAllowed('verify', to)) return
  const mail = signupExistingEmail(emailIdentity(), { loginUrl: `${origin()}/masuk` })
  await queuePublicMail({ to, ...mail, kind: 'signup-existing' })
}

/** Kabar untuk pemilik email yang tidak merasa mendaftar. Akun tetap aktif bila email ini gagal masuk antrean. */
async function sendActivated(to: string): Promise<void> {
  try {
    const mail = signupActivatedEmail(emailIdentity(), { loginUrl: `${origin()}/masuk` })
    await queuePublicMail({ to, ...mail, kind: 'signup-active' })
  } catch (e) {
    log.error('email akun aktif gagal masuk antrean', { error: e })
  }
}

type PendingSignup = typeof signup.$inferSelect

async function pendingSignup(emailNorm: string): Promise<PendingSignup | undefined> {
  return (await authDb().select().from(signup).where(and(eq(signup.emailNorm, emailNorm), sql`${signup.expiresAt} > now()`)).limit(1))[0]
}

/** Putar token dan kirim email baru, kecuali terlalu cepat atau batas email habis. Tanpa email baru, tautan lama tetap berlaku. */
async function rotateAndSend(row: PendingSignup): Promise<void> {
  const now = new Date()
  if (now.getTime() - row.lastSentAt.getTime() < RESEND_GAP_MS) return
  if (!emailSendAllowed('verify', row.email)) return
  const token = randomToken(32)
  await authDb()
    .update(signup)
    .set({ tokenHash: sha256hex(token), expiresAt: new Date(now.getTime() + SIGNUP_TTL_MS), lastSentAt: now, sentCount: sql`${signup.sentCount} + 1` })
    .where(eq(signup.id, row.id))
  await sendVerification(row.email, token)
}

/**
 * Pendaftaran kedua untuk email yang masih menunggu. Password dan nama yang tersimpan tidak pernah ditimpa, karena
 * tidak ada cara mengetahui pendaftar mana pemilik email. Password sama: sama dengan kirim ulang. Password berbeda: baris
 * diberi tanda supaya tautan meminta password baru. Tanda dipasang sebelum pemeriksaan jeda dan batas email, karena
 * tautan yang sudah terkirim juga harus berhenti mengaktifkan akun dengan password tersimpan. Tanda tidak pernah dicabut:
 * mengulang password yang tersimpan tidak membuktikan apa pun.
 */
async function repeatSignup(row: PendingSignup, samePassword: boolean): Promise<void> {
  if (samePassword) {
    if (row.sentCount < RESEND_MAX) await rotateAndSend(row)
    return
  }
  if (!row.conflict) await authDb().update(signup).set({ conflict: true }).where(eq(signup.id, row.id))
  await rotateAndSend(row)
}

/**
 * Mulai pendaftaran: simpan pendaftar yang belum terverifikasi dan kirim email konfirmasi.
 * Pemanggil menampilkan jawaban yang sama apa pun hasilnya, supaya tidak membocorkan email yang sudah terdaftar.
 * Melempar hanya untuk kesalahan yang aman ditampilkan: bentuk, email sekali pakai, password lemah, kursi penuh.
 */
export async function startSignup(input: { name: string; email: string; password: string; consent: boolean; ipHash: string }): Promise<void> {
  if (!input.consent) throw invalid('Centang persetujuan untuk melanjutkan.', { consent: 'Centang persetujuan untuk melanjutkan.' })
  const name = input.name.trim()
  if (name.length < 2 || name.length > 80) throw invalid('Tulis nama orang tua, 2 sampai 80 huruf.', { name: 'Tulis nama orang tua, 2 sampai 80 huruf.' })
  const verdict = await checkEmail(input.email)
  if (!verdict.ok) throw invalid(verdict.message, { email: verdict.message })
  const problem = await passwordProblem(input.password, { email: verdict.email, name })
  if (problem) throw invalid(problem, { password: problem })
  if ((await seatInfo()).full) throw new AppError('unavailable', SEATS_FULL_MESSAGE)

  // Satu hash dan satu verifikasi dihitung di semua cabang supaya waktu respons tidak membedakan email yang sudah
  // terdaftar atau sedang menunggu konfirmasi.
  const passwordHash = await hashSecret(input.password)
  const pending = await pendingSignup(verdict.key)
  let samePassword = false
  if (pending) samePassword = await verifySecret(pending.passwordHash, input.password)
  else await burnVerify(input.password)
  if (await emailTaken(verdict.key, verdict.email)) {
    await sendAlreadyHaveAccount(verdict.email)
    return
  }
  if (pending) {
    await repeatSignup(pending, samePassword)
    return
  }
  if (!emailSendAllowed('verify', verdict.email)) return
  const token = randomToken(32)
  const now = new Date()
  // Baris yang sudah kedaluwarsa boleh ditimpa utuh. Baris yang masih berlaku tidak pernah ditimpa di sini.
  const written = await authDb()
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
    })
    .onConflictDoUpdate({
      target: signup.emailNorm,
      set: { email: verdict.email, name, passwordHash, tokenHash: sha256hex(token), expiresAt: new Date(now.getTime() + SIGNUP_TTL_MS), termsVersion: TERMS_VERSION, noticeVersion: NOTICE_VERSION, ipHash: input.ipHash, lastSentAt: now, sentCount: 1, conflict: false },
      where: sql`${signup.expiresAt} <= now()`,
    })
    .returning({ id: signup.id })
  if (written[0]) {
    await sendVerification(verdict.email, token)
    return
  }
  // Kalah balapan dengan pendaftaran lain untuk email yang sama: perlakukan sebagai pendaftaran kedua.
  const raced = await pendingSignup(verdict.key)
  if (raced) await repeatSignup(raced, await verifySecret(raced.passwordHash, input.password))
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
  if (row.sentCount >= RESEND_MAX) return
  await rotateAndSend(row)
}

/** True bila email ini menunggu konfirmasi (dipakai untuk pesan ramah di halaman masuk). Tidak dipakai di jawaban publik. */
export async function hasPendingSignup(emailRaw: string): Promise<boolean> {
  const rows = await authDb().select({ id: signup.id }).from(signup).where(eq(signup.emailNorm, emailKey(emailRaw))).limit(1)
  return Boolean(rows[0])
}

export type VerifyOutcome = { status: 'ok'; userId: string; orgId: string } | { status: 'full' | 'invalid' | 'taken' | 'needs-password' }

/**
 * Verifikasi token: buat keluarga dan ambil kursi sekaligus, di bawah kunci database.
 * Keputusan pemilik untuk pilot: tautan di email cukup, tanpa memasukkan password lagi. Pengecualiannya pendaftar
 * bertanda conflict: pemegang tautan membuat password baru, dan password itu dipasang di transaksi yang sama dengan
 * pembuatan akun, jadi semua password dari formulir daftar mati. Risiko sisa ada di docs/laporan-keamanan.md.
 */
export async function verifySignup(token: string, newPassword?: string): Promise<VerifyOutcome> {
  if (token.length < 20 || token.length > 100) return { status: 'invalid' }
  const tokenHash = sha256hex(token)
  const row = (await authDb().select({ email: signup.email, name: signup.name, conflict: signup.conflict }).from(signup).where(and(eq(signup.tokenHash, tokenHash), sql`${signup.expiresAt} > now()`)).limit(1))[0]
  if (!row) return { status: 'invalid' }
  let newHash: string | null = null
  if (row.conflict) {
    if (newPassword === undefined) return { status: 'needs-password' }
    const problem = await passwordProblem(newPassword, { email: row.email, name: row.name })
    if (problem) throw invalid(problem, { password: problem })
    newHash = await hashSecret(newPassword)
  }
  const rows = await authDb().execute(sql`select status, user_id, org_id from kira_verify_signup(${tokenHash}, ${env().KIRA_BETA_SEATS}, ${newHash}::text)`)
  const r = (rows as unknown as { status: string; user_id: string | null; org_id: string | null }[])[0]
  if (r?.status === 'ok' && r.user_id && r.org_id) {
    await sendActivated(row.email)
    return { status: 'ok', userId: r.user_id, orgId: r.org_id }
  }
  if (r?.status === 'full' || r?.status === 'taken' || r?.status === 'needs-password') return { status: r.status }
  return { status: 'invalid' }
}

/** Keadaan tautan konfirmasi tanpa memakainya: tidak berlaku, langsung aktif, atau meminta password baru dulu. */
export async function signupTokenState(token: string): Promise<'invalid' | 'direct' | 'needs-password'> {
  if (token.length < 20 || token.length > 100) return 'invalid'
  const rows = await authDb().select({ conflict: signup.conflict }).from(signup).where(and(eq(signup.tokenHash, sha256hex(token)), sql`${signup.expiresAt} > now()`)).limit(1)
  if (!rows[0]) return 'invalid'
  return rows[0].conflict ? 'needs-password' : 'direct'
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
