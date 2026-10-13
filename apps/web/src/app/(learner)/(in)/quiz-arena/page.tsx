import { QuizHubScreen } from '@/screens/learner/arena/QuizHubScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { quizHubDTO } from '@/server/dal/arena-pengetahuan'
import { startQuizAction } from '@/server/actions/arena'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function QuizArenaPage() {
  const actor = await pageActor(['learner'])
  const data = await load(() => inOrg(orgCtx(actor), (tx) => quizHubDTO(tx, actor.userId)))
  return <QuizHubScreen data={data} actions={{ start: startQuizAction }} />
}
