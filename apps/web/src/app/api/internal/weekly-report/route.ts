import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isIsoDate, weekday } from '@kira/core/time'
import { systemCtx } from '@/server/audit'
import { safeEqual } from '@/server/auth/crypto'
import { deliverWeekReport, safeErrorText } from '@/server/dal/console-report'
import { env } from '@/server/env'
import { newReference } from '@/server/errors'
import { log } from '@/server/log'

export const dynamic = 'force-dynamic'

/**
 * Dipanggil worker setiap Minggu 19.00 WIB untuk setiap learner aktif (WeeklyReportRequest di @kira/db).
 * Authorization: Bearer KIRA_INTERNAL_TOKEN, dibandingkan dalam waktu konstan. Tanpa token di .env
 * endpoint menjawab 503 dan tidak melakukan apa pun (gagal tertutup).
 * Jawaban sukses: { ok: true, queued } (queued 0 bila learner tidak aktif, minggu itu sudah terkirim,
 * persetujuan email tidak ada, atau tidak ada orang tua dengan email). Error: application/problem+json.
 */

const bodySchema = z
  .object({
    orgId: z.string().uuid(),
    learnerId: z.string().uuid(),
    weekStart: z
      .string()
      .length(10)
      .refine(isIsoDate, 'weekStart harus tanggal YYYY-MM-DD.')
      .refine((d) => weekday(d) === 1, 'weekStart harus hari Senin.'),
  })
  .strict()

function problem(status: number, title: string, detail: string, requestId: string) {
  return NextResponse.json(
    { type: 'about:blank', title, status, detail, requestId },
    { status, headers: { 'Content-Type': 'application/problem+json', 'Cache-Control': 'no-store' } },
  )
}

export async function POST(req: Request) {
  const requestId = newReference()
  const expected = env().KIRA_INTERNAL_TOKEN
  if (!expected) {
    log.warn('endpoint internal dipanggil tanpa KIRA_INTERNAL_TOKEN', { requestId })
    return problem(503, 'Endpoint internal belum diatur', 'Isi KIRA_INTERNAL_TOKEN yang sama di .env web dan worker, lalu mulai ulang keduanya.', requestId)
  }
  const header = req.headers.get('authorization') ?? ''
  const given = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
  if (!given || !safeEqual(given, expected)) {
    log.warn('token internal ditolak', { requestId })
    return problem(401, 'Token internal tidak cocok', 'Periksa KIRA_INTERNAL_TOKEN di .env worker.', requestId)
  }
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return problem(400, 'Isi permintaan bukan JSON', 'Kirim { orgId, learnerId, weekStart } sebagai JSON.', requestId)
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.') || 'body').join(', ')
    return problem(400, 'Isi permintaan tidak valid', `Periksa kolom: ${fields}.`, requestId)
  }
  const { orgId, learnerId, weekStart } = parsed.data
  try {
    const result = await deliverWeekReport(systemCtx(orgId), { learnerId, weekStart, mode: 'scheduled', createdBy: null })
    log.info('laporan mingguan otomatis', { requestId, queued: result.queued, skipped: result.skipped ?? null })
    return NextResponse.json({ ok: true, queued: result.queued, ...(result.skipped ? { skipped: result.skipped } : {}) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    // Pesan error driver bisa memuat parameter query (alamat email): catat nama dan pesan yang sudah dibersihkan saja.
    log.error('laporan mingguan otomatis gagal', { requestId, errorName: e instanceof Error ? e.name : 'unknown', errorText: safeErrorText(e) })
    return problem(500, 'Laporan belum bisa disiapkan', 'Worker akan mencoba lagi. Cari kode ini di log web.', requestId)
  }
}
