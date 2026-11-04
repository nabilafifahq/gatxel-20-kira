import { z } from 'zod'
import { certificatePdf } from '@/server/certificate-pdf'
import { getActor, orgCtx } from '@/server/auth/actor'
import { throttleResponse } from '@/server/auth/ratelimit'
import { inOrg } from '@/server/db'
import { certificateData } from '@/server/dal/kira-world'
import { isFeatureOn } from '@/server/dal/learner-features'
import { isPrefetch, prefetchRefused } from '@/server/http'

export const dynamic = 'force-dynamic'

/** Sertifikat milestone streak (7, 30, 100 hari) sebagai PDF. Hanya bila streak terbaik sudah mencapainya. */
export async function GET(req: Request, { params }: { params: Promise<{ days: string }> }) {
  if (isPrefetch(req)) return prefetchRefused()
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return new Response(null, { status: 401 })
  const limited = await throttleResponse('certificate', 20, actor.userId)
  if (limited) return limited
  if (!(await isFeatureOn(actor.userId, 'kira-world'))) return new Response(null, { status: 404 })
  const days = z.coerce.number().int().safeParse((await params).days)
  if (!days.success) return new Response(null, { status: 404 })
  try {
    const d = await inOrg(orgCtx(actor), (tx) => certificateData(tx, actor.userId, days.data))
    const pdf = certificatePdf(d)
    return new Response(new Uint8Array(pdf), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="kira-certificate-${d.days}-days.pdf"`, 'Cache-Control': 'private, no-store' },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}
