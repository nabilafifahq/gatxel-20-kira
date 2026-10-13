import { notFound } from 'next/navigation'
import { QuizRoundScreen } from '@/screens/learner/arena/QuizRoundScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { quizRoundDTO } from '@/server/dal/arena-pengetahuan'
import { answerQuizAction, finishQuizAction, startQuizAction } from '@/server/actions/arena'
import { load } from '@/server/page'
import { isUuid } from '@/server/params'

export const dynamic = 'force-dynamic'

export default async function QuizRoundPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor(['learner'])
  const { id } = await params
  if (!isUuid(id)) notFound()
  const data = await load(() => inOrg(orgCtx(actor), (tx) => quizRoundDTO(tx, actor.userId, id)))
  return <QuizRoundScreen data={data} actions={{ start: startQuizAction, answer: answerQuizAction, finish: finishQuizAction }} />
}
