import { googleConfig } from '@/server/auth/google'
import { throttleResponse } from '@/server/auth/ratelimit'
import { isPrefetch, prefetchRefused, seeOther } from '@/server/http'
import { googleCallback } from '@/server/signup/google'

export const dynamic = 'force-dynamic'

/** Kembali dari Google. Autentikasinya state di cookie alur bertanda tangan dan ID token yang diperiksa, lihat googleCallback. */
export async function GET(req: Request) {
  const cfg = googleConfig()
  if (!cfg) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  if (isPrefetch(req)) return prefetchRefused()
  const limited = await throttleResponse('google-callback', 30)
  if (limited) return limited
  return seeOther(await googleCallback(cfg, new URL(req.url).searchParams))
}
