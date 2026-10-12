import { isPrefetch, prefetchRefused, seeOther } from '@/server/http'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { startEsmoPack } from '@/server/dal/learner-competition'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isPrefetch(req)) return prefetchRefused()
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return seeOther('/')
  const id = decodeURIComponent((await params).id)
  if (!/^(esmo|builtin):(math|english):\d{1,3}$/.test(id)) return seeOther('/esmo')
  try {
    const attemptId = await inOrg(orgCtx(actor), (tx) => startEsmoPack(tx, orgCtx(actor), actor.userId, id))
    return seeOther(`/run/${attemptId}`)
  } catch {
    return seeOther('/esmo')
  }
}
