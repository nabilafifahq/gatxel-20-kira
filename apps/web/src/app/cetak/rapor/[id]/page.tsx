import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MonthlyReportPrint } from '@/screens/print/MonthlyReportPrint'
import { pageActor } from '@/server/auth/actor'
import { parentReportDTO } from '@/server/dal/coach-report'
import { load } from '@/server/page'
import { isUuid, spString, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Rapor bulanan, Kira' }

/** Rapor bulanan A4 untuk dicetak atau disimpan sebagai PDF. */
export default async function MonthlyReportPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params
  const sp = await searchParams
  const actor = await pageActor(['guardian'], `/cetak/rapor/${encodeURIComponent(id)}`)
  if (!isUuid(id)) notFound()
  const data = await load(() => parentReportDTO(actor, id, spString(sp, 'bulan', 7)))
  if (!data.report || data.selectedId !== id) notFound()
  return <MonthlyReportPrint report={data.report} />
}
