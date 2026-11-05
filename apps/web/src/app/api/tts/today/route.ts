import { NextResponse } from 'next/server'
import { getActor } from '@/server/auth/actor'
import { throttleResponse } from '@/server/auth/ratelimit'
import { clipsServed, servedIdVoiceVersion, servedVoiceVersion } from '@/server/tts'

export const dynamic = 'force-dynamic'

/**
 * Status suara klip. Dipakai layar learner: enabled memberi tahu apakah perlu meminta klip baru.
 * urls selalu kosong, hanya untuk halaman lama yang masih terbuka: klip diambil saat soalnya tampil, bukan seluruh sesi di muka.
 */
export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const limited = await throttleResponse('tts-today', 120, actor.userId)
  if (limited) return limited
  return NextResponse.json({ enabled: clipsServed(), urls: [], voiceVersion: servedVoiceVersion(), idVoiceVersion: servedIdVoiceVersion() }, { headers: { 'Cache-Control': 'no-store' } })
}
