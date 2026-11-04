import { z } from 'zod'
import { tOf } from '@/lib/i18n'
import { certificatePdf } from '@/server/certificate-pdf'
import { getActor, orgCtx } from '@/server/auth/actor'
import { throttleResponse } from '@/server/auth/ratelimit'
import { inOrg } from '@/server/db'
import { certificateData } from '@/server/dal/kira-world'
import { isFeatureOn } from '@/server/dal/learner-features'
import { isPrefetch, prefetchRefused, seeOther } from '@/server/http'

export const dynamic = 'force-dynamic'

/** Sertifikat milestone streak (7, 30, 100 hari) sebagai PDF. Hanya bila streak terbaik sudah mencapainya. */
export async function GET(req: Request, { params }: { params: Promise<{ days: string }> }) {
  if (isPrefetch(req)) return prefetchRefused()
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return seeOther('/')
  const limited = await throttleResponse('certificate', 20, actor.userId)
  if (limited) return limited
  // Saklar mati atau tonggak belum tercapai: arahkan ke layar anak. Respons 404 kosong membuat ponsel mengunduh berkas kosong.
  if (!(await isFeatureOn(actor.userId, 'kira-world'))) return seeOther('/today')
  const days = z.coerce.number().int().safeParse((await params).days)
  if (!days.success) return seeOther('/world/trophies')
  try {
    const d = await inOrg(orgCtx(actor), (tx) => certificateData(tx, actor.userId, days.data))
    const t = tOf(actor).world.certificate
    const pdf = certificatePdf(d, t)
    return new Response(new Uint8Array(pdf), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${t.fileName(d.days)}"`, 'Cache-Control': 'private, no-store' },
    })
  } catch {
    return seeOther('/world/trophies')
  }
}
