import { NextResponse } from 'next/server'
import { throttleResponse } from '@/server/auth/ratelimit'
import { unsubscribeWaitlist } from '@/server/signup/service'

export const dynamic = 'force-dynamic'

/** Berhenti satu klik untuk klien email (RFC 8058: List-Unsubscribe-Post). Tanpa sesi; token ada di alamat. */
export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const limited = await throttleResponse('unsubscribe', 20)
  if (limited) return limited
  const { token } = await ctx.params
  const ok = /^[A-Za-z0-9_-]{20,100}$/.test(token) && (await unsubscribeWaitlist(token))
  return new NextResponse(null, { status: ok ? 200 : 404, headers: { 'Cache-Control': 'no-store' } })
}
