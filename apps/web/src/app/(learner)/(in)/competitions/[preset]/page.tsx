import { notFound } from 'next/navigation'
import { CompetitionIntroScreen } from '@/screens/learner'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { competitionIntroDTO } from '@/server/dal/learner-competition'
import { startSimulationAction } from '@/server/actions/learner'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function CompetitionIntroPage({ params }: { params: Promise<{ preset: string }> }) {
  const actor = await pageActor(['learner'])
  const { preset } = await params
  if (!/^[a-z0-9-]{2,60}$/.test(preset)) notFound()
  const data = await load(() => inOrg(orgCtx(actor), (tx) => competitionIntroDTO(tx, actor.userId, preset)))
  return <CompetitionIntroScreen data={data} actions={{ startSimulation: startSimulationAction }} />
}
