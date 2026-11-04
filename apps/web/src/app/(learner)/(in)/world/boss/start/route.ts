import { z } from 'zod'
import { isPrefetch, prefetchRefused, seeOther } from '@/server/http'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { startBossSession } from '@/server/dal/kira-world'
import { isFeatureOn } from '@/server/dal/learner-features'

export const dynamic = 'force-dynamic'

/** Mulai tantangan bos pilihan anak. Id lawan diperiksa, lalu DAL memeriksa saklar mapel dan apakah lawan sudah datang. */
export async function GET(req: Request) {
  if (isPrefetch(req)) return prefetchRefused()
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return seeOther('/')
  if (!(await isFeatureOn(actor.userId, 'kira-world'))) return seeOther('/today')
  try {
    const parsed = z.object({ b: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/) }).strict().safeParse(Object.fromEntries(new URL(req.url).searchParams))
    if (!parsed.success) return seeOther('/world/boss')
    const id = await inOrg(orgCtx(actor), (tx) => startBossSession(tx, orgCtx(actor), actor.userId, parsed.data.b))
    return seeOther(`/run/${id}`)
  } catch {
    return seeOther('/world/boss')
  }
}
