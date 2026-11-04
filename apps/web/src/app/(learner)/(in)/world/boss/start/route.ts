import { isPrefetch, prefetchRefused, seeOther } from '@/server/http'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { startBossSession } from '@/server/dal/kira-world'
import { isFeatureOn } from '@/server/dal/learner-features'

export const dynamic = 'force-dynamic'

/** Mulai tantangan Puzzle Robot: 10 soal campuran dari pembuat sesi pusat, lalu masuk ke runner. */
export async function GET(req: Request) {
  if (isPrefetch(req)) return prefetchRefused()
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return seeOther('/')
  if (!(await isFeatureOn(actor.userId, 'kira-world'))) return seeOther('/today')
  try {
    const id = await inOrg(orgCtx(actor), (tx) => startBossSession(tx, orgCtx(actor), actor.userId))
    return seeOther(`/run/${id}`)
  } catch {
    return seeOther('/world/boss')
  }
}
