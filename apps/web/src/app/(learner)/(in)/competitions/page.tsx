import { CompetitionPickScreen } from '@/screens/learner'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { competitionPickDTO } from '@/server/dal/learner-competition'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function CompetitionsPage() {
  const actor = await pageActor(['learner'])
  const data = await load(() => inOrg(orgCtx(actor), (tx) => competitionPickDTO(tx, actor.userId)))
  return <CompetitionPickScreen data={data} />
}
