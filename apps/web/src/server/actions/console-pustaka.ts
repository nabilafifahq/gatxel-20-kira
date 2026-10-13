'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { isIsoDate } from '@kira/core/time'
import type { ActionResult } from '@/lib/dto'
import type { ProgramStartResult } from '@/lib/dto-paper'
import { orgCtx, requireTutor } from '../auth/actor'
import { inOrg } from '../db'
import { runAction } from '../errors'
import { cancelProgramTx, startProgramTx } from '../dal/console-program'
import { setSourceEnabledTx } from '../dal/console-sources'

/** Pustaka paper: program olimpiade dan sumber soal. Setiap action memeriksa sesi tutor sendiri; kepemilikan diperiksa RLS. */

const isoDate = z.string().max(10).refine((v) => isIsoDate(v), 'Tanggal mulai tidak valid. Pilih tanggal dari kalender.')

export async function startProgramAction(input: { learnerId: string; programId: string; startDate: string }): Promise<ActionResult<ProgramStartResult>> {
  return runAction('startProgram', async () => {
    const actor = await requireTutor()
    const data = z
      .object({ learnerId: z.string().uuid(), programId: z.string().regex(/^[a-z0-9-]+$/).max(60), startDate: isoDate })
      .strict()
      .parse(input)
    const ctx = orgCtx(actor)
    const result = await inOrg(ctx, (tx) => startProgramTx(tx, ctx, data))
    refresh()
    return result
  })
}

export async function cancelProgramAction(input: { runId: string }): Promise<ActionResult<{ removed: number }>> {
  return runAction('cancelProgram', async () => {
    const actor = await requireTutor()
    const data = z.object({ runId: z.string().uuid() }).strict().parse(input)
    const ctx = orgCtx(actor)
    const result = await inOrg(ctx, (tx) => cancelProgramTx(tx, ctx, data.runId))
    refresh()
    return result
  })
}

export async function setSourceEnabledAction(input: { sourceId: string; enabled: boolean }): Promise<ActionResult> {
  return runAction('setSourceEnabled', async () => {
    const actor = await requireTutor()
    const data = z.object({ sourceId: z.string().regex(/^[a-z0-9-]+$/).max(60), enabled: z.boolean() }).strict().parse(input)
    const ctx = orgCtx(actor)
    await inOrg(ctx, (tx) => setSourceEnabledTx(tx, ctx, data))
    refresh()
    return undefined
  })
}
