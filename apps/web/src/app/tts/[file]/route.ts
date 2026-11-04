import { NextResponse } from 'next/server'
import { ttsKeyFromFile } from '@kira/core/tts'
import { getActor } from '@/server/auth/actor'
import { throttleIp } from '@/server/auth/ratelimit'
import { clipFile } from '@/server/tts'
import { serveClip } from '@/server/tts-serve'

export const dynamic = 'force-dynamic'

const IMMUTABLE_PUBLIC = 'public, max-age=31536000, immutable'
const IMMUTABLE_PRIVATE = 'private, max-age=31536000, immutable'
/** Permintaan yang meleset (404) per menit per alamat. Anak di satu jaringan sekolah berbagi alamat, jadi batasnya longgar. */
const MISSES_PER_MINUTE = 600

const miss = () => new NextResponse('Tidak ditemukan', { status: 404, headers: { 'Cache-Control': 'no-store' } })

/**
 * Sajikan klip suara bahasa Inggris.
 *
 * - Klip publik (teks konten bersama) dilayani tanpa sesi dengan `public, max-age=31536000, immutable`: nama berkas
 *   adalah sha256 versi suara, peran, dan teks, jadi isinya tidak pernah berubah, dan CDN atau proxy boleh menyimpannya.
 *   Nama itu tidak bisa ditebak tanpa mengetahui teks dan versi suaranya; permintaan yang meleset dibatasi lajunya.
 * - Klip keluarga (teks soal milik satu org) hanya untuk yang sudah masuk di org itu, dengan `private`.
 * - Klip tidak pernah memuat jawaban atau nama anak.
 * - Isi dialirkan dari disk dan mendukung Range (pemutar mulai tanpa menunggu seluruh berkas).
 */
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const key = ttsKeyFromFile((await params).file)
  if (!key) {
    await throttleIp('tts-miss', MISSES_PER_MINUTE).catch(() => undefined)
    return miss()
  }
  const reqHeaders = { range: req.headers.get('range'), ifNoneMatch: req.headers.get('if-none-match') }
  const pub = await clipFile(key, { kind: 'public' })
  if (pub) return serveClip(pub, { cacheControl: IMMUTABLE_PUBLIC, ...reqHeaders })

  // Meleset di folder publik: batasi laju, lalu cek folder keluarga bila ada sesi.
  try {
    await throttleIp('tts-miss', MISSES_PER_MINUTE)
  } catch {
    return new NextResponse('Terlalu banyak permintaan', { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } })
  }
  const actor = await getActor()
  if (!actor) return miss()
  const own = await clipFile(key, { kind: 'org', orgId: actor.orgId })
  if (!own) return miss()
  return serveClip(own, { cacheControl: IMMUTABLE_PRIVATE, ...reqHeaders })
}
