import type { Metadata } from 'next'
import { getT } from '@/lib/i18n/server'
import { LessonReviewListScreen } from '@/screens/learner/LessonReviewScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { reviewListDTO } from '@/server/dal/lesson-review'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).shell.titles.quickReview }
}

export default async function ReviewListPage() {
  const actor = await pageActor(['learner'])
  const data = await load(() => inOrg(orgCtx(actor), (tx) => reviewListDTO(tx, actor.userId)))
  return <LessonReviewListScreen data={data} />
}
