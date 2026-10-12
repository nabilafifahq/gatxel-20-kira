import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { LearnerDetailScreen } from '@/screens/console/LearnerDetailScreen'
import { pageActor } from '@/server/auth/actor'
import { learnerDetailDTO } from '@/server/dal/console-learner'
import { load } from '@/server/page'
import { isUuid, spUuid, type SearchParams } from '@/server/params'
import { addNoteAction } from '@/server/actions/console-learner'

export const metadata: Metadata = { title: 'Detail learner' }

/** T02 Detail learner: peta penguasaan 8 minggu, riwayat attempt, catatan tutor. */
export default async function LearnerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params
  const actor = await pageActor(['tutor'], `/konsol/learner/${encodeURIComponent(id)}`)
  if (!isUuid(id)) notFound()
  // Pemilih learner di kerangka konsol menambahkan ?learner=; pindah ke detail learner itu.
  const other = spUuid(await searchParams, 'learner')
  if (other && other !== id) redirect(`/konsol/learner/${other}`)
  const data = await load(() => learnerDetailDTO(actor, id))
  return <LearnerDetailScreen data={data} actions={{ addNote: addNoteAction }} />
}
