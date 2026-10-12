import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getActor } from '@/server/auth/actor'
import { mediaForViewer } from '@/server/dal/media-rows'
import { readStored } from '@/server/media'

export const dynamic = 'force-dynamic'

/** Sajikan berkas bila RLS mengizinkan peran ini melihatnya (learner sendiri, orang tua anaknya, tutor semua). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return new NextResponse('Masuk dulu', { status: 401 })
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return new NextResponse('Tidak ditemukan', { status: 404 })
  const m = await mediaForViewer(actor, id)
  if (!m) return new NextResponse('Tidak ditemukan', { status: 404 })
  try {
    const buf = await readStored(m.path)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': m.mime,
        'Content-Length': String(buf.length),
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new NextResponse('Berkas tidak ditemukan', { status: 404 })
  }
}
