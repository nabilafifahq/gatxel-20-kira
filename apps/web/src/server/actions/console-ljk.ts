'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/lib/dto'
import { inOrg } from '../db'
import { runAction } from '../errors'
import { orgCtx, requireTutor } from '../auth/actor'
import { saveLjk } from '../dal/console-ljk'

const ljkSchema = z
  .object({
    attemptId: z.string().uuid(),
    answers: z.array(z.string().max(40).nullable()).min(1).max(200),
    submit: z.boolean(),
  })
  .strict()

/** Simpan isian LJK sebagai draf, atau simpan lalu nilai (submit). Nilai selalu dihitung di server. */
export async function saveLjkAction(input: z.input<typeof ljkSchema>): Promise<ActionResult<{ score: string }>> {
  return runAction('saveLjk', async () => {
    const actor = await requireTutor()
    const data = ljkSchema.parse(input)
    const ctx = orgCtx(actor)
    const r = await inOrg(ctx, (tx) => saveLjk(tx, ctx, data))
    refresh()
    return r
  })
}
