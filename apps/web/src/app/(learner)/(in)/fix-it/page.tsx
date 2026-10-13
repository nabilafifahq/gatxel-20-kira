import { FixItScreen } from '@/screens/learner/FixItScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { fixItDTO } from '@/server/dal/mistake-book'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function FixItPage() {
  const actor = await pageActor(['learner'])
  const data = await load(() => inOrg(orgCtx(actor), (tx) => fixItDTO(tx, actor.userId)))
  return <FixItScreen data={data} />
}
