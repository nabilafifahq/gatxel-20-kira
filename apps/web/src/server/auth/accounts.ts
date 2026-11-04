import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import { tables } from '@kira/db'
import { authDb, inOrg } from '../db'
import { env, origin } from '../env'
import { AppError, conflict, invalid, notFound } from '../errors'
import { auditTx, systemCtx } from '../audit'
import { inviteEmail, passwordResetEmail } from '@kira/core/email-templates'
import { queueEmail } from '../dal/outbox'
import { emailIdentity } from '../email'
import { burnVerify, hashSecret, passwordProblem, verifySecret } from './password'
import { ACCOUNT_LOCK_AFTER, clientIp, emailSendAllowed, escalatingDelay, recentFailures, recordAttempt, releaseFailure, reserveFailure, throttleIp } from './ratelimit'
import { ipPrefix } from '@/lib/access-log'
import { log } from '../log'
import { randomToken, safeEqual, sha256hex } from './crypto'
import { invalidateUserSessions, revokeUserSessions } from './session'
import { setPin } from './pin'
import { emailKey } from '../signup/email-policy'
import type { UiLang } from '@/lib/i18n/lang'

const { userAccount, invite, resetToken, signup } = tables

export const TERMS_VERSION = '2026-11-04'
/**
 * Versi yang tercatat di setiap persetujuan, jadi harus berubah setiap kali isi kebijakan berubah, juga di hari yang sama.
 * Orang tua yang setuju sebelum baris email kabar produk ditambahkan tetap tercatat pada 2026-11-05.
 */
export const NOTICE_VERSION = '2026-11-05.2'

const GENERIC_LOGIN_ERROR = 'Email atau password belum cocok. Periksa lagi, atau pakai Lupa password.'

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Akun dewasa dari alamat yang diketik: bentuk yang didaftarkan atau bentuk bakunya (titik dan +tag Gmail).
 * Kalau keduanya cocok dengan akun berbeda (akun lama), yang persis sama menang.
 */
const adultByEmail = (email: string) => sql`(lower(${userAccount.email}) = ${email} or ${userAccount.emailNorm} = ${emailKey(email)})`
const exactEmailFirst = (email: string) => sql`(lower(${userAccount.email}) = ${email}) desc`
const loginKey = (email: string) => `email:${sha256hex(emailKey(email))}`

export async function orgCount(): Promise<number> {
  const rows = await authDb().execute(sql`select kira_org_count() as n`)
  return Number((rows as unknown as { n: number }[])[0]?.n ?? 0)
}

/**
 * Login password. Akun tidak dikenal dan password salah menghasilkan pesan dan waktu yang sama.
 * Kegagalan dihitung per email (bukan per IP); setelah 20 kegagalan dalam 15 menit email itu dikunci 15 menit.
 */
export async function loginWithPassword(emailRaw: string, password: string): Promise<{ id: string; orgId: string; role: 'tutor' | 'guardian' | 'learner' }> {
  await throttleIp('login', 120)
  const email = normaliseEmail(emailRaw)
  const key = loginKey(email)
  const failures = await recentFailures(key)
  if (failures >= ACCOUNT_LOCK_AFTER) {
    await burnVerify(password)
    log.warn('keamanan: akun dikunci karena terlalu banyak kegagalan', { event: 'login.locked', ipPrefix: ipPrefix(await clientIp()) })
    throw new AppError('locked', 'Terlalu banyak percobaan masuk untuk email ini. Akun dikunci 15 menit. Coba lagi nanti atau pakai Lupa password.')
  }
  const reservation = await reserveFailure(key)
  if (reservation.failures > ACCOUNT_LOCK_AFTER) {
    await burnVerify(password)
    log.warn('keamanan: akun dikunci karena terlalu banyak kegagalan', { event: 'login.locked', ipPrefix: ipPrefix(await clientIp()) })
    throw new AppError('locked', 'Terlalu banyak percobaan masuk untuk email ini. Akun dikunci 15 menit. Coba lagi nanti atau pakai Lupa password.')
  }
  await escalatingDelay(failures)
  const rows = await authDb()
    .select({ id: userAccount.id, orgId: userAccount.orgId, role: userAccount.role, hash: userAccount.passwordHash })
    .from(userAccount)
    .where(and(adultByEmail(email), eq(userAccount.kind, 'adult'), isNull(userAccount.disabledAt)))
    .orderBy(exactEmailFirst(email))
    .limit(1)
  const user = rows[0]
  if (!user || !user.hash) {
    // Pendaftar yang belum konfirmasi email: pesan ramah hanya bila password-nya cocok (tidak membocorkan email).
    const pending = (await authDb().select({ hash: signup.passwordHash }).from(signup).where(eq(signup.emailNorm, emailKey(email))).limit(1))[0]
    if (pending && (await verifySecret(pending.hash, password))) {
      await releaseFailure(reservation.id)
      throw new AppError('invalid', 'Email ini belum dikonfirmasi. Buka email dari Kira lalu tekan Konfirmasi email, atau kirim ulang emailnya.', { unverified: email })
    }
    if (!pending) await burnVerify(password)
    log.warn('keamanan: login gagal', { event: 'login.failed', ipPrefix: ipPrefix(await clientIp()) })
    throw invalid(GENERIC_LOGIN_ERROR)
  }
  if (!(await verifySecret(user.hash, password))) {
    log.warn('keamanan: login gagal', { event: 'login.failed', ipPrefix: ipPrefix(await clientIp()) })
    throw invalid(GENERIC_LOGIN_ERROR)
  }
  await releaseFailure(reservation.id)
  await recordAttempt(key, true)
  await authDb().update(userAccount).set({ lastLoginAt: new Date(), failedLogins: 0 }).where(eq(userAccount.id, user.id))
  return { id: user.id, orgId: user.orgId, role: user.role }
}

async function assertEmailFree(email: string): Promise<void> {
  const rows = await authDb().select({ id: userAccount.id }).from(userAccount).where(sql`lower(${userAccount.email}) = ${email} or ${userAccount.emailNorm} = ${emailKey(email)}`).limit(1)
  if (rows[0]) throw conflict('Email ini sudah dipakai akun lain. Masuk dengan email itu atau pakai email lain.')
}

/** Setup pertama: org keluarga dan akun tutor. Hanya bisa saat database masih kosong dan dengan token setup. */
export async function createFirstOrg(input: { setupToken: string; orgName: string; name: string; email: string; password: string; ipHash: string }): Promise<{ id: string; orgId: string }> {
  await throttleIp('setup', 10)
  if ((await orgCount()) > 0) throw conflict('Kira sudah disiapkan. Masuk dengan akun tutor.')
  const expected = env().KIRA_SETUP_TOKEN
  if (!expected || !safeEqual(input.setupToken.trim(), expected)) throw invalid('Token setup tidak cocok. Lihat nilai KIRA_SETUP_TOKEN di file .env server.', { setupToken: 'Token setup tidak cocok.' })
  const email = normaliseEmail(input.email)
  const problem = await passwordProblem(input.password, { email, name: input.name })
  if (problem) throw invalid(problem, { password: problem })
  await assertEmailFree(email)
  const orgId = randomUUID()
  const [user] = await authDb()
    .insert(userAccount)
    .values({ orgId, kind: 'adult', role: 'tutor', email, emailNorm: emailKey(email), name: input.name.trim(), passwordHash: await hashSecret(input.password), passwordChangedAt: new Date() })
    .returning({ id: userAccount.id })
  const ctx = { orgId, userId: user!.id, role: 'tutor' as const }
  try {
    await inOrg(ctx, async (tx) => {
      await tx.insert(tables.org).values({ id: orgId, name: input.orgName.trim() })
      await tx.insert(tables.memberProfile).values({ userId: user!.id, orgId, name: input.name.trim(), role: 'tutor', email })
      await auditTx(tx, ctx, 'org.created', orgId)
      await auditTx(tx, ctx, 'terms.accepted', user!.id, { termsVersion: TERMS_VERSION, noticeVersion: NOTICE_VERSION, ipHash: input.ipHash })
    })
  } catch (e) {
    await authDb().delete(userAccount).where(eq(userAccount.id, user!.id))
    throw e
  }
  return { id: user!.id, orgId }
}

export async function createInvite(ctx: { orgId: string; userId: string }, input: { email: string; role: 'tutor' | 'guardian'; learnerIds: string[]; orgName: string }): Promise<{ link: string; inviteId: string }> {
  const email = normaliseEmail(input.email)
  await assertEmailFree(email)
  const token = randomToken(32)
  const [row] = await authDb()
    .insert(invite)
    .values({
      orgId: ctx.orgId,
      email,
      role: input.role,
      learnerIds: input.learnerIds,
      tokenHash: sha256hex(token),
      invitedBy: ctx.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    })
    .returning({ id: invite.id })
  const link = `${origin()}/undangan/${token}`
  const mail = inviteEmail(emailIdentity(), { url: link, role: input.role, orgName: input.orgName })
  await queueEmail(ctx.orgId, { to: email, ...mail, kind: 'invite' })
  return { link, inviteId: row!.id }
}

export async function findInvite(token: string) {
  const rows = await authDb()
    .select()
    .from(invite)
    .where(and(eq(invite.tokenHash, sha256hex(token)), isNull(invite.acceptedAt), isNull(invite.revokedAt), gt(invite.expiresAt, new Date())))
    .limit(1)
  return rows[0] ?? null
}

export async function acceptInvite(input: { token: string; name: string; password: string; ipHash: string }): Promise<{ id: string; orgId: string; role: 'tutor' | 'guardian' }> {
  await throttleIp('invite', 10)
  const inv = await findInvite(input.token)
  if (!inv) throw notFound('Undangan tidak berlaku lagi. Minta tutor mengirim undangan baru.')
  const problem = await passwordProblem(input.password, { email: inv.email, name: input.name })
  if (problem) throw invalid(problem, { password: problem })
  await assertEmailFree(inv.email)
  const [user] = await authDb()
    .insert(userAccount)
    .values({ orgId: inv.orgId, kind: 'adult', role: inv.role, email: inv.email, emailNorm: emailKey(inv.email), name: input.name.trim(), passwordHash: await hashSecret(input.password), passwordChangedAt: new Date() })
    .returning({ id: userAccount.id })
  const ctx = { orgId: inv.orgId, userId: user!.id, role: 'tutor' as const }
  try {
    await inOrg(systemCtx(inv.orgId), async (tx) => {
      await tx.insert(tables.memberProfile).values({ userId: user!.id, orgId: inv.orgId, name: input.name.trim(), role: inv.role, email: inv.email })
      if (inv.role === 'guardian' && inv.learnerIds.length > 0) {
        const existing = await tx.select({ id: tables.learnerProfile.userId }).from(tables.learnerProfile).where(inArray(tables.learnerProfile.userId, inv.learnerIds))
        for (const l of existing) await tx.insert(tables.guardianLink).values({ orgId: inv.orgId, guardianId: user!.id, learnerId: l.id }).onConflictDoNothing()
      }
      await auditTx(tx, { ...ctx }, 'invite.accepted', inv.id)
      await auditTx(tx, { ...ctx }, 'terms.accepted', user!.id, { termsVersion: TERMS_VERSION, noticeVersion: NOTICE_VERSION, ipHash: input.ipHash })
    })
    await authDb().update(invite).set({ acceptedAt: new Date() }).where(eq(invite.id, inv.id))
  } catch (e) {
    await authDb().delete(userAccount).where(eq(userAccount.id, user!.id))
    throw e
  }
  return { id: user!.id, orgId: inv.orgId, role: inv.role }
}

/** Selalu berhasil dari sisi pengguna, ada atau tidak ada akunnya (tidak membocorkan akun). */
export async function requestPasswordReset(emailRaw: string): Promise<void> {
  await throttleIp('reset', 20)
  const started = Date.now()
  try {
    await requestPasswordResetInner(emailRaw)
  } finally {
    // Waktu jawaban sama untuk email terdaftar dan tidak: tidak ada petunjuk akun dari lamanya respons.
    await new Promise((r) => setTimeout(r, Math.max(0, 900 - (Date.now() - started)) + Math.random() * 100))
  }
}

async function requestPasswordResetInner(emailRaw: string): Promise<void> {
  const email = normaliseEmail(emailRaw)
  const rows = await authDb()
    .select({ id: userAccount.id, orgId: userAccount.orgId, name: userAccount.name, email: userAccount.email })
    .from(userAccount)
    .where(and(adultByEmail(email), eq(userAccount.kind, 'adult'), isNull(userAccount.disabledAt)))
    .orderBy(exactEmailFirst(email))
    .limit(1)
  const user = rows[0]
  if (!user?.email) return
  if (!emailSendAllowed('reset', emailKey(email))) return
  const link = await createResetLink(user.id)
  const mail = passwordResetEmail(emailIdentity(), { url: link })
  await queueEmail(user.orgId, { to: user.email, ...mail, kind: 'password-reset' })
}

export async function createResetLink(userId: string): Promise<string> {
  const token = randomToken(32)
  await authDb().insert(resetToken).values({ userId, tokenHash: sha256hex(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) })
  return `${origin()}/reset/${token}`
}

export async function resetTokenValid(token: string): Promise<boolean> {
  const rows = await authDb()
    .select({ id: resetToken.id })
    .from(resetToken)
    .where(and(eq(resetToken.tokenHash, sha256hex(token)), isNull(resetToken.usedAt), gt(resetToken.expiresAt, new Date())))
    .limit(1)
  return Boolean(rows[0])
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await throttleIp('reset-confirm', 30)
  const rows = await authDb()
    .select({ id: resetToken.id, userId: resetToken.userId, email: userAccount.email, name: userAccount.name, orgId: userAccount.orgId })
    .from(resetToken)
    .innerJoin(userAccount, eq(resetToken.userId, userAccount.id))
    .where(and(eq(resetToken.tokenHash, sha256hex(token)), isNull(resetToken.usedAt), gt(resetToken.expiresAt, new Date())))
    .limit(1)
  const row = rows[0]
  if (!row) throw notFound('Tautan atur ulang sudah tidak berlaku. Minta tautan baru dari halaman masuk.')
  const problem = await passwordProblem(password, { email: row.email ?? undefined, name: row.name })
  if (problem) throw invalid(problem, { password: problem })
  // Klaim token secara atomik dulu: dua permintaan serentak dengan tautan yang sama hanya satu yang lolos.
  const claimed = await authDb().update(resetToken).set({ usedAt: new Date() }).where(and(eq(resetToken.id, row.id), isNull(resetToken.usedAt))).returning({ id: resetToken.id })
  if (!claimed[0]) throw notFound('Tautan atur ulang sudah tidak berlaku. Minta tautan baru dari halaman masuk.')
  await authDb().update(userAccount).set({ passwordHash: await hashSecret(password), passwordChangedAt: new Date(), failedLogins: 0, lockedUntil: null }).where(eq(userAccount.id, row.userId))
  // Tautan lain yang masih beredar untuk akun ini ikut hangus.
  await authDb().update(resetToken).set({ usedAt: new Date() }).where(and(eq(resetToken.userId, row.userId), isNull(resetToken.usedAt)))
  await revokeUserSessions(row.userId)
  // Pesan kunci menyuruh orang tua memakai Lupa password, jadi password baru harus langsung membuka kuncinya.
  if (row.email) await recordAttempt(loginKey(normaliseEmail(row.email)), true)
  await inOrg(systemCtx(row.orgId), (tx) => auditTx(tx, systemCtx(row.orgId), 'password.reset', row.userId))
}

export async function changePassword(user: { userId: string; sessionId: string; email: string | null; name: string }, current: string, next: string): Promise<void> {
  const rows = await authDb().select({ hash: userAccount.passwordHash }).from(userAccount).where(eq(userAccount.id, user.userId)).limit(1)
  if (!rows[0]?.hash || !(await verifySecret(rows[0].hash, current))) throw invalid('Password sekarang belum cocok.', { current: 'Password sekarang belum cocok.' })
  const problem = await passwordProblem(next, { email: user.email ?? undefined, name: user.name })
  if (problem) throw invalid(problem, { next: problem })
  await authDb().update(userAccount).set({ passwordHash: await hashSecret(next), passwordChangedAt: new Date() }).where(eq(userAccount.id, user.userId))
  await revokeUserSessions(user.userId, user.sessionId)
}

/** Akun learner baru: identitas di skema auth, profil belajar di skema publik. Belum aktif sampai ada persetujuan orang tua. */
/** Bagian auth akun learner: baris akun dan PIN. Dipanggil di luar transaksi, karena memakai pool auth dan Argon2. */
export async function createLearnerAuth(orgId: string, input: { name: string; pin: string[]; uiLang?: UiLang }): Promise<string> {
  const [user] = await authDb()
    .insert(userAccount)
    .values({ orgId, kind: 'learner', role: 'learner', email: null, name: input.name.trim(), ...(input.uiLang ? { uiLang: input.uiLang } : {}) })
    .returning({ id: userAccount.id })
  try {
    await setPin(user!.id, input.pin)
  } catch (e) {
    await removeLearnerAuth(user!.id)
    throw e
  }
  return user!.id
}

/** Hapus baris akun bila langkah berikutnya gagal, supaya tidak ada akun tanpa profil. */
export async function removeLearnerAuth(userId: string): Promise<void> {
  await authDb().delete(userAccount).where(eq(userAccount.id, userId))
}

export async function createLearnerAccount(ctx: { orgId: string; userId: string }, input: { name: string; grade: number; avatar: string; pin: string[]; uiLang?: UiLang }): Promise<string> {
  const id = await createLearnerAuth(ctx.orgId, input)
  try {
    await inOrg({ orgId: ctx.orgId, userId: ctx.userId, role: 'tutor' }, async (tx) => {
      await tx.insert(tables.learnerProfile).values({ userId: id, orgId: ctx.orgId, name: input.name.trim(), grade: input.grade, avatar: input.avatar, active: false })
      await auditTx(tx, { orgId: ctx.orgId, userId: ctx.userId, role: 'tutor' }, 'learner.created', id)
    })
  } catch (e) {
    await removeLearnerAuth(id)
    throw e
  }
  return id
}

export async function learnerUiPrefs(userIds: string[], orgId: string): Promise<Map<string, { uiLang: UiLang; uiLangSwitch: boolean }>> {
  const rows = userIds.length
    ? await authDb()
        .select({ id: userAccount.id, uiLang: userAccount.uiLang, uiLangSwitch: userAccount.uiLangSwitch })
        .from(userAccount)
        .where(and(inArray(userAccount.id, userIds), eq(userAccount.orgId, orgId), eq(userAccount.kind, 'learner')))
    : []
  return new Map(rows.map((r) => [r.id, { uiLang: r.uiLang, uiLangSwitch: r.uiLangSwitch }]))
}

export async function setLearnerUiPrefs(userId: string, orgId: string, prefs: { uiLang?: UiLang; uiLangSwitch?: boolean }): Promise<void> {
  await authDb()
    .update(userAccount)
    .set(prefs)
    .where(and(eq(userAccount.id, userId), eq(userAccount.orgId, orgId), eq(userAccount.kind, 'learner')))
  await invalidateUserSessions(userId)
}

export async function renameUser(userId: string, orgId: string, name: string): Promise<void> {
  await authDb().update(userAccount).set({ name: name.trim() }).where(and(eq(userAccount.id, userId), eq(userAccount.orgId, orgId)))
}
