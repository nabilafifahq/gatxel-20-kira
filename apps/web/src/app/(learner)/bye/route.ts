import { isPrefetch, prefetchRefused, seeOther } from '@/server/http'
import { endCurrentSession } from '@/server/auth/session'

export const dynamic = 'force-dynamic'

/** Ganti learner di tablet: akhiri sesi anak lalu kembali ke pilihan learner. */
export async function GET(req: Request) {
  if (isPrefetch(req)) return prefetchRefused()
  await endCurrentSession()
  return seeOther('/')
}
