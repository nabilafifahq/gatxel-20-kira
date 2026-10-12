import { NextResponse } from 'next/server'
import { endCurrentSession, getSession } from '@/server/auth/session'
import { audit } from '@/server/audit'
import { sameOrigin, seeOther } from '@/server/http'

export const dynamic = 'force-dynamic'

/** Keluar dari akun dewasa (formulir POST dari konsol). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new NextResponse('Origin tidak cocok', { status: 403 })
  const actor = await getSession()
  if (actor)
    await audit({ orgId: actor.orgId, userId: actor.userId, role: actor.role }, 'logout', actor.userId)
  await endCurrentSession()
  return seeOther(actor?.role === 'learner' ? '/' : '/masuk?notice=signed-out')
}
