'use server'

import { z } from 'zod'
import type { ActionResult } from '@/lib/dto'
import { runAction } from '../errors'
import { startSession } from '../auth/session'
import { clientIp, throttleIp } from '../auth/ratelimit'
import { ipHash } from '../auth/crypto'
import { audit } from '../audit'
import { verifyTurnstile } from '../auth/turnstile'
import { confirmWaitlist, joinWaitlist, resendVerification, startSignup, verifySignup } from '../signup/service'

const turnstile = z.string().max(2048).optional()
const email = z.string().trim().max(200)

/**
 * Jawaban sukses selalu sama, ada atau tidak ada akun dengan email itu. Kesalahan yang dikembalikan hanya
 * soal isian (bentuk email, email sekali pakai, password lemah, persetujuan, kursi penuh).
 */
export async function signUpAction(input: { name: string; email: string; password: string; consent: boolean; turnstile?: string }): Promise<ActionResult<{ email: string }>> {
  return runAction('signUp', async () => {
    const data = z.object({ name: z.string().trim().max(120), email, password: z.string().max(128), consent: z.boolean(), turnstile }).strict().parse(input)
    await throttleIp('signup', 6)
    await verifyTurnstile(data.turnstile, await clientIp())
    await startSignup({ name: data.name, email: data.email, password: data.password, consent: data.consent, ipHash: ipHash(await clientIp()) })
    return { email: data.email.toLowerCase() }
  })
}

export async function resendVerificationAction(input: { email: string; turnstile?: string }): Promise<ActionResult> {
  return runAction('resendVerification', async () => {
    const data = z.object({ email, turnstile }).strict().parse(input)
    await throttleIp('signup-resend', 4)
    await verifyTurnstile(data.turnstile, await clientIp())
    await resendVerification(data.email)
    return undefined
  })
}

export type VerifyResult = { status: 'ok'; redirectTo: string } | { status: 'full' | 'invalid' | 'taken' }

/** Dipanggil dari tombol di halaman konfirmasi (bukan saat halaman dibuka), jadi pemindai email tidak memakai tautan. */
export async function verifySignupAction(input: { token: string }): Promise<ActionResult<VerifyResult>> {
  return runAction('verifySignup', async () => {
    const data = z.object({ token: z.string().min(20).max(100) }).strict().parse(input)
    await throttleIp('signup-verify', 10)
    const r = await verifySignup(data.token)
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
    await joinWaitlist({ email: data.email, consent: data.consent })
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
