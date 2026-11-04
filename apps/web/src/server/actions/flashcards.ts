'use server'

import type { ActionResult } from '@/lib/dto'
import { inOrg } from '../db'
import { runLearnerAction as runAction } from './learner-run'
import { orgCtx, requireLearner } from '../auth/actor'
import { finishCards } from '../dal/flashcards'
import { assertFeatureOn } from '../dal/learner-features'

/** Selesaikan satu putaran kartu: auth anak, Zod strict di DAL, jadwal FSRS per kartu, XP dibatasi per hari. */
export async function finishCardsAction(input: unknown): Promise<ActionResult<{ xp: number; knew: number; total: number }>> {
  return runAction(
    'finishCards',
    async () => {
      const actor = await requireLearner()
      await assertFeatureOn(actor.userId, 'flashcards', 'vocab')
      return inOrg(orgCtx(actor), (tx) => finishCards(tx, orgCtx(actor), actor.userId, input))
    },
  )
}
