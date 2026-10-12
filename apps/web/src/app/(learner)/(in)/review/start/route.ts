import { NextResponse } from 'next/server'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { startReviewSession } from '@/server/dal/learner-explore'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return NextResponse.redirect(new URL('/', req.url), 303)
  try {
    const id = await inOrg(orgCtx(actor), (tx) => startReviewSession(tx, orgCtx(actor), actor.userId))
    return NextResponse.redirect(new URL(`/run/${id}`, req.url), 303)
  } catch {
    return NextResponse.redirect(new URL('/review', req.url), 303)
  }
}
