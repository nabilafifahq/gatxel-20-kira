import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import { getSession } from '@/server/auth/session'
import { apkPath } from '@/server/dal/console-settings'
import { env } from '@/server/env'

export const dynamic = 'force-dynamic'

/**
 * Unduh APK tablet (<KIRA_DATA_DIR>/apk/kira.apk). Hanya untuk orang dewasa yang masuk
 * (tutor atau orang tua); tablet anak memasangnya saat orang dewasa sedang masuk.
 */
export async function GET() {
  const actor = await getSession()
  if (!actor || (actor.role !== 'tutor' && actor.role !== 'guardian')) {
    return NextResponse.json({ ok: false, message: 'Masuk sebagai tutor atau orang tua untuk mengunduh aplikasi tablet.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  const file = apkPath(env().KIRA_DATA_DIR)
  let size: number
  try {
    const s = await stat(file)
    if (!s.isFile() || s.size === 0) throw new Error('bukan berkas')
    size = s.size
  } catch {
    return NextResponse.json(
      { ok: false, message: 'APK belum ada di server ini. Taruh berkas kira.apk di folder apk di dalam folder data server, sesuai panduan pemasangan.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    )
  }
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="kira.apk"',
      'Content-Length': String(size),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
