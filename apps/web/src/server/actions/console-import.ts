'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/lib/dto'
import { orgCtx, requireTutor } from '../auth/actor'
import { inOrg } from '../db'
import { invalid, runAction } from '../errors'
import { limitFor } from '../media'
import { approveImportItemsTx, createImportBatch, parseLabels, updateImportItemTx } from '../dal/console-import'

const uploadFields = z
  .object({
    subject: z.enum(['math', 'english', 'science']),
    grade: z.coerce.number().int().min(1).max(6),
    tags: z.string().max(200, 'Label paling banyak 200 karakter.'),
    owned: z.string().max(10).nullable(),
    title: z.string().max(300).nullable(),
  })
  .strict()

/** Nama paket dari isian atau nama berkas: tanpa karakter kontrol, spasi dirapikan, paling panjang 200. */
function cleanTitle(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex -- membuang karakter kontrol dari nama berkas
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

/** T12: unggah PDF paket milik keluarga lalu antrekan job ai.import (worker membaca soal dan kunci). */
export async function uploadPdfAction(form: FormData): Promise<ActionResult<{ batchId: string }>> {
  return runAction('uploadPdf', async () => {
    const actor = await requireTutor()
    if (!(form instanceof FormData)) throw invalid('Formulir unggah tidak lengkap. Muat ulang halaman, lalu unggah lagi.')
    const file = form.get('file')
    if (!(file instanceof Blob) || file.size === 0) throw invalid('Pilih file PDF paket dulu.', { file: 'Pilih file PDF paket.' })
    const max = limitFor('pdf')
    if (file.size > max) {
      throw invalid(`Ukuran file ${(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB, batasnya ${Math.round(max / 1024 / 1024)} MB. Pisahkan PDF per bagian, lalu unggah satu per satu.`, { file: 'File terlalu besar.' })
    }
    const fields = uploadFields.parse({
      subject: form.get('subject'),
      grade: form.get('grade'),
      tags: form.get('tags') ?? '',
      owned: form.get('owned'),
      title: form.get('title'),
    })
    if (!['yes', 'on', 'true'].includes(fields.owned ?? '')) {
      throw invalid('Centang pernyataan bahwa paket ini milik keluarga. Hanya paket milik keluarga yang boleh diimpor.', { owned: 'Centang pernyataan ini.' })
    }
    const fileName = file instanceof File ? file.name : ''
    const title = cleanTitle(fields.title || fileName) || 'Paket impor'
    const batchId = await createImportBatch(actor, {
      buf: Buffer.from(await file.arrayBuffer()),
      title,
      subject: fields.subject,
      grade: fields.grade,
      labels: parseLabels(fields.tags),
    })
    // Layar langsung pindah ke ?paket=<id>, jadi tidak perlu refresh.
    return { batchId }
  })
}

const editSchema = z
  .object({
    batchId: z.string().uuid(),
    index: z.number().int().min(0).max(999),
    prompt: z.string().trim().min(1, 'Teks soal masih kosong.').max(900, 'Teks soal paling banyak 900 karakter.'),
    options: z.array(z.string().trim().min(1, 'Ada opsi yang masih kosong.').max(160, 'Opsi paling banyak 160 karakter.')).min(2).max(5),
    answer: z.number().int().min(0).max(4).nullable(),
  })
  .strict()

/** T12: simpan perbaikan satu soal impor (teks, opsi, kunci). */
export async function updateImportItemAction(input: { batchId: string; index: number; prompt: string; options: string[]; answer: number | null }): Promise<ActionResult> {
  return runAction('updateImportItem', async () => {
    const actor = await requireTutor()
    const parsed = editSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      throw invalid(`${first?.message ?? 'Isian soal belum benar.'} Perbaiki lalu simpan lagi.`, { [first?.path.join('.') || '_']: first?.message ?? 'Tidak valid.' })
    }
    const ctx = orgCtx(actor)
    await inOrg(ctx, (tx) => updateImportItemTx(tx, ctx, parsed.data))
    refresh()
    return undefined
  })
}

/** T12: setujui soal impor menjadi soal org bersumber imported. */
export async function approveImportItemsAction(input: { batchId: string; indexes: number[] }): Promise<ActionResult<{ created: number }>> {
  return runAction('approveImportItems', async () => {
    const actor = await requireTutor()
    const data = z
      .object({ batchId: z.string().uuid(), indexes: z.array(z.number().int().min(0).max(999)).min(1).max(500) })
      .strict()
      .parse(input)
    const ctx = orgCtx(actor)
    const result = await inOrg(ctx, (tx) => approveImportItemsTx(tx, ctx, data))
    refresh()
    return result
  })
}
