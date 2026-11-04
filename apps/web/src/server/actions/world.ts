'use server'

import { z } from 'zod'
import { refresh } from 'next/cache'
import { jakartaDate } from '@kira/core'
import type { ActionResult } from '@/lib/dto'
import type { CardMiniDTO } from '@/lib/dto-world'
import { tOf } from '@/lib/i18n'
import { getT } from '@/lib/i18n/server'
import { systemCtx } from '../audit'
import { inOrg } from '../db'
import { orgCtx, requireLearner } from '../auth/actor'
import { requireParent, withFamilyAdmin } from '../auth/parent'
import { AppError, forbidden, runAction, toFailure } from '../errors'
import { isFeatureOn } from '../dal/learner-features'
import { addMedal, applyLook, buyItem, choosePet, equipItem, finishChapter, removeMedal, treatPet } from '../dal/kira-world'

/**
 * Aksi Kira World. Urutan: requireLearner (atau requireParent), Zod .strict(), saklar fitur, lalu DAL.
 * Saldo bintang, kepemilikan, dan syarat dicek di DAL di bawah kunci, bukan di layar.
 */

async function learner() {
  const actor = await requireLearner()
  if (!(await isFeatureOn(actor.userId, 'kira-world'))) throw forbidden(tOf(actor).world.errors.switchedOff)
  return actor
}

/** Seperti runAction, dengan pesan umum dalam bahasa anak. Bahasanya hanya dibaca di jalur error. */
async function runForChild<T>(context: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    const failure = toFailure(e, context, 'en-GB')
    if (e instanceof AppError) return failure
    const { errors } = (await getT()).world
    return { ...failure, message: e instanceof z.ZodError ? errors.notRight : errors.generic }
  }
}

const idText = z.string().min(1).max(60).regex(/^[a-z0-9-]+$/)

export async function finishChapterAction(input: unknown): Promise<ActionResult<{ cards: CardMiniDTO[] }>> {
  return runAction(
    'finishChapter',
    async () => {
      const actor = await learner()
      const data = z.object({ n: z.number().int().min(1).max(20) }).strict().parse(input)
      return inOrg(orgCtx(actor), (tx) => finishChapter(tx, actor.userId, data.n))
    },
    'en-GB',
  )
}

export async function choosePetAction(input: unknown): Promise<ActionResult> {
  return runForChild(
    'choosePet',
    async () => {
      const actor = await learner()
      const data = z.object({ kind: idText, name: z.string().min(1).max(30) }).strict().parse(input)
      await inOrg(orgCtx(actor), (tx) => choosePet(tx, actor.userId, data))
      refresh()
      return undefined
    },
  )
}

export async function treatPetAction(input: unknown): Promise<ActionResult<{ line: string; hearts: number }>> {
  return runForChild(
    'treatPet',
    async () => {
      const actor = await learner()
      const data = z.object({ treatId: idText, nonce: z.string().min(8).max(40).regex(/^[a-zA-Z0-9-]+$/) }).strict().parse(input)
      const r = await inOrg(orgCtx(actor), (tx) => treatPet(tx, actor.userId, data.treatId, data.nonce))
      refresh()
      return r
    },
  )
}

export async function buyItemAction(input: unknown): Promise<ActionResult> {
  return runForChild(
    'buyItem',
    async () => {
      const actor = await learner()
      const data = z.object({ id: idText }).strict().parse(input)
      await inOrg(orgCtx(actor), (tx) => buyItem(tx, actor.userId, data.id))
      refresh()
      return undefined
    },
  )
}

export async function equipItemAction(input: unknown): Promise<ActionResult> {
  return runForChild(
    'equipItem',
    async () => {
      const actor = await learner()
      const data = z.object({ kind: z.enum(['petcostume', 'pethome', 'frame', 'outfit', 'backdrop']), id: idText.nullable() }).strict().parse(input)
      const look = await inOrg(orgCtx(actor), (tx) => equipItem(tx, actor.userId, data.kind, data.id))
      // Pakaian dan latar avatar ada di profil, yang hanya boleh ditulis peran sistem (seperti peti hadiah).
      if (look) await inOrg(systemCtx(actor.orgId), (tx) => applyLook(tx, actor.userId, look.look, look.value))
      refresh()
      return undefined
    },
  )
}

// ---------------------------------------------------------------------------
// Orang tua: medali lomba sungguhan (id)

const medalInput = z
  .object({
    learnerId: z.string().uuid(),
    title: z.string().trim().min(2).max(80),
    medal: z.enum(['gold', 'silver', 'bronze', 'honour', 'participant']),
    earnedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict()
  .refine((v) => v.earnedOn <= jakartaDate(), { message: 'Tanggal tidak boleh di masa depan.', path: ['earnedOn'] })

export async function parentAddMedalAction(input: unknown): Promise<ActionResult> {
  return runAction('parentAddMedal', async () => {
    const actor = await requireParent()
    const data = medalInput.parse(input)
    await withFamilyAdmin(actor, async (tx, scope) => {
      await scope.assertParentOf(data.learnerId)
      await addMedal(tx, data.learnerId, data)
    })
    refresh()
    return undefined
  })
}

export async function parentRemoveMedalAction(input: unknown): Promise<ActionResult> {
  return runAction('parentRemoveMedal', async () => {
    const actor = await requireParent()
    const data = z.object({ learnerId: z.string().uuid(), medalId: z.string().uuid() }).strict().parse(input)
    await withFamilyAdmin(actor, async (tx, scope) => {
      await scope.assertParentOf(data.learnerId)
      await removeMedal(tx, data.learnerId, data.medalId)
    })
    refresh()
    return undefined
  })
}
