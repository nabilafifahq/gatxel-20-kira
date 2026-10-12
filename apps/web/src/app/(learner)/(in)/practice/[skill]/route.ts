import { NextResponse } from 'next/server'
import { isPrefetch, prefetchRefused } from '@/server/http'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { startPractice } from '@/server/dal/learner-explore'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ skill: string }> }) {
  if (isPrefetch(req)) return prefetchRefused()
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return NextResponse.redirect(new URL('/', req.url), 303)
  const { skill } = await params
  if (!/^[mes][1-6]\.[a-z0-9-]{2,60}$/.test(skill)) return NextResponse.redirect(new URL('/map', req.url), 303)
  try {
    const id = await inOrg(orgCtx(actor), (tx) => startPractice(tx, orgCtx(actor), actor.userId, skill))
    return NextResponse.redirect(new URL(`/run/${id}`, req.url), 303)
  } catch {
    return NextResponse.redirect(new URL('/map', req.url), 303)
  }
}
