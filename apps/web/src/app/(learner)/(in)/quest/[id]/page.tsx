import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { QuestIntroScreen } from '@/screens/learner'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { questIntroDTO } from '@/server/dal/learner-today'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function QuestIntroPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor(['learner'])
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const data = await load(() => inOrg(orgCtx(actor), (tx) => questIntroDTO(tx, orgCtx(actor), actor.userId, id)))
  if ('redirect' in data) redirect(data.redirect)
  if ('locked' in data) redirect('/today')
  return <QuestIntroScreen data={data} />
}
