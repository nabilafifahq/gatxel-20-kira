import { NextResponse } from 'next/server'
import { getActor, orgCtx } from '@/server/auth/actor'
import { throttleResponse } from '@/server/auth/ratelimit'
import { inOrg } from '@/server/db'
import { todayClipUrls } from '@/server/dal/tts'
import { clipsServed, servedVoiceVersion } from '@/server/tts'

export const dynamic = 'force-dynamic'

/**
 * Status suara klip dan alamat klip untuk sesi hari ini (hanya yang sudah ada). Dipakai layar learner:
 * enabled memberi tahu apakah perlu meminta klip baru, urls disimpan service worker untuk offline.
 */
export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const limited = await throttleResponse('tts-today', 120, actor.userId)
  if (limited) return limited
  const enabled = clipsServed()
  const urls = enabled && actor.role === 'learner' ? await inOrg(orgCtx(actor), (tx) => todayClipUrls(tx, actor.orgId, actor.userId)) : []
  return NextResponse.json({ enabled, urls, voiceVersion: servedVoiceVersion() }, { headers: { 'Cache-Control': 'no-store' } })
}
