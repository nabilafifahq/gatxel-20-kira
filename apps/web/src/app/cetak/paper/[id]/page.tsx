import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PrintPaper } from '@/screens/print/PrintPaper'
import { pageActor } from '@/server/auth/actor'
import { printPaperDTO } from '@/server/dal/print'
import { load } from '@/server/page'
import { isUuid, spDate, spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Cetak paper, Kira' }

/** C01 Paper A4 untuk learner, tanpa kunci. ?learner= mengisi nama, ?tanggal= mengisi tanggal. */
export default async function PrintPaperPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params
  const actor = await pageActor(['tutor'], `/cetak/paper/${encodeURIComponent(id)}`)
  if (!isUuid(id)) notFound()
  const sp = await searchParams
  const data = await load(() => printPaperDTO(actor, id, { withKey: false, learner: spUuid(sp, 'learner'), date: spDate(sp, 'tanggal') }))
  return <PrintPaper data={data} />
}
