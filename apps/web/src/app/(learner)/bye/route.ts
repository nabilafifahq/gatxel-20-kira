import { NextResponse } from 'next/server'
import { endCurrentSession } from '@/server/auth/session'

export const dynamic = 'force-dynamic'

/** Ganti learner di tablet: akhiri sesi anak lalu kembali ke pilihan learner. */
export async function GET(req: Request) {
  await endCurrentSession()
  return NextResponse.redirect(new URL('/', req.url), 303)
}
