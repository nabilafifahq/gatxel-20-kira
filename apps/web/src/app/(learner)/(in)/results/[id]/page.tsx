import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { ResultsScreen } from '@/screens/learner'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { resultsDTO } from '@/server/dal/learner-results'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor(['learner'])
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const data = await load(() => inOrg(orgCtx(actor), (tx) => resultsDTO(tx, actor.userId, id)))
  if ('inProgress' in data) redirect(`/run/${id}`)
  return <ResultsScreen data={data} />
}
