import { NextResponse } from 'next/server'
import { jakartaDate } from '@kira/core'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { addMinutes, loadLearner } from '@/server/dal/learner-core'
import { sameOrigin } from '@/server/http'
import { throttleResponse } from '@/server/auth/ratelimit'

export const dynamic = 'force-dynamic'

/** Detak waktu layar learner: paling banyak satu menit per 50 detik. */
export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403 })
  const limited = await throttleResponse('heartbeat', 30, actor.userId)
  if (limited) return limited
  const date = jakartaDate()
  const result = await inOrg(orgCtx(actor), async (tx) => {
    const learner = await loadLearner(tx, actor.userId)
    const { minutes } = await addMinutes(tx, orgCtx(actor), actor.userId, date)
    return { minutes, limit: learner.screenLimitMin }
  })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
