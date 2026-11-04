import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LessonReviewScreen } from '@/screens/learner/LessonReviewScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { reviewDTO } from '@/server/dal/lesson-review'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Quick review' }

export default async function ReviewPage({ params }: { params: Promise<{ skill: string }> }) {
  const actor = await pageActor(['learner'])
  const { skill } = await params
  if (!/^[mes][1-6]\.[a-z0-9-]{2,60}$/.test(skill)) notFound()
  const data = await load(() => inOrg(orgCtx(actor), (tx) => reviewDTO(tx, actor.userId, skill)))
  return <LessonReviewScreen data={data} />
}
