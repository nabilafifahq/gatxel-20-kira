import { isPrefetch, prefetchRefused, seeOther } from '@/server/http'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { throttleResponse } from '@/server/auth/ratelimit'
import { startFixItSession } from '@/server/dal/mistake-book'

export const dynamic = 'force-dynamic'

/** Mulai sesi Fix-it Book: buat attempt dari soal Buku Salah lalu masuk ke runner. */
export async function GET(req: Request) {
  if (isPrefetch(req)) return prefetchRefused()
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return seeOther('/')
  // Satu mulai sesi menulis baris attempt. Anak sungguhan tidak pernah mendekati batas ini.
  const limited = await throttleResponse('start', 60, actor.userId)
  if (limited) return limited
  try {
    const id = await inOrg(orgCtx(actor), (tx) => startFixItSession(tx, orgCtx(actor), actor.userId))
    return seeOther(`/run/${id}`)
  } catch {
    return seeOther('/fix-it')
  }
}
