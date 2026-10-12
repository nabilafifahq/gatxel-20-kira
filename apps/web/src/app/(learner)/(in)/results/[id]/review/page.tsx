import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { ReviewScreen } from '@/screens/learner'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { reviewDTO } from '@/server/dal/learner-results'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const actor = await pageActor(['learner'])
  const { id } = await params
  const { q } = await searchParams
  if (!z.string().uuid().safeParse(id).success) notFound()
  const open = q && /^\d{1,3}$/.test(q) ? Number(q) : null
  const data = await load(() => inOrg(orgCtx(actor), (tx) => reviewDTO(tx, actor.userId, id, open)))
  if ('inProgress' in data) redirect(`/run/${id}`)
  return <ReviewScreen data={data} />
}
