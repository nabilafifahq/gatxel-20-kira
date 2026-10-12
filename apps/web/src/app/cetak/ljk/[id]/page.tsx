import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PrintLjk } from '@/screens/print/PrintLjk'
import { pageActor } from '@/server/auth/actor'
import { printLjkDTO } from '@/server/dal/print'
import { load } from '@/server/page'
import { isUuid } from '@/server/params'

export const metadata: Metadata = { title: 'Cetak LJK, Kira' }

/** C02 Lembar jawaban A4 untuk satu attempt Kertas, dengan QR berisi kode lembar. */
export default async function PrintLjkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await pageActor(['tutor'], `/cetak/ljk/${encodeURIComponent(id)}`)
  if (!isUuid(id)) notFound()
  const data = await load(() => printLjkDTO(actor, id))
  return <PrintLjk data={data} />
}
