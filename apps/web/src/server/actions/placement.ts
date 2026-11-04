'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/lib/dto'
import type { PlacementAnswerResultDTO } from '@/lib/dto-placement'
import { auditTx } from '../audit'
import { inOrg } from '../db'
import { orgCtx, requireLearner } from '../auth/actor'
import { requireParent, withFamilyAdmin } from '../auth/parent'
import { assertFeatureOn } from '../dal/learner-features'
import { runAction } from '../errors'
import { answerPlacement, placementAnswerSchema, requestPlacement, skipPlacement } from '../dal/placement'

/**
 * Aksi tes penempatan. Urutan di setiap aksi: sesi (requireLearner atau requireParent), Zod strict, lalu kepemilikan
 * (anak hanya miliknya sendiri; orang tua lewat guardian_link). Jawaban anak tidak pernah dicatat di log.
 */

const subject = z.enum(['math', 'english', 'science'])

export async function answerPlacementAction(input: unknown): Promise<ActionResult<PlacementAnswerResultDTO>> {
  return runAction(
    'answerPlacement',
    async () => {
      const actor = await requireLearner()
      await assertFeatureOn(actor.userId, 'placement')
      const data = placementAnswerSchema.parse(input)
      return inOrg(orgCtx(actor), (tx) => answerPlacement(tx, orgCtx(actor), actor.userId, data))
    },
    'en-GB',
  )
}

export async function skipPlacementAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(
    'skipPlacement',
    async () => {
      const actor = await requireLearner()
      const data = z.object({ subject }).strict().parse(input)
      await inOrg(orgCtx(actor), (tx) => skipPlacement(tx, actor.userId, data.subject))
      revalidatePath('/today')
      return { redirectTo: '/today' }
    },
    'en-GB',
  )
}

const parentRequest = z.object({ learnerId: z.string().uuid('Anak tidak valid. Muat ulang halaman.'), subject }).strict()

export async function parentRequestPlacementAction(input: unknown): Promise<ActionResult<{ ok: true }>> {
  return runAction('parentRequestPlacement', async () => {
    const actor = await requireParent()
    const data = parentRequest.parse(input)
    await withFamilyAdmin(actor, async (tx, scope) => {
      await scope.assertParentOf(data.learnerId)
      await requestPlacement(tx, scope.ctx, data.learnerId, data.subject, 'parent')
      await auditTx(tx, scope.ctx, 'placement.request', data.learnerId, { subject: data.subject })
    })
    revalidatePath(`/keluarga/anak/${data.learnerId}`)
    revalidatePath('/today')
    return { ok: true as const }
  })
}
