'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { isIsoDate, jakartaDate, weekday } from '@kira/core/time'
import type { ActionResult } from '@/lib/dto'
import { inOrg } from '../db'
import { invalid, runAction } from '../errors'
import { auditTx } from '../audit'
import { orgCtx, requireTutor } from '../auth/actor'
import { deliverWeekReport, NOTE_MAX } from '../dal/console-report'
import { thisWeekStart } from '../dal/console-common'
import { EXPORT_PSEUDONYM, learnerExport } from '../dal/data-export'

const sendSchema = z
  .object({
    learnerId: z.string().uuid(),
    weekStart: z.string().length(10).refine(isIsoDate, 'Tanggal minggu tidak valid.'),
    note: z.string().max(2000),
  })
  .strict()

/** T09: kirim laporan minggu ke orang tua (email lewat kotak keluar) dan simpan catatan tutor. */
export async function sendReportAction(input: { learnerId: string; weekStart: string; note: string }): Promise<ActionResult> {
  return runAction('sendReport', async () => {
    const actor = await requireTutor()
    const data = sendSchema.parse(input)
    const note = data.note.trim()
    if (note.length > NOTE_MAX) throw invalid(`Catatan paling panjang ${NOTE_MAX} karakter. Sekarang ${note.length}. Pendekkan catatan lalu kirim lagi.`, { note: `Paling panjang ${NOTE_MAX} karakter.` })
    if (weekday(data.weekStart) !== 1) throw invalid('Minggu laporan harus dimulai hari Senin. Muat ulang halaman laporan.')
    if (data.weekStart > thisWeekStart(jakartaDate())) throw invalid('Laporan minggu depan belum bisa dikirim. Pilih minggu ini atau minggu sebelumnya.')
    await deliverWeekReport(orgCtx(actor), { learnerId: data.learnerId, weekStart: data.weekStart, mode: 'manual', note, createdBy: actor.userId })
    refresh()
    return undefined
  })
}

/** T09: ekspor lengkap data learner sebagai JSON, nama diganti learner_1 (layar bisa memasukkan nama asli). */
export async function exportJsonAction(learnerId: string): Promise<ActionResult<{ filename: string; json: string }>> {
  return runAction('exportJson', async () => {
    const actor = await requireTutor()
    const id = z.string().uuid().parse(learnerId)
    const ctx = orgCtx(actor)
    const out = await inOrg(ctx, async (tx) => {
      const e = await learnerExport(tx, id, { pseudonym: EXPORT_PSEUDONYM })
      await auditTx(tx, ctx, 'data.exported', id, { from: 'report', pseudonym: true })
      return e
    })
    return { filename: out.filename, json: out.json }
  })
}
