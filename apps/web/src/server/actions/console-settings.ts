'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { tables } from '@kira/db'
import { eq } from 'drizzle-orm'
import type { ActionResult } from '@/lib/dto'
import { inOrg } from '../db'
import { notFound, runAction } from '../errors'
import { audit, auditTx } from '../audit'
import { orgCtx, requireTutor } from '../auth/actor'
import { changePassword, createInvite } from '../auth/accounts'
import { renameDevice, revokeDevice, revokeInvite } from '../auth/admin'
import { listPasskeys, removePasskey } from '../auth/passkey'
import { throttleIp } from '../auth/ratelimit'
import { updateLearnerSoundTx } from '../dal/learner-motion'
import { assertLearnersInOrg, LIMIT_MAX, LIMIT_MIN, updateLearnerLimitsTx } from '../dal/console-settings'

/**
 * T10 Pengaturan. Semua action hanya untuk tutor (pemilik akun keluarga). Mendaftarkan browser ini
 * sebagai tablet memakai registerDeviceAction di actions/auth.ts lewat pembungkus client halaman.
 */

const limitsSchema = z
  .object({
    learnerId: z.string().uuid(),
    screenLimitMin: z.number().int().min(LIMIT_MIN).max(LIMIT_MAX),
    restWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
    reviewEnabled: z.boolean(),
  })
  .strict()

export async function updateLearnerLimitsAction(input: { learnerId: string; screenLimitMin: number; restWeekdays: number[]; reviewEnabled: boolean }): Promise<ActionResult> {
  return runAction('updateLearnerLimits', async () => {
    const actor = await requireTutor()
    const data = limitsSchema.parse(input)
    const ctx = orgCtx(actor)
    await inOrg(ctx, (tx) => updateLearnerLimitsTx(tx, ctx, data))
    refresh()
    return undefined
  })
}

const soundSchema = z
  .object({ learnerId: z.string().uuid(), soundEnabled: z.boolean(), musicEnabled: z.boolean() })
  .strict()

/** Suara dan musik di perangkat anak. Pilihan tutor mengalahkan pilihan perangkat. */
export async function updateLearnerSoundAction(input: { learnerId: string; soundEnabled: boolean; musicEnabled: boolean }): Promise<ActionResult> {
  return runAction('updateLearnerSound', async () => {
    const actor = await requireTutor()
    const data = soundSchema.parse(input)
    const ctx = orgCtx(actor)
    await inOrg(ctx, async (tx) => {
      await assertLearnersInOrg(tx, [data.learnerId])
      await updateLearnerSoundTx(tx, data.learnerId, data)
      await auditTx(tx, ctx, 'learner.sound', data.learnerId, { soundEnabled: data.soundEnabled, musicEnabled: data.musicEnabled })
    })
    refresh()
    return undefined
  })
}

export async function revokeDeviceAction(deviceId: string): Promise<ActionResult> {
  return runAction('revokeDevice', async () => {
    const actor = await requireTutor()
    const id = z.string().uuid().parse(deviceId)
    if (!(await revokeDevice(actor.orgId, id))) throw notFound('Perangkat ini tidak ditemukan atau sudah dicabut. Muat ulang halaman Pengaturan.')
    await audit(orgCtx(actor), 'device.revoked', id)
    refresh()
    return undefined
  })
}

export async function renameDeviceAction(input: { deviceId: string; name: string }): Promise<ActionResult> {
  return runAction('renameDevice', async () => {
    const actor = await requireTutor()
    const data = z
      .object({ deviceId: z.string().uuid(), name: z.string().trim().min(1, 'Isi nama perangkat.').max(40, 'Nama perangkat paling panjang 40 karakter.') })
      .strict()
      .parse(input)
    if (!(await renameDevice(actor.orgId, data.deviceId, data.name))) throw notFound('Perangkat ini tidak ditemukan atau sudah dicabut. Muat ulang halaman Pengaturan.')
    await audit(orgCtx(actor), 'device.renamed', data.deviceId)
    refresh()
    return undefined
  })
}

export async function removePasskeyAction(passkeyId: string): Promise<ActionResult> {
  return runAction('removePasskey', async () => {
    const actor = await requireTutor()
    const id = z.string().min(1).max(512).parse(passkeyId)
    const mine = await listPasskeys(actor.userId)
    if (!mine.some((k) => k.id === id)) throw notFound('Passkey ini tidak ditemukan di akun ini. Muat ulang halaman Pengaturan.')
    await removePasskey(actor.userId, id)
    await audit(orgCtx(actor), 'passkey.removed', actor.userId)
    refresh()
    return undefined
  })
}

const inviteSchema = z
  .object({
    email: z.string().trim().email('Alamat email belum lengkap. Contoh: nama@domain.id').max(200),
    role: z.enum(['tutor', 'guardian']),
    learnerIds: z.array(z.string().uuid()).min(1, 'Pilih paling sedikit satu learner.').max(20),
  })
  .strict()

export async function inviteMemberAction(input: { email: string; role: 'tutor' | 'guardian'; learnerIds: string[] }): Promise<ActionResult<{ link: string }>> {
  return runAction('inviteMember', async () => {
    const actor = await requireTutor()
    const data = inviteSchema.parse(input)
    const ctx = orgCtx(actor)
    const orgName = await inOrg(ctx, async (tx) => {
      await assertLearnersInOrg(tx, data.learnerIds)
      const [o] = await tx.select({ name: tables.org.name }).from(tables.org).where(eq(tables.org.id, actor.orgId)).limit(1)
      return o?.name ?? 'Kira'
    })
    const { link, inviteId } = await createInvite({ orgId: actor.orgId, userId: actor.userId }, { email: data.email, role: data.role, learnerIds: [...new Set(data.learnerIds)], orgName })
    await inOrg(ctx, (tx) => auditTx(tx, ctx, 'invite.created', inviteId, { role: data.role, learners: data.learnerIds.length }))
    refresh()
    return { link }
  })
}

export async function revokeInviteAction(inviteId: string): Promise<ActionResult> {
  return runAction('revokeInvite', async () => {
    const actor = await requireTutor()
    const id = z.string().uuid().parse(inviteId)
    if (!(await revokeInvite(actor.orgId, id))) throw notFound('Undangan ini tidak ditemukan, sudah dipakai, atau sudah dibatalkan. Muat ulang halaman Pengaturan.')
    await audit(orgCtx(actor), 'invite.revoked', id)
    refresh()
    return undefined
  })
}

export async function changePasswordAction(input: { current: string; next: string }): Promise<ActionResult> {
  return runAction('changePassword', async () => {
    const actor = await requireTutor()
    await throttleIp('change-password', 10)
    const data = z
      .object({ current: z.string().min(1, 'Isi password sekarang.').max(128), next: z.string().min(1, 'Isi password baru.').max(128, 'Password paling panjang 128 karakter.') })
      .strict()
      .parse(input)
    await changePassword({ userId: actor.userId, sessionId: actor.sessionId, email: actor.email, name: actor.name }, data.current, data.next)
    await audit(orgCtx(actor), 'password.changed', actor.userId)
    return undefined
  })
}
