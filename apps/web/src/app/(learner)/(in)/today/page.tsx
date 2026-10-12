import { TodayScreen } from '@/screens/learner'
import { OfflinePrecache } from '@/components/runtime/OfflinePrecache'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { ensureStarted } from '@/server/dal/learner-entry'
import { offlineUrlsForToday, todayDTO } from '@/server/dal/learner-today'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  const actor = await pageActor(['learner'])
  await ensureStarted(actor.orgId, actor.userId)
  const { data, urls } = await load(() =>
    inOrg(orgCtx(actor), async (tx) => {
      const data = await todayDTO(tx, orgCtx(actor), actor.userId)
      return { data, urls: await offlineUrlsForToday(tx, actor.userId) }
    }),
  )
  return (
    <>
      <TodayScreen data={data} />
      <OfflinePrecache urls={urls} />
    </>
  )
}
