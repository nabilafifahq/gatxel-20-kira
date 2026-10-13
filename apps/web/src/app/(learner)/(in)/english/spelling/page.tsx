import { SpellingBeeScreen } from '@/screens/learner/SpellingBeeScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { finishSpellingAction } from '@/server/actions/english'
import { spellingRound } from '@/server/dal/english-skills'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function SpellingBeePage() {
  const actor = await pageActor(['learner'])
  const data = await load(() => inOrg(orgCtx(actor), (tx) => spellingRound(tx, actor.userId)))
  return <SpellingBeeScreen data={data} finish={finishSpellingAction} />
}
