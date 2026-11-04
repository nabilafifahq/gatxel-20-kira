import { isPrefetch, prefetchRefused, seeOther } from '@/server/http'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { startFreePractice } from '@/server/dal/practice'

export const dynamic = 'force-dynamic'

/** Mulai Latihan Bebas dari tile di /practice. Pilihan datang dari query dan divalidasi Zod strict di DAL. */
export async function GET(req: Request) {
  if (isPrefetch(req)) return prefetchRefused()
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return seeOther('/')
  const q = Object.fromEntries(new URL(req.url).searchParams)
  try {
    const r = await inOrg(orgCtx(actor), (tx) => startFreePractice(tx, orgCtx(actor), actor.userId, q))
    if ('id' in r) return seeOther(`/run/${r.id}`)
    return seeOther(r.reason === 'off' ? '/practice?off=drill' : '/practice?few=1')
  } catch {
    return seeOther('/practice?few=1')
  }
}
