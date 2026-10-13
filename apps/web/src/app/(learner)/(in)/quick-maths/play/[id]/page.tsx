import { notFound } from 'next/navigation'
import { QuickMathsRoundScreen } from '@/screens/learner/arena/QuickMathsRoundScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { qmRoundDTO } from '@/server/dal/arena-hitung'
import { answerQmAction, finishQmAction, hintQmAction, startQmAction } from '@/server/actions/arena'
import { load } from '@/server/page'
import { isUuid } from '@/server/params'

export const dynamic = 'force-dynamic'

export default async function QuickMathsRoundPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor(['learner'])
  const { id } = await params
  if (!isUuid(id)) notFound()
  const data = await load(() => inOrg(orgCtx(actor), (tx) => qmRoundDTO(tx, actor.userId, id)))
  return <QuickMathsRoundScreen data={data} actions={{ start: startQmAction, answer: answerQmAction, hint: hintQmAction, finish: finishQmAction }} />
}
