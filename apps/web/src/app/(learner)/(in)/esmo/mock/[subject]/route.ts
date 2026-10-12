import { NextResponse } from 'next/server'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { startEsmoMock } from '@/server/dal/learner-competition'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ subject: string }> }) {
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return NextResponse.redirect(new URL('/', req.url), 303)
  const { subject } = await params
  if (subject !== 'math' && subject !== 'english') return NextResponse.redirect(new URL('/esmo', req.url), 303)
  try {
    const attemptId = await inOrg(orgCtx(actor), (tx) => startEsmoMock(tx, orgCtx(actor), actor.userId, subject))
    return NextResponse.redirect(new URL(`/run/${attemptId}`, req.url), 303)
  } catch {
    return NextResponse.redirect(new URL('/esmo', req.url), 303)
  }
}
