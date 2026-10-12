import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PrintPaper } from '@/screens/print/PrintPaper'
import { pageActor } from '@/server/auth/actor'
import { printPaperDTO } from '@/server/dal/print'
import { load } from '@/server/page'
import { isUuid } from '@/server/params'

export const metadata: Metadata = { title: 'Cetak kunci, Kira' }

/** C01 Kunci jawaban paper untuk tutor: jawaban dan pembahasan per nomor. */
export default async function PrintKeyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await pageActor(['tutor'], `/cetak/kunci/${encodeURIComponent(id)}`)
  if (!isUuid(id)) notFound()
  const data = await load(() => printPaperDTO(actor, id, { withKey: true, learner: null, date: null }))
  return <PrintPaper data={data} />
}
