import { EsmoScreen } from '@/screens/learner'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { esmoDTO } from '@/server/dal/learner-competition'
import { startEsmoMockAction, startEsmoPackAction } from '@/server/actions/learner'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function EsmoPage() {
  const actor = await pageActor(['learner'])
  const data = await load(() => inOrg(orgCtx(actor), (tx) => esmoDTO(tx, actor.userId)))
  return <EsmoScreen data={data} actions={{ startPack: startEsmoPackAction, startMock: startEsmoMockAction }} />
}
