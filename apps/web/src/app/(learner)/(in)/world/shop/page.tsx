import { ShopScreen } from '@/screens/learner/world/ShopScreen'
import { buyItemAction, equipItemAction } from '@/server/actions/world'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { shopDTO } from '@/server/dal/kira-world'
import { load } from '@/server/page'
import { worldGate } from '@/server/world-gate'

export const dynamic = 'force-dynamic'

export default async function ShopPage() {
  const actor = await pageActor(['learner'])
  await worldGate(actor.userId)
  const data = await load(() => inOrg(orgCtx(actor), (tx) => shopDTO(tx, actor.userId)))
  return <ShopScreen data={data} actions={{ buy: buyItemAction, equip: equipItemAction }} />
}
