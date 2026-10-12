import { NextResponse } from 'next/server'
import { isPrefetch, prefetchRefused } from '@/server/http'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { startEsmoPack } from '@/server/dal/learner-competition'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isPrefetch(req)) return prefetchRefused()
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return NextResponse.redirect(new URL('/', req.url), 303)
  const id = decodeURIComponent((await params).id)
  if (!/^(esmo|builtin):(math|english):\d{1,3}$/.test(id)) return NextResponse.redirect(new URL('/esmo', req.url), 303)
  try {
    const attemptId = await inOrg(orgCtx(actor), (tx) => startEsmoPack(tx, orgCtx(actor), actor.userId, id))
    return NextResponse.redirect(new URL(`/run/${attemptId}`, req.url), 303)
  } catch {
    return NextResponse.redirect(new URL('/esmo', req.url), 303)
  }
}
