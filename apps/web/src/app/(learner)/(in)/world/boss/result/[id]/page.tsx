import { notFound } from 'next/navigation'
import { z } from 'zod'
import { BossResultScreen } from '@/screens/learner/world/BossScreens'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { bossResultDTO } from '@/server/dal/kira-world'
import { load } from '@/server/page'
import { worldGate } from '@/server/world-gate'

export const dynamic = 'force-dynamic'

export default async function BossResultPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor(['learner'])
  await worldGate(actor.userId)
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const data = await load(() => inOrg(orgCtx(actor), (tx) => bossResultDTO(tx, actor.userId, id)))
  return <BossResultScreen data={data} />
}
