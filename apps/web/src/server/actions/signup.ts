'use server'

import { z } from 'zod'
import type { ActionResult } from '@/lib/dto'
import { runAction } from '../errors'
import { startSession } from '../auth/session'
import { clientIp, throttleIp } from '../auth/ratelimit'
import { ipHash } from '../auth/crypto'
import { audit } from '../audit'
import { verifyTurnstile } from '../auth/turnstile'
import { evenTime } from '@/lib/even-time'
import { signUpSchema, verifySignupSchema } from './signup-schemas'
import { confirmWaitlist, joinWaitlist, resendVerification, startSignup, verifySignup } from '../signup/service'

const turnstile = z.string().max(2048).optional()
const email = z.string().trim().max(200)

/**
 * Jawaban sukses selalu sama, ada atau tidak ada akun dengan email itu. Kesalahan yang dikembalikan hanya
 * soal isian (bentuk email, email sekali pakai, password lemah, persetujuan, kursi penuh).
 */
export async function signUpAction(input: { name: string; email: string; password: string; consent: boolean; marketing?: boolean; turnstile?: string }): Promise<ActionResult<{ email: string }>> {
  return runAction('signUp', async () => {
    const data = signUpSchema.parse(input)
    await throttleIp('signup', 6)
    await verifyTurnstile(data.turnstile, await clientIp())
    const hash = ipHash(await clientIp())
    await evenTime(900, () => startSignup({ name: data.name, email: data.email, password: data.password, consent: data.consent, marketing: data.marketing, ipHash: hash }))
    return { email: data.email.toLowerCase() }
  })
}

export async function resendVerificationAction(input: { email: string; turnstile?: string }): Promise<ActionResult> {
  return runAction('resendVerification', async () => {
    const data = z.object({ email, turnstile }).strict().parse(input)
    await throttleIp('signup-resend', 4)
    await verifyTurnstile(data.turnstile, await clientIp())
    await evenTime(600, () => resendVerification(data.email))
    return undefined
  })
}

export type VerifyResult = { status: 'ok'; redirectTo: string } | { status: 'full' | 'invalid' | 'taken' | 'needs-password' }

/**
 * Dipanggil browser setelah halaman konfirmasi terbuka, jadi pemindai email tanpa JavaScript tidak memakai tautan.
 * Isian lain hanya dipakai untuk pendaftar bertanda conflict, lewat langkah Buat password baru.
 */
export async function verifySignupAction(input: { token: string; name?: string; password?: string; consent?: boolean; marketing?: boolean }): Promise<ActionResult<VerifyResult>> {
  return runAction('verifySignup', async () => {
    const data = verifySignupSchema.parse(input)
    await throttleIp('signup-verify', 10)
    const replacement =
      data.name !== undefined && data.password !== undefined ? { name: data.name, password: data.password, consent: data.consent === true, marketing: data.marketing === true, ipHash: ipHash(await clientIp()) } : undefined
    const r = await verifySignup(data.token, replacement)
    if (r.status !== 'ok') return { status: r.status }
    await startSession({ id: r.userId, orgId: r.orgId, kind: 'adult' })
    await audit({ orgId: r.orgId, userId: r.userId, role: 'guardian' }, 'login.signup', r.userId)
    return { status: 'ok' as const, redirectTo: '/mulai' }
  })
}

export async function joinWaitlistAction(input: { email: string; consent: boolean; turnstile?: string }): Promise<ActionResult> {
  return runAction('joinWaitlist', async () => {
    const data = z.object({ email, consent: z.boolean(), turnstile }).strict().parse(input)
    await throttleIp('waitlist', 5)
    await verifyTurnstile(data.turnstile, await clientIp())
    await evenTime(600, () => joinWaitlist({ email: data.email, consent: data.consent }))
    return undefined
  })
}

export async function confirmWaitlistAction(input: { token: string }): Promise<ActionResult<{ confirmed: boolean }>> {
  return runAction('confirmWaitlist', async () => {
    const data = z.object({ token: z.string().min(20).max(100) }).strict().parse(input)
    await throttleIp('waitlist-confirm', 20)
    return { confirmed: await confirmWaitlist(data.token) }
  })
}
