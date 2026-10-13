import { notFound } from 'next/navigation'
import { isTopicId } from '@kira/content/knowledge'
import { QuizTopicScreen } from '@/screens/learner/arena/QuizHubScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { quizTopicDTO } from '@/server/dal/arena-pengetahuan'
import { startQuizAction } from '@/server/actions/arena'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function QuizTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const actor = await pageActor(['learner'])
  const { topic } = await params
  if (!isTopicId(topic)) notFound()
  const data = await load(() => inOrg(orgCtx(actor), (tx) => quizTopicDTO(tx, actor.userId, topic)))
  return <QuizTopicScreen data={data} actions={{ start: startQuizAction }} />
}
