import { isPrefetch, prefetchRefused, seeOther } from '@/server/http'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { startReviewSession } from '@/server/dal/learner-explore'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (isPrefetch(req)) return prefetchRefused()
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return seeOther('/')
  try {
    const id = await inOrg(orgCtx(actor), (tx) => startReviewSession(tx, orgCtx(actor), actor.userId))
    return seeOther(`/run/${id}`)
  } catch {
    return seeOther('/review')
  }
}
