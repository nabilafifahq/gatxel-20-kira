import { notFound } from 'next/navigation'
import { LessonScreen } from '@/screens/learner'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { lessonDTO } from '@/server/dal/learner-explore'
import { completeLessonAction } from '@/server/actions/learner'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function LessonPage({ params, searchParams }: { params: Promise<{ skill: string }>; searchParams: Promise<{ then?: string }> }) {
  const actor = await pageActor(['learner'])
  const { skill } = await params
  const { then } = await searchParams
  if (!/^[mes][1-6]\.[a-z0-9-]{2,60}$/.test(skill)) notFound()
  const safeThen = then && /^\/run\/[0-9a-f-]{36}$/.test(then) ? then : null
  const data = await load(() => inOrg(orgCtx(actor), (tx) => lessonDTO(tx, actor.userId, skill, safeThen)))
  return <LessonScreen data={data} actions={{ completeLesson: completeLessonAction }} />
}
