import { NextResponse } from 'next/server'
import { ttsKeyFromFile } from '@kira/core/tts'
import { getActor } from '@/server/auth/actor'
import { readClip } from '@/server/tts'

export const dynamic = 'force-dynamic'

/**
 * Sajikan klip suara bahasa Inggris untuk learner dan dewasa yang sudah masuk (cookie sesi, tanpa pihak ketiga).
 * Nama berkas adalah sha256 teks+gaya, jadi isinya tidak pernah berubah dan boleh disimpan lama di perangkat.
 * Tidak ada data anak di klip: hanya teks soal dan pelajaran.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const actor = await getActor()
  if (!actor) return new NextResponse('Masuk dulu', { status: 401, headers: { 'Cache-Control': 'no-store' } })
  const key = ttsKeyFromFile((await params).file)
  if (!key) return new NextResponse('Tidak ditemukan', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  const buf = await readClip(key)
  if (!buf) return new NextResponse('Tidak ditemukan', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(buf.length),
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
