import { z } from 'zod'
import { isEmbeddedBrowser } from '@/lib/embedded-browser'
import { safeNext } from '@/server/auth/actor'
import { beginGoogleFlow, googleConfig } from '@/server/auth/google'
import { throttleResponse } from '@/server/auth/ratelimit'
import { isPrefetch, prefetchRefused, seeOther } from '@/server/http'

export const dynamic = 'force-dynamic'

const query = z.object({ next: z.string().max(300).optional() }).strict()

/** Mulai masuk dengan Google. Publik seperti halaman masuk: belum ada sesi, dan belum ada yang berubah selain cookie alur. */
export async function GET(req: Request) {
  const cfg = googleConfig()
  if (!cfg) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  if (isPrefetch(req)) return prefetchRefused()
  const limited = await throttleResponse('google-start', 30)
  if (limited) return limited
  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return seeOther('/masuk?notice=google-failed')
  if (isEmbeddedBrowser(req.headers.get('user-agent') ?? '')) return seeOther('/masuk?notice=google-app')
  const location = await beginGoogleFlow(cfg, safeNext(parsed.data.next, '') || null)
  return new Response(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store' } })
}
