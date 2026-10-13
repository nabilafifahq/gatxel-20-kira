import type { Metadata } from 'next'
import { MistakeReportScreen } from '@/screens/console/PustakaScreens'
import { pageActor } from '@/server/auth/actor'
import { mistakeReportDTO } from '@/server/dal/mistake-book'
import { load } from '@/server/page'
import { spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Buku Salah' }

/** Buku Salah: jenis kesalahan yang paling sering dan soal yang menunggu diulang. */
export default async function MistakeBookPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['tutor'], '/konsol/pustaka/buku-salah')
  const sp = await searchParams
  const data = await load(() => mistakeReportDTO(actor, spUuid(sp, 'learner')))
  return <MistakeReportScreen data={data} />
}
