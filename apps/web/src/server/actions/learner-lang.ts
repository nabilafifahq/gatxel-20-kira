'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/lib/dto'
import { tOf } from '@/lib/i18n'
import { UI_LANGS } from '@/lib/i18n/lang'
import { requireLearner } from '../auth/actor'
import { setLearnerUiPrefs } from '../auth/accounts'
import { forbidden, runAction } from '../errors'

/** Anak mengganti bahasa tampilan sendiri, hanya bila orang tua mengizinkan. */
export async function setMyUiLangAction(input: unknown): Promise<ActionResult<null>> {
  return runAction('setMyUiLang', async () => {
    const actor = await requireLearner()
    const data = z.object({ uiLang: z.enum(UI_LANGS) }).strict().parse(input)
    if (!actor.uiLangSwitch) throw forbidden(tOf(actor).common.langSwitch.notAllowed)
    await setLearnerUiPrefs(actor.userId, actor.orgId, { uiLang: data.uiLang })
    refresh()
    return null
  })
}
