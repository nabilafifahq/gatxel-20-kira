import { notFound } from 'next/navigation'
import { QuickMathsLessonScreen } from '@/screens/learner/arena/QuickMathsLessonScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { qmLessonDTO } from '@/server/dal/arena-hitung'
import { startQmAction } from '@/server/actions/arena'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function QuickMathsLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor(['learner'])
  const { id } = await params
  const data = await load(() => inOrg(orgCtx(actor), (tx) => qmLessonDTO(tx, actor.userId, id)))
  if (!data) notFound()
  return <QuickMathsLessonScreen data={data} actions={{ start: startQmAction }} />
}
