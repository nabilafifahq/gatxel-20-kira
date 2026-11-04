import { ReadingLibraryScreen } from '@/screens/learner/ReadingLibraryScreen'
import { inOrg } from '@/server/db'
import { notFound } from 'next/navigation'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { isFeatureOn } from '@/server/dal/learner-features'
import { readingLibraryDTO } from '@/server/dal/reading-room'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function ReadingPage() {
  const actor = await pageActor(['learner'])
  if (!(await isFeatureOn(actor.userId, 'reading-room'))) notFound()
  const data = await load(() => inOrg(orgCtx(actor), (tx) => readingLibraryDTO(tx, actor.userId)))
  return <ReadingLibraryScreen data={data} />
}
