'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { SKILL_ID } from '@kira/content/schema'
import type { ActionResult } from '@/lib/dto'
import { orgCtx, requireTutor } from '../auth/actor'
import { inOrg } from '../db'
import { runAction } from '../errors'
import { approveDraftTx, rejectDraftTx, requestDraftsTx } from '../dal/console-studio'

const requestSchema = z
  .object({
    kind: z.enum(['items', 'variants', 'hints', 'translate', 'rubric']),
    skillId: z.string().regex(SKILL_ID).max(80),
    count: z.number().int().min(1).max(10),
    difficulty: z.number().int().min(1).max(5),
    itemRef: z.string().trim().max(200).optional(),
    instructions: z.string().max(500),
  })
  .strict()

/** T11: minta draf ke worker AI (job ai.items, ai.variants, ai.hints, ai.translate, ai.rubric). */
export async function requestDraftsAction(input: {
  kind: 'items' | 'variants' | 'hints' | 'translate' | 'rubric'
  skillId: string
  count: number
  difficulty: number
  itemRef?: string
  instructions: string
}): Promise<ActionResult> {
  return runAction('requestDrafts', async () => {
    const actor = await requireTutor()
    const data = requestSchema.parse(input)
    const ctx = orgCtx(actor)
    await inOrg(ctx, (tx) => requestDraftsTx(tx, ctx, data))
    refresh()
    return undefined
  })
}

/** T11: setujui draf (JSON boleh sudah diedit tutor) menjadi soal org. */
export async function approveDraftAction(input: { draftId: string; json: string }): Promise<ActionResult<{ ref: string }>> {
  return runAction('approveDraft', async () => {
    const actor = await requireTutor()
    const data = z.object({ draftId: z.string().uuid(), json: z.string().min(2).max(100_000) }).strict().parse(input)
    const ctx = orgCtx(actor)
    const result = await inOrg(ctx, (tx) => approveDraftTx(tx, ctx, data.draftId, data.json))
    refresh()
    return result
  })
}

export async function rejectDraftAction(draftId: string): Promise<ActionResult> {
  return runAction('rejectDraft', async () => {
    const actor = await requireTutor()
    const id = z.string().uuid().parse(draftId)
    const ctx = orgCtx(actor)
    await inOrg(ctx, (tx) => rejectDraftTx(tx, ctx, id))
    refresh()
    return undefined
  })
}
