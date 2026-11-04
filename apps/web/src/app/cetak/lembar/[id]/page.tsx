import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PrintPaper } from '@/screens/print/PrintPaper'
import { pageActor } from '@/server/auth/actor'
import { worksheetPrintDTO } from '@/server/dal/worksheet'
import { load } from '@/server/page'
import { isUuid } from '@/server/params'

export const metadata: Metadata = { title: 'Lembar kerja, Kira' }

/** Lembar kerja A4 untuk anak, tanpa kunci. Dicetak lewat peramban. */
export default async function WorksheetPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await pageActor(['guardian'], `/cetak/lembar/${encodeURIComponent(id)}`)
  if (!isUuid(id)) notFound()
  const data = await load(() => worksheetPrintDTO(actor, id, false))
  return <PrintPaper data={data} />
}
