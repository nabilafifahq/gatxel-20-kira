'use server'

import { z } from 'zod'
import type { ActionResult } from '@/lib/dto'
import type { SpellingAnswerInput, SpellingResultDTO } from '@/lib/dto-english'
import { inOrg } from '../db'
import { runAction } from '../errors'
import { orgCtx, requireLearner } from '../auth/actor'
import { finishSpellingRound } from '../dal/english-skills'

const spellingSchema = z
  .object({
    answers: z
      .array(z.object({ id: z.string().min(3).max(40), typed: z.string().max(40), tries: z.union([z.literal(1), z.literal(2)]) }).strict())
      .min(1)
      .max(10),
  })
  .strict()

/** Selesaikan satu putaran Spelling Bee: server mengecek ejaan dari daftar kata dan memberi XP (dibatasi per hari). */
export async function finishSpellingAction(answers: SpellingAnswerInput[]): Promise<ActionResult<SpellingResultDTO>> {
  return runAction(
    'finishSpelling',
    async () => {
      const actor = await requireLearner()
      const input = spellingSchema.parse({ answers })
      return inOrg(orgCtx(actor), (tx) => finishSpellingRound(tx, orgCtx(actor), actor.userId, input.answers))
    },
    'en-GB',
  )
}
