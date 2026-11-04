import { BossScreen } from '@/screens/learner/world/BossScreens'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { bossDTO } from '@/server/dal/kira-world'
import { load } from '@/server/page'
import { worldGate } from '@/server/world-gate'

export const dynamic = 'force-dynamic'

export default async function BossPage() {
  const actor = await pageActor(['learner'])
  await worldGate(actor.userId)
  const data = await load(() => inOrg(orgCtx(actor), (tx) => bossDTO(tx, actor.userId)))
  return <BossScreen data={data} />
}
