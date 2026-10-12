'use server'

import { z } from 'zod'
import { and, inArray, isNull } from 'drizzle-orm'
import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON, PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import { tables } from '@kira/db'
import type { ActionResult } from '@/lib/dto'
import { inOrg } from '../db'
import { forbidden, invalid, runAction } from '../errors'
import { audit } from '../audit'
import { homeFor, orgCtx, requireActor, requireAdult, safeNext } from '../auth/actor'
import { acceptInvite, createFirstOrg, loginWithPassword, requestPasswordReset, resetPassword } from '../auth/accounts'
import { authenticationOptions, registrationOptions, verifyAuthentication, verifyRegistration } from '../auth/passkey'
import { endCurrentSession, startSession } from '../auth/session'
import { registerDevice } from '../auth/device'
import { clientIp, throttleIp } from '../auth/ratelimit'
import { ipHash } from '../auth/crypto'
import { readAuthenticationResponse, readRegistrationResponse } from '../auth/webauthn-input'

const email = z.string().trim().email('Format email belum benar.').max(200)
const password = z.string().min(1, 'Isi password.').max(128)

export async function passwordLoginAction(input: { email: string; password: string; next: string | null }): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction('passwordLogin', async () => {
    const data = z.object({ email, password, next: z.string().max(300).nullable() }).strict().parse(input)
    const user = await loginWithPassword(data.email, data.password)
    await startSession({ id: user.id, orgId: user.orgId, kind: 'adult' })
    await audit({ orgId: user.orgId, userId: user.id, role: user.role }, 'login.password', user.id)
    return { redirectTo: safeNext(data.next, homeFor(user.role)) }
  })
}

export async function passkeyOptionsAction(): Promise<ActionResult<{ challengeId: string; options: PublicKeyCredentialRequestOptionsJSON }>> {
  return runAction('passkeyOptions', async () => {
    await throttleIp('passkey', 30)
    return authenticationOptions()
  })
}

export async function passkeyVerifyAction(input: { challengeId: string; response: AuthenticationResponseJSON; next: string | null }): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction('passkeyVerify', async () => {
    await throttleIp('passkey', 30)
    const challengeId = z.string().uuid().parse(input.challengeId)
    const response = readAuthenticationResponse(input.response)
    if (!response) throw invalid('Respons passkey tidak lengkap.')
    const user = await verifyAuthentication(challengeId, response)
    await startSession({ id: user.id, orgId: user.orgId, kind: 'adult' })
    const actor = await requireAdult()
    await audit(orgCtx(actor), 'login.passkey', user.id)
    return { redirectTo: safeNext(input.next, homeFor(actor.role)) }
  })
}

export async function passkeyRegisterOptionsAction(): Promise<ActionResult<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }>> {
  return runAction('passkeyRegisterOptions', async () => {
    const actor = await requireAdult()
    return registrationOptions({ id: actor.userId, email: actor.email ?? actor.userId, name: actor.name })
  })
}

export async function passkeyRegisterVerifyAction(input: { challengeId: string; response: RegistrationResponseJSON; name: string }): Promise<ActionResult> {
  return runAction('passkeyRegisterVerify', async () => {
    const actor = await requireAdult()
    const challengeId = z.string().uuid().parse(input.challengeId)
    const name = z.string().trim().min(1).max(60).parse(input.name)
    const response = readRegistrationResponse(input.response)
    if (!response) throw invalid('Respons passkey tidak lengkap.')
    await verifyRegistration({ id: actor.userId }, challengeId, response, name)
    await audit(orgCtx(actor), 'passkey.added', actor.userId)
    return undefined
  })
}

export async function requestResetAction(emailInput: string): Promise<ActionResult> {
  return runAction('requestReset', async () => {
    await requestPasswordReset(email.parse(emailInput))
    return undefined
  })
}

export async function resetPasswordAction(input: { token: string; password: string }): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction('resetPassword', async () => {
    const data = z.object({ token: z.string().min(20).max(100), password: z.string().max(128) }).strict().parse(input)
    await resetPassword(data.token, data.password)
    return { redirectTo: '/masuk?notice=reset-done' }
  })
}

export async function createOrgAction(input: { setupToken: string; orgName: string; name: string; email: string; password: string }): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction('createOrg', async () => {
    const data = z
      .object({
        setupToken: z.string().min(1, 'Isi token setup.').max(200),
        orgName: z.string().trim().min(2, 'Isi nama keluarga.').max(80),
        name: z.string().trim().min(1, 'Isi nama.').max(80),
        email,
        password: z.string().max(128),
      })
      .strict()
      .parse(input)
    const user = await createFirstOrg({ ...data, ipHash: ipHash(await clientIp()) })
    await startSession({ id: user.id, orgId: user.orgId, kind: 'adult' })
    return { redirectTo: '/konsol/learner' }
  })
}

export async function acceptInviteAction(input: { token: string; name: string; password: string }): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction('acceptInvite', async () => {
    const data = z.object({ token: z.string().min(20).max(100), name: z.string().trim().min(1, 'Isi nama.').max(80), password: z.string().max(128) }).strict().parse(input)
    const user = await acceptInvite({ ...data, ipHash: ipHash(await clientIp()) })
    await startSession({ id: user.id, orgId: user.orgId, kind: 'adult' })
    return { redirectTo: user.role === 'guardian' ? '/keluarga/privasi' : '/konsol' }
  })
}

/**
 * Daftarkan browser ini sebagai tablet learner. Akun dewasa langsung keluar dari perangkat ini
 * supaya anak tidak bisa membuka konsol.
 */
export async function registerDeviceAction(input: { name: string; learnerIds: string[] }): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction('registerDevice', async () => {
    const actor = await requireAdult()
    const data = z.object({ name: z.string().trim().min(1, 'Isi nama perangkat.').max(60), learnerIds: z.array(z.string().uuid()).min(1, 'Pilih minimal satu learner.').max(10) }).strict().parse(input)
    const allowed = await inOrg(orgCtx(actor), async (tx) => {
      const rows = await tx
        .select({ id: tables.learnerProfile.userId })
        .from(tables.learnerProfile)
        .where(and(inArray(tables.learnerProfile.userId, data.learnerIds), isNull(tables.learnerProfile.deletedAt)))
      return rows.map((r) => r.id)
    })
    if (allowed.length !== data.learnerIds.length) throw forbidden('Ada learner yang tidak bisa didaftarkan dari akun ini.')
    await registerDevice({ orgId: actor.orgId, name: data.name, learnerIds: data.learnerIds, registeredBy: actor.userId })
    await audit(orgCtx(actor), 'device.registered', data.name, { learners: data.learnerIds.length })
    await endCurrentSession()
    return { redirectTo: '/' }
  })
}

export async function signOutAction(): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction('signOut', async () => {
    const actor = await requireActor().catch(() => null)
    if (actor) await audit(orgCtx(actor), 'logout', actor.userId)
    await endCurrentSession()
    return { redirectTo: actor?.role === 'learner' ? '/' : '/masuk?notice=signed-out' }
  })
}
