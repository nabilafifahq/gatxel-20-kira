import { isEnglishSessionArea } from '@kira/core/english-skills'
import { isPrefetch, prefetchRefused, seeOther } from '@/server/http'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { startEnglishSession } from '@/server/dal/english-skills'

export const dynamic = 'force-dynamic'

/** Mulai sesi English Skills (listening, speaking, atau writing) lalu buka runner. */
export async function GET(req: Request, { params }: { params: Promise<{ area: string }> }) {
  if (isPrefetch(req)) return prefetchRefused()
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return seeOther('/')
  const { area } = await params
  if (!isEnglishSessionArea(area)) return seeOther('/english')
  try {
    const id = await inOrg(orgCtx(actor), (tx) => startEnglishSession(tx, orgCtx(actor), actor.userId, area))
    return seeOther(`/run/${id}`)
  } catch {
    return seeOther('/english')
  }
}
