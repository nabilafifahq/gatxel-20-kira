import { AlbumScreen } from '@/screens/learner/world/AlbumScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { albumDTO } from '@/server/dal/kira-world'
import { load } from '@/server/page'
import { worldGate } from '@/server/world-gate'

export const dynamic = 'force-dynamic'

export default async function CardsPage() {
  const actor = await pageActor(['learner'])
  await worldGate(actor.userId)
  const data = await load(() => inOrg(orgCtx(actor), (tx) => albumDTO(tx, actor.userId)))
  return <AlbumScreen data={data} />
}
