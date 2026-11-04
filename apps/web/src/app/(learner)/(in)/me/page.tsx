import { MeScreen } from '@/screens/learner'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { markBadgesSeen, meDTO } from '@/server/dal/learner-explore'
import { changeAvatarAction } from '@/server/actions/learner'
import { changeAccessoryAction } from '@/server/actions/arena'
import { load } from '@/server/page'
import { collectionDTO } from '@/server/dal/learner-motion'
import { isFeatureOn } from '@/server/dal/learner-features'
import { equipChestRewardAction } from '@/server/actions/chest'

export const dynamic = 'force-dynamic'

export default async function MePage() {
  const actor = await pageActor(['learner'])
  const data = await load(() =>
    inOrg(orgCtx(actor), async (tx) => ({ ...(await meDTO(tx, actor.userId, actor.uiLang)), collection: await collectionDTO(tx, actor.userId, actor.uiLang) })),
  )
  await inOrg(orgCtx(actor), (tx) => markBadgesSeen(tx, actor.userId))
  const myWords = await isFeatureOn(actor.userId, 'dictionary')
  return <MeScreen myWords={myWords} data={data} actions={{ changeAvatar: changeAvatarAction, changeAccessory: changeAccessoryAction, equipChest: equipChestRewardAction }} />
}
