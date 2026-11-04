import { notFound } from 'next/navigation'
import { MyWordsScreen } from '@/screens/learner/MyWordsScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { myWordsDTO } from '@/server/dal/vocab'
import { isFeatureOn } from '@/server/dal/learner-features'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function MyWordsPage() {
  const actor = await pageActor(['learner'])
  if (!(await isFeatureOn(actor.userId, 'dictionary'))) notFound()
  const data = await load(() => inOrg(orgCtx(actor), (tx) => myWordsDTO(tx, actor.userId)))
  return <MyWordsScreen data={data} />
}
