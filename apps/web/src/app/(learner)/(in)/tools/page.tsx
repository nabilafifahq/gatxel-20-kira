import { ToolsScreen } from '@/screens/learner/ToolsScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { toolsDTO } from '@/server/dal/learner-tools'
import { gateFeature } from '@/server/feature-gate'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function ToolsPage() {
  const actor = await pageActor(['learner'])
  await gateFeature('manipulatives')
  const data = await load(() => inOrg(orgCtx(actor), (tx) => toolsDTO(tx, actor.userId)))
  return <ToolsScreen data={data} />
}
