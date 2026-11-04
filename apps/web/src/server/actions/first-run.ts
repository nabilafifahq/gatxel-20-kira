'use server'

import { z } from 'zod'
import type { ActionResult } from '@/lib/dto'
import { requireLearner } from '../auth/actor'
import { runAction } from '../errors'
import { markFirstRunDone } from '../dal/learner-entry'

const noInput = z.object({}).strict()

/** Walkthrough pertama anak sudah tampil. Data yang ditulis hanya milik anak yang sedang masuk. */
export async function markFirstRunAction(input: Record<string, never> = {}): Promise<ActionResult> {
  return runAction(
    'markFirstRun',
    async () => {
      const actor = await requireLearner()
      noInput.parse(input)
      await markFirstRunDone(actor.orgId, actor.userId)
      return undefined
    },
    'en-GB',
  )
}
