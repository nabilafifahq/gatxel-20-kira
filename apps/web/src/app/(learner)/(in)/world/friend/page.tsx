import { PetScreen } from '@/screens/learner/world/PetScreen'
import { choosePetAction, equipItemAction, treatPetAction } from '@/server/actions/world'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { petDTO } from '@/server/dal/kira-world'
import { load } from '@/server/page'
import { worldGate } from '@/server/world-gate'

export const dynamic = 'force-dynamic'

export default async function FriendPage() {
  const actor = await pageActor(['learner'])
  await worldGate(actor.userId)
  const data = await load(() => inOrg(orgCtx(actor), (tx) => petDTO(tx, actor.userId)))
  return <PetScreen data={data} actions={{ choose: choosePetAction, treat: treatPetAction, equip: equipItemAction }} />
}
