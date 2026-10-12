import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { AttemptDetailScreen } from '@/screens/console/AttemptDetailScreen'
import { pageActor } from '@/server/auth/actor'
import { attemptDetailDTO } from '@/server/dal/console-learner'
import { load } from '@/server/page'
import { isUuid, spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Rincian attempt' }

/** Rincian satu attempt learner untuk tutor. Attempt milik learner lain menjadi 404. */
export default async function AttemptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; attemptId: string }>
  searchParams: Promise<SearchParams>
}) {
  const { id, attemptId } = await params
  const actor = await pageActor(['tutor'], `/konsol/learner/${encodeURIComponent(id)}/percobaan/${encodeURIComponent(attemptId)}`)
  if (!isUuid(id) || !isUuid(attemptId)) notFound()
  const other = spUuid(await searchParams, 'learner')
  if (other && other !== id) redirect(`/konsol/learner/${other}`)
  const data = await load(() => attemptDetailDTO(actor, id, attemptId))
  return <AttemptDetailScreen data={data} />
}
