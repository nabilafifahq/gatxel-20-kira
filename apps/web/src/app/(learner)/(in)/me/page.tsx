import { MeScreen } from '@/screens/learner'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { markBadgesSeen, meDTO } from '@/server/dal/learner-explore'
import { changeAvatarAction } from '@/server/actions/learner'
import { changeAccessoryAction } from '@/server/actions/arena'
import { load } from '@/server/page'
import { collectionDTO } from '@/server/dal/learner-motion'
import { equipChestRewardAction } from '@/server/actions/chest'

export const dynamic = 'force-dynamic'

export default async function MePage() {
  const actor = await pageActor(['learner'])
  const data = await load(() =>
    inOrg(orgCtx(actor), async (tx) => ({ ...(await meDTO(tx, actor.userId)), collection: await collectionDTO(tx, actor.userId) })),
  )
  await inOrg(orgCtx(actor), (tx) => markBadgesSeen(tx, actor.userId))
  return <MeScreen data={data} actions={{ changeAvatar: changeAvatarAction, changeAccessory: changeAccessoryAction, equipChest: equipChestRewardAction }} />
}
