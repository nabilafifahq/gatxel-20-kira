'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/lib/dto'
import { orgCtx, requireTutor } from '../auth/actor'
import { inOrg } from '../db'
import { invalid, runAction } from '../errors'
import { gradeResponseTx, requestAiSuggestionTx } from '../dal/console-inbox'

const FEEDBACK_MAX = 600

const gradeSchema = z
  .object({
    responseId: z.string().uuid(),
    scores: z.array(z.number().int().min(0).max(10)).min(1).max(10),
    feedback: z.string().max(FEEDBACK_MAX),
    acceptedAi: z.boolean(),
  })
  .strict()

/** T05: simpan nilai rubrik dan pesan untuk learner. */
export async function gradeAction(input: { responseId: string; scores: number[]; feedback: string; acceptedAi: boolean }): Promise<ActionResult> {
  return runAction('grade', async () => {
    const actor = await requireTutor()
    if (typeof input?.feedback === 'string' && input.feedback.trim().length > FEEDBACK_MAX) {
      throw invalid(`Pesan untuk learner paling banyak ${FEEDBACK_MAX} karakter, sekarang ${input.feedback.trim().length}. Pendekkan pesannya, lalu simpan lagi.`, { feedback: 'Pesan terlalu panjang.' })
    }
    const data = gradeSchema.parse({ ...input, feedback: typeof input?.feedback === 'string' ? input.feedback.trim() : input?.feedback })
    const ctx = orgCtx(actor)
    await inOrg(ctx, (tx) => gradeResponseTx(tx, ctx, data))
    refresh()
    return undefined
  })
}

/** T05: minta saran nilai dari worker AI (job ai.grade). Tidak mengirim nama learner. */
export async function requestAiSuggestionAction(responseId: string): Promise<ActionResult> {
  return runAction('requestAiSuggestion', async () => {
    const actor = await requireTutor()
    const id = z.string().uuid().parse(responseId)
    const ctx = orgCtx(actor)
    await inOrg(ctx, (tx) => requestAiSuggestionTx(tx, ctx, id))
    refresh()
    return undefined
  })
}
