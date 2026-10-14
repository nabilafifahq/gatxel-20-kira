'use server'

import { z } from 'zod'
import type { AccessoryId } from '@kira/core'
import { CHEST_ACCESSORY_IDS, CHEST_BACKGROUNDS } from '@kira/core'
import type { ActionResult } from '@/lib/dto'
import type { ChestRewardDTO } from '@/lib/dto-motion'
import { inOrg } from '../db'
import { orgCtx, requireLearner } from '../auth/actor'
import { runAction } from '../errors'
import { systemCtx } from '../audit'
import { applyAccessory } from '../dal/arena-tracks'
import { todayDTO } from '../dal/learner-today'
import { applyBackground, assertChestOwned, openChestTx } from '../dal/learner-motion'

/**
 * Peti hadiah harian. Setiap action: requireLearner() lebih dulu, lalu Zod .strict(). Syarat "semua sesi wajib
 * selesai" dan "satu peti per hari" dicek di server (openChestTx), bukan di layar.
 */

const noInput = z.object({}).strict()

export async function openChestAction(input: Record<string, never> = {}): Promise<ActionResult<ChestRewardDTO>> {
  return runAction(
    'openChest',
    async () => {
      const actor = await requireLearner()
      noInput.parse(input)
      const ctx = orgCtx(actor)
      return inOrg(ctx, async (tx) => {
        const today = await todayDTO(tx, ctx, actor.userId)
        return openChestTx(tx, actor.orgId, actor.userId, today)
      })
    },
    'en-GB',
  )
}

const equip = z
  .object({
    kind: z.enum(['accessory', 'background']),
    id: z.string().min(1).max(40).nullable(),
  })
  .strict()
  .refine((v) => v.id === null || (v.kind === 'accessory' ? CHEST_ACCESSORY_IDS.includes(v.id) : CHEST_BACKGROUNDS.some((b) => b.id === v.id)), { message: 'Unknown reward.' })

/** Pakai (atau lepas, id null) aksesori atau latar yang sudah didapat dari peti. */
export async function equipChestRewardAction(input: { kind: 'accessory' | 'background'; id: string | null }): Promise<ActionResult> {
  return runAction(
    'equipChestReward',
    async () => {
      const actor = await requireLearner()
      const data = equip.parse(input)
      if (data.id !== null) await inOrg(orgCtx(actor), (tx) => assertChestOwned(tx, actor.userId, data.kind, data.id as string))
      await inOrg(systemCtx(actor.orgId), (tx) => (data.kind === 'accessory' ? applyAccessory(tx, actor.userId, data.id as AccessoryId | null) : applyBackground(tx, actor.userId, data.id)))
      return undefined
    },
    'en-GB',
  )
}
