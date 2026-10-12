import { isPrefetch, prefetchRefused, seeOther } from '@/server/http'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { startEsmoMock } from '@/server/dal/learner-competition'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ subject: string }> }) {
  if (isPrefetch(req)) return prefetchRefused()
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return seeOther('/')
  const { subject } = await params
  if (subject !== 'math' && subject !== 'english') return seeOther('/esmo')
  try {
    const attemptId = await inOrg(orgCtx(actor), (tx) => startEsmoMock(tx, orgCtx(actor), actor.userId, subject))
    return seeOther(`/run/${attemptId}`)
  } catch {
    return seeOther('/esmo')
  }
}
