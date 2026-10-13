import { DoneTodayScreen } from '@/screens/learner'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { doneTodayDTO } from '@/server/dal/learner-today'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function DoneTodayPage() {
  const actor = await pageActor(['learner'])
  const data = await load(() => inOrg(orgCtx(actor), (tx) => doneTodayDTO(tx, actor.userId)))
  return <DoneTodayScreen data={data} />
}
