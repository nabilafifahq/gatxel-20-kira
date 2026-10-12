import { MapScreen } from '@/screens/learner'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { mapDTO } from '@/server/dal/learner-explore'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function MapPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const actor = await pageActor(['learner'])
  const { subject } = await searchParams
  const s = subject === 'english' || subject === 'science' || subject === 'math' ? subject : null
  const data = await load(() => inOrg(orgCtx(actor), (tx) => mapDTO(tx, actor.userId, s)))
  return <MapScreen data={data} />
}
