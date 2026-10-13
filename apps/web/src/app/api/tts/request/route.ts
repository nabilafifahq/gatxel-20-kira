import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TTS_STYLE_IDS } from '@kira/core/tts'
import { getActor, orgCtx } from '@/server/auth/actor'
import { inOrg } from '@/server/db'
import { requestClips } from '@/server/dal/tts'
import { sameOrigin } from '@/server/http'

export const dynamic = 'force-dynamic'

const body = z
  .object({
    clips: z.array(z.object({ text: z.string().min(1).max(400), style: z.enum(TTS_STYLE_IDS) }).strict()).min(1).max(12),
  })
  .strict()

/**
 * Layar learner meminta suara untuk teks yang belum punya klip (konten baru). Klip dibuat worker; tablet
 * sementara memakai suara bawaan. Learner dan dewasa boleh meminta. Teks hanya dibacakan, tidak disimpan
 * bersama data anak, dan klip dipakai bersama semua org.
 */
export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403 })
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const queued = await inOrg(orgCtx(actor), (tx) => requestClips(tx, orgCtx(actor), parsed.data.clips))
  return NextResponse.json({ queued }, { headers: { 'Cache-Control': 'no-store' } })
}
