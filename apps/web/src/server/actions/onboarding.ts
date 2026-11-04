'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { AVATARS, PIN_PICTURES } from '@kira/figures/spec'
import type { ActionResult, AvatarName, PinPicture } from '@/lib/dto'
import { requireParent } from '../auth/parent'
import { runAction } from '../errors'
import { addChild, saveChildConsents } from '../dal/onboarding'
import { UI_LANGS, type UiLang } from '@/lib/i18n/lang'

const consents = z.object({ learning: z.boolean(), 'progress-email': z.boolean(), audio: z.boolean(), photo: z.boolean() }).strict()

/** Orang tua menambah anak sendiri. Argumen action tidak dicatat di log (next.config logging.serverFunctions false). */
export async function addChildAction(input: { name: string; grade: number; avatar: AvatarName; pin: PinPicture[]; uiLang?: UiLang }): Promise<ActionResult<{ learnerId: string }>> {
  return runAction('addChild', async () => {
    const actor = await requireParent()
    const data = z
      .object({
        name: z.string().trim().min(1, 'Isi nama panggilan anak.').max(40, 'Nama panggilan paling banyak 40 karakter.'),
        grade: z.number().int('Pilih kelas 1 sampai 6.').min(1, 'Pilih kelas 1 sampai 6.').max(6, 'Pilih kelas 1 sampai 6.'),
        avatar: z.enum(AVATARS),
        pin: z.array(z.enum(PIN_PICTURES)).length(4, 'Pilih 4 gambar untuk PIN.'),
        uiLang: z.enum(UI_LANGS).optional(),
      })
      .strict()
      .parse(input)
    const learnerId = await addChild(actor, data)
    refresh()
    return { learnerId }
  })
}

export async function saveConsentsAction(input: { learnerId: string; consents: z.infer<typeof consents> }): Promise<ActionResult<{ active: boolean }>> {
  return runAction('saveConsents', async () => {
    const actor = await requireParent()
    const data = z.object({ learnerId: z.string().uuid(), consents }).strict().parse(input)
    const r = await saveChildConsents(actor, data)
    refresh()
    return r
  })
}
