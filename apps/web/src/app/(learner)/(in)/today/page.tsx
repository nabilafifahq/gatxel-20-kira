import { TodayScreen } from '@/screens/learner'
import { OfflinePrecache } from '@/components/runtime/OfflinePrecache'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { ensureStarted } from '@/server/dal/learner-entry'
import { offlineUrlsForToday, todayDTO } from '@/server/dal/learner-today'
import { xpTracksDTO } from '@/server/dal/arena-tracks'
import { load } from '@/server/page'
import { isFeatureOn } from '@/server/dal/learner-features'
import { worldPeek } from '@/server/dal/kira-world'
import { jakartaDate } from '@kira/core'
import { cachedToday } from '@/server/today-cache'
import { chestDTO } from '@/server/dal/learner-motion'
import { placementCard } from '@/server/dal/placement'
import { equipChestRewardAction, openChestAction } from '@/server/actions/chest'

export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  const actor = await pageActor(['learner'])
  await ensureStarted(actor.orgId, actor.userId)
  const { data, urls } = await load(() =>
    cachedToday(actor, jakartaDate(), () =>
      inOrg(orgCtx(actor), async (tx) => {
        const today = await todayDTO(tx, orgCtx(actor), actor.userId)
        const data = { ...today, tracks: await xpTracksDTO(tx, actor.userId), chest: await chestDTO(tx, actor.userId, today) }
        return { data, urls: await offlineUrlsForToday(tx, actor.userId) }
      }),
    ),
  )
  // Bintang dunia dan kartu penempatan berubah di luar jalur sesi, jadi dibaca segar tiap kunjungan (di luar cache).
  const { world, placement } = await load(() =>
    inOrg(orgCtx(actor), async (tx) => ({
      world: (await isFeatureOn(actor.userId, 'kira-world')) ? await worldPeek(tx, actor.userId).catch(() => null) : null,
      placement: await placementCard(tx, orgCtx(actor), actor.userId),
    })),
  )
  return (
    <>
      <TodayScreen data={data} world={world} chestActions={{ open: openChestAction, equip: equipChestRewardAction }} placement={placement} />
      <OfflinePrecache urls={urls} />
    </>
  )
}
