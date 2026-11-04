import { isPrefetch, prefetchRefused, seeOther } from '@/server/http'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { startReviewQuiz } from '@/server/dal/lesson-review'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ skill: string }> }) {
  if (isPrefetch(req)) return prefetchRefused()
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return seeOther('/')
  const { skill } = await params
  if (!/^[mes][1-6]\.[a-z0-9-]{2,60}$/.test(skill)) return seeOther('/practice/review')
  try {
    const id = await inOrg(orgCtx(actor), (tx) => startReviewQuiz(tx, orgCtx(actor), actor.userId, skill))
    return seeOther(`/run/${id}`)
  } catch {
    return seeOther('/practice/review')
  }
}
