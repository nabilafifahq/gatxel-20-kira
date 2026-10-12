import { TodayScreen } from '@/screens/learner'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { ensureStarted } from '@/server/dal/learner-entry'
import { todayDTO } from '@/server/dal/learner-today'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  const actor = await pageActor(['learner'])
  await ensureStarted(actor.orgId, actor.userId)
  const data = await load(() => inOrg(orgCtx(actor), (tx) => todayDTO(tx, orgCtx(actor), actor.userId)))
  return <TodayScreen data={data} />
}
