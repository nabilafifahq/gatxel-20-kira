'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { isIsoDate } from '@kira/core/time'
import { SKILL_ID } from '@kira/content'
import type { ActionResult, BankItemRow } from '@/lib/dto'
import type { ClientItem } from '@kira/content/present'
import { inOrg } from '../db'
import { runAction } from '../errors'
import { orgCtx, requireTutor } from '../auth/actor'
import { assignPaper, deletePaper, generatePaper, isPaperRef, PAPER_MAX_ITEMS, savePaper } from '../dal/console-paper'

const subject = z.enum(['math', 'english', 'science'])

const saveSchema = z
  .object({
    paperId: z.string().uuid().optional(),
    title: z.string().trim().min(1, 'Isi judul paper dulu.').max(80, 'Judul paling banyak 80 huruf.'),
    subject,
    grade: z.number().int().min(1).max(6),
    minutes: z.number().int().min(5, 'Waktu paling sedikit 5 menit.').max(120, 'Waktu paling lama 120 menit.'),
    mode: z.enum(['latihan', 'tes', 'kertas']),
    itemRefs: z
      .array(z.string().min(3).max(80).refine(isPaperRef, 'Ref soal tidak dikenal.'))
      .min(1, 'Paper belum berisi soal. Tambahkan paling sedikit satu soal.')
      .max(PAPER_MAX_ITEMS, `Paper paling banyak ${PAPER_MAX_ITEMS} soal.`),
  })
  .strict()

export async function savePaperAction(input: z.input<typeof saveSchema>): Promise<ActionResult<{ paperId: string }>> {
  return runAction('savePaper', async () => {
    const actor = await requireTutor()
    const data = saveSchema.parse(input)
    const ctx = orgCtx(actor)
    const r = await inOrg(ctx, (tx) => savePaper(tx, ctx, data))
    refresh()
    return { paperId: r.paperId }
  })
}

const generateSchema = z
  .object({
    subject,
    grade: z.number().int().min(1).max(6),
    skillIds: z.array(z.string().regex(SKILL_ID).max(60)).max(60),
    count: z.number().int().min(1, 'Jumlah soal paling sedikit 1.').max(PAPER_MAX_ITEMS, `Jumlah soal paling banyak ${PAPER_MAX_ITEMS}.`),
    difficulty: z.tuple([z.number().int().min(1).max(5), z.number().int().min(1).max(5)]),
  })
  .strict()

export async function generatePaperAction(input: z.input<typeof generateSchema>): Promise<ActionResult<{ itemRefs: string[]; items?: (BankItemRow & { preview: ClientItem })[] }>> {
  return runAction('generatePaper', async () => {
    const actor = await requireTutor()
    const data = generateSchema.parse(input)
    const ctx = orgCtx(actor)
    return inOrg(ctx, (tx) => generatePaper(tx, ctx, data))
  })
}

const assignSchema = z
  .object({
    paperId: z.string().uuid(),
    learnerId: z.string().uuid('Pilih learner dulu.'),
    date: z.string().refine(isIsoDate, 'Pilih tanggal yang valid.'),
  })
  .strict()

export async function assignPaperAction(input: z.input<typeof assignSchema>): Promise<ActionResult> {
  return runAction('assignPaper', async () => {
    const actor = await requireTutor()
    const data = assignSchema.parse(input)
    const ctx = orgCtx(actor)
    await inOrg(ctx, (tx) => assignPaper(tx, ctx, data))
    refresh()
    return undefined
  })
}

export async function deletePaperAction(paperId: string): Promise<ActionResult> {
  return runAction('deletePaper', async () => {
    const actor = await requireTutor()
    const id = z.string().uuid().parse(paperId)
    const ctx = orgCtx(actor)
    await inOrg(ctx, (tx) => deletePaper(tx, ctx, id))
    refresh()
    return undefined
  })
}
