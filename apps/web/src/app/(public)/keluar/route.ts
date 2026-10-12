import { NextResponse } from 'next/server'
import { endCurrentSession, getSession } from '@/server/auth/session'
import { audit } from '@/server/audit'

export const dynamic = 'force-dynamic'

/** Keluar dari akun dewasa (formulir POST dari konsol). */
export async function POST(req: Request) {
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(req.url).origin) return new NextResponse('Origin tidak cocok', { status: 403 })
  const actor = await getSession()
  if (actor) await audit({ orgId: actor.orgId, userId: actor.userId, role: actor.role }, 'logout', actor.userId)
  await endCurrentSession()
  return NextResponse.redirect(new URL(actor?.role === 'learner' ? '/' : '/masuk?notice=signed-out', req.url), 303)
}
