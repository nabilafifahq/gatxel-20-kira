import { notFound } from 'next/navigation'
import { BookDetailScreen } from '@/screens/learner/BookDetailScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { isFeatureOn } from '@/server/dal/learner-features'
import { bookDetailDTO } from '@/server/dal/reading-room'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function BookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params
  const actor = await pageActor(['learner'])
  if (!(await isFeatureOn(actor.userId, 'reading-room'))) notFound()
  const data = await load(() => inOrg(orgCtx(actor), (tx) => bookDetailDTO(tx, actor.userId, bookId)))
  return <BookDetailScreen data={data} />
}
