import { StoryScreen } from '@/screens/learner/world/StoryScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { storyDTO } from '@/server/dal/kira-world'
import { load } from '@/server/page'
import { worldGate } from '@/server/world-gate'

export const dynamic = 'force-dynamic'

export default async function StoryPage() {
  const actor = await pageActor(['learner'])
  await worldGate(actor.userId)
  const data = await load(() => inOrg(orgCtx(actor), (tx) => storyDTO(tx, actor.userId)))
  return <StoryScreen data={data} />
}
