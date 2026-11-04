'use server'

import { z } from 'zod'
import type { ActionResult } from '@/lib/dto'
import { orgCtx, requireLearner } from '../auth/actor'
import { inOrg } from '../db'
import { forbidden } from '../errors'
import { tOf } from '@/lib/i18n'
import { runLearnerAction as runAction } from './learner-run'
import { isFeatureOn } from '../dal/learner-features'
import { removeWordTx, saveWordTx } from '../dal/vocab'

/**
 * Kamus Ketuk: simpan dan hapus kata pribadi. Setiap action: requireLearner(), Zod .strict(), saklar fitur,
 * lalu transaksi org (RLS membatasi baris ke anak itu sendiri).
 */

const wordInput = z.object({ word: z.string().trim().min(1).max(40) }).strict()

export async function saveWordAction(input: { word: string }): Promise<ActionResult<{ word: string }>> {
  return runAction(
    'saveWord',
    async () => {
      const actor = await requireLearner()
      const data = wordInput.parse(input)
      if (!(await isFeatureOn(actor.userId, 'dictionary'))) throw forbidden(tOf(actor).reading.errors.dictionaryOff)
      const word = await inOrg(orgCtx(actor), (tx) => saveWordTx(tx, actor.orgId, actor.userId, data.word))
      return { word }
    },
  )
}

export async function removeWordAction(input: { word: string }): Promise<ActionResult> {
  return runAction(
    'removeWord',
    async () => {
      const actor = await requireLearner()
      const data = wordInput.parse(input)
      await inOrg(orgCtx(actor), (tx) => removeWordTx(tx, actor.userId, data.word))
      return undefined
    },
  )
}
