'use server'

import type { ActionResult } from '@/lib/dto'
import { requireParent } from '../auth/parent'
import { createWorksheet } from '../dal/worksheet'
import { runAction } from '../errors'
import { worksheetSchema } from './coach-schemas'

/** Aksi Pelatih Orang Tua. Urutan: requireParent, Zod strict, lalu pemeriksaan guardian_link di DAL. */

export async function createWorksheetAction(input: unknown): Promise<ActionResult<{ id: string; sheetHref: string; keyHref: string }>> {
  return runAction('createWorksheet', async () => {
    const actor = await requireParent()
    const data = worksheetSchema.parse(input)
    const { id } = await createWorksheet(actor, data)
    return { id, sheetHref: `/cetak/lembar/${id}`, keyHref: `/cetak/lembar/${id}/kunci` }
  })
}
