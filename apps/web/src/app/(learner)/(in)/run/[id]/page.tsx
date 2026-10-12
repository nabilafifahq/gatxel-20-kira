import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { RunnerClient } from '@/components/runtime/RunnerClient'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { runnerDTO } from '@/server/dal/learner-runner'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor(['learner'])
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const data = await load(() => inOrg(orgCtx(actor), (tx) => runnerDTO(tx, actor.userId, id)))
  if ('submitted' in data) redirect(`/results/${id}`)
  return <RunnerClient data={data} />
}
