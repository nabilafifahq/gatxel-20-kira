import { MeScreen } from '@/screens/learner'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { markBadgesSeen, meDTO } from '@/server/dal/learner-explore'
import { changeAvatarAction } from '@/server/actions/learner'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function MePage() {
  const actor = await pageActor(['learner'])
  const data = await load(() => inOrg(orgCtx(actor), (tx) => meDTO(tx, actor.userId)))
  await inOrg(orgCtx(actor), (tx) => markBadgesSeen(tx, actor.userId))
  return <MeScreen data={data} actions={{ changeAvatar: changeAvatarAction }} />
}
