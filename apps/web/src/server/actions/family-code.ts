'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { PIN_PICTURES } from '@kira/figures/spec'
import type { ActionResult, PinPicture } from '@/lib/dto'
import { isFamilyCode, normalizeFamilyCode } from '@/lib/family-code'
import { getT } from '@/lib/i18n/server'
import { audit, systemCtx } from '../audit'
import { getActor, localFailure, orgCtx, requireActor } from '../auth/actor'
import { revokeDevice } from '../auth/admin'
import { ipHash } from '../auth/crypto'
import { touchDevice } from '../auth/device'
import { deviceForFamilyChild, familyChildChoice, forgetFamilyTicket, orgForFamilyCode, readFamilyTicket, writeFamilyTicket } from '../auth/family-code'
import { checkPin } from '../auth/pin'
import { clientIp, throttleIp } from '../auth/ratelimit'
import { endCurrentSession, startSession } from '../auth/session'
import { verifyTurnstile } from '../auth/turnstile'
import { familyDevicesFor, rotateFamilyCode } from '../dal/family-code'
import { AppError, newReference, notFound, runAction, toFailure } from '../errors'

/** Longgar untuk anak yang salah ketik di satu jaringan, jauh di bawah yang dibutuhkan untuk menebak kode 38 bit. */
const CODE_TRIES_PER_MINUTE = 20

const codeSchema = z.object({ code: z.string().max(64), turnstile: z.string().max(2048).optional() }).strict()
const pinSchema = z.object({ learnerId: z.string().uuid(), pin: z.array(z.enum(PIN_PICTURES)).length(4) }).strict()

async function childFailure<T>(e: unknown, context: string): Promise<ActionResult<T>> {
  if (e instanceof AppError && e.code === 'rate-limited') return { ok: false, message: (await getT()).shell.kode.slowDown, reference: newReference() }
  return (await localFailure(toFailure(e, context, 'en-GB'))) as ActionResult<T>
}

/** Langkah 1, tanpa sesi: kode benar memberi tiket. Kode salah dan bentuk yang salah mendapat jawaban yang sama. */
export async function checkFamilyCodeAction(input: { code: string; turnstile?: string }): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    await throttleIp('family-code', CODE_TRIES_PER_MINUTE)
    const data = codeSchema.parse(input)
    const ip = await clientIp()
    await verifyTurnstile(data.turnstile, ip)
    const code = normalizeFamilyCode(data.code)
    const orgId = isFamilyCode(code) ? await orgForFamilyCode(code) : null
    if (!orgId) return { ok: false, message: (await getT()).shell.kode.wrong, reference: newReference() }
    await writeFamilyTicket(code)
    await audit(systemCtx(orgId), 'family_code.used', null, { ipHash: ipHash(ip) })
    return { ok: true, data: { redirectTo: '/masuk/anak' } }
  } catch (e) {
    return childFailure(e, 'checkFamilyCode')
  }
}

/** Keluar dari langkah nama: anak salah keluarga atau ingin mengetik kode lain. Tidak memberi akses apa pun. */
export async function forgetFamilyCodeAction(): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    await throttleIp('family-code-forget', 30)
    await forgetFamilyTicket()
    return { ok: true, data: { redirectTo: '/masuk/anak?lain=1' } }
  } catch (e) {
    return childFailure(e, 'forgetFamilyCode')
  }
}

/** Langkah 3, tanpa sesi: tiket yang sah, anak aktif di keluarga itu, dan PIN benar. Kunci PIN tetap dari checkPin. */
export async function submitFamilyPinAction(learnerId: string, pin: PinPicture[]): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    await throttleIp('pin', 240)
    const input = pinSchema.parse({ learnerId, pin })
    const t = (await getT()).shell
    const ticket = await readFamilyTicket()
    if (!ticket) throw new AppError('forbidden', t.kode.expired)
    const child = await familyChildChoice(ticket.orgId, input.learnerId)
    if (!child) throw notFound(t.pin.checkAccount)
    const result = await checkPin(input.learnerId, input.pin)
    if (!result.ok) {
      const reference = newReference()
      if (result.reason === 'locked') {
        await audit({ orgId: ticket.orgId, userId: input.learnerId, role: 'learner' }, 'pin.locked', input.learnerId, { via: 'family_code' })
        return { ok: false, message: t.pin.lockedMessage, reference, fieldErrors: { lockedUntil: result.lockedUntil.toISOString() } }
      }
      return { ok: false, message: t.pin.wrongMessage, reference, fieldErrors: { attemptsLeft: String(result.attemptsLeft) } }
    }
    // Sesi lain di browser ini (misalnya orang tua) diakhiri, seperti saat perangkat didaftarkan dari akun orang tua.
    if (await getActor()) await endCurrentSession()
    const { device, created } = await deviceForFamilyChild({ orgId: ticket.orgId, learnerId: input.learnerId, firstName: child.firstName })
    await startSession({ id: input.learnerId, orgId: ticket.orgId, kind: 'learner' }, device.id)
    await touchDevice(device.id)
    await forgetFamilyTicket()
    const ctx = { orgId: ticket.orgId, userId: input.learnerId, role: 'learner' as const }
    if (created) await audit(ctx, 'device.registered', device.name, { learners: 1, via: 'family_code' })
    await audit(ctx, 'login.family_code', input.learnerId, { deviceId: device.id })
    return { ok: true, data: { redirectTo: '/today' } }
  } catch (e) {
    return childFailure(e, 'submitFamilyPin')
  }
}

/** Ganti kode. Tutor dan orang tua di keluarga itu. */
export async function rotateFamilyCodeAction(input: Record<string, never> = {}): Promise<ActionResult<{ code: string }>> {
  return runAction('rotateFamilyCode', async () => {
    const actor = await requireActor({ roles: ['tutor', 'guardian'] })
    z.object({}).strict().parse(input)
    await throttleIp('family-code-rotate', 10, actor.userId)
    return { code: await rotateFamilyCode(actor) }
  })
}

/** Orang tua mencabut perangkat anaknya sendiri. Sesi anak di perangkat itu langsung berakhir. */
export async function revokeFamilyDeviceAction(input: { deviceId: string }): Promise<ActionResult> {
  return runAction('revokeFamilyDevice', async () => {
    const actor = await requireActor({ roles: ['guardian'] })
    const { deviceId } = z.object({ deviceId: z.string().uuid() }).strict().parse(input)
    const mine = await familyDevicesFor(actor)
    if (!mine.some((d) => d.id === deviceId) || !(await revokeDevice(actor.orgId, deviceId))) throw notFound('Perangkat ini tidak ditemukan atau sudah dicabut. Muat ulang halaman.')
    await audit(orgCtx(actor), 'device.revoked', deviceId)
    revalidatePath('/keluarga')
    return undefined
  })
}
