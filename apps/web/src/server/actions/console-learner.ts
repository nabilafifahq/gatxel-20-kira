'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/lib/dto'
import { requireTutor } from '../auth/actor'
import { runAction } from '../errors'
import { addNote } from '../dal/console-learner'

/** T02 Detail learner: catatan tutor. */

const noteSchema = z
  .object({
    learnerId: z.string().uuid(),
    body: z.string().trim().min(1, 'Tulis catatannya dulu, lalu simpan.').max(2000, 'Catatan paling panjang 2.000 karakter.'),
  })
  .strict()

export async function addNoteAction(learnerId: string, body: string): Promise<ActionResult> {
  return runAction('addNote', async () => {
    const actor = await requireTutor()
    const data = noteSchema.parse({ learnerId, body })
    await addNote(actor, data.learnerId, data.body)
    refresh()
    return undefined
  })
}
