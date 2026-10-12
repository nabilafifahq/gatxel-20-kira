import type { Metadata } from 'next'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { tables } from '@kira/db'
import { RegisterDeviceScreen } from '@/screens/public/RegisterDeviceScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { registerDeviceAction } from '@/server/actions/auth'
import type { AvatarName } from '@/lib/dto'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Daftarkan tablet' }

/** Orang dewasa mendaftarkan browser ini sebagai tablet learner (orang tua hanya untuk anaknya sendiri). */
export default async function RegisterDevicePage() {
  const actor = await pageActor(['tutor', 'guardian'], '/perangkat')
  const learners = await inOrg(orgCtx(actor), async (tx) => {
    const { learnerProfile, guardianLink } = tables
    if (actor.role === 'guardian') {
      const links = await tx.select({ id: guardianLink.learnerId }).from(guardianLink).where(eq(guardianLink.guardianId, actor.userId))
      if (links.length === 0) return []
      return tx
        .select({ id: learnerProfile.userId, name: learnerProfile.name, avatar: learnerProfile.avatar })
        .from(learnerProfile)
        .where(and(inArray(learnerProfile.userId, links.map((l) => l.id)), isNull(learnerProfile.deletedAt)))
    }
    return tx.select({ id: learnerProfile.userId, name: learnerProfile.name, avatar: learnerProfile.avatar }).from(learnerProfile).where(isNull(learnerProfile.deletedAt))
  })
  return <RegisterDeviceScreen learners={learners.map((l) => ({ ...l, avatar: l.avatar as AvatarName }))} registered={null} registerDevice={registerDeviceAction} />
}
