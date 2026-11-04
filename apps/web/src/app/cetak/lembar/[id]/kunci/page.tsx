import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PrintPaper } from '@/screens/print/PrintPaper'
import { pageActor } from '@/server/auth/actor'
import { worksheetPrintDTO } from '@/server/dal/worksheet'
import { load } from '@/server/page'
import { isUuid } from '@/server/params'

export const metadata: Metadata = { title: 'Kunci lembar kerja, Kira' }

/** Kunci jawaban lembar kerja untuk orang tua, terpisah dari lembar anak. */
export default async function WorksheetKeyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await pageActor(['guardian'], `/cetak/lembar/${encodeURIComponent(id)}/kunci`)
  if (!isUuid(id)) notFound()
  const data = await load(() => worksheetPrintDTO(actor, id, true))
  return <PrintPaper data={data} />
}
