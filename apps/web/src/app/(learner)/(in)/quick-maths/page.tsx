import { QuickMathsHubScreen } from '@/screens/learner/arena/QuickMathsHubScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { qmHubDTO } from '@/server/dal/arena-hitung'
import { startQmAction } from '@/server/actions/arena'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function QuickMathsPage() {
  const actor = await pageActor(['learner'])
  const data = await load(() => inOrg(orgCtx(actor), (tx) => qmHubDTO(tx, actor.userId)))
  return <QuickMathsHubScreen data={data} actions={{ start: startQmAction }} />
}
