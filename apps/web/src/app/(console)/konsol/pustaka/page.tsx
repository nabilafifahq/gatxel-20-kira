import type { Metadata } from 'next'
import { PaperLibraryScreen } from '@/screens/console/PustakaScreens'
import { pageActor } from '@/server/auth/actor'
import { paperLibraryDTO } from '@/server/dal/paper-library'
import { load } from '@/server/page'
import { spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Pustaka paper' }

/** Pustaka paper lomba: bagian paper, paper yang sudah keluar, batas medali. */
export default async function PustakaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['tutor'], '/konsol/pustaka')
  const sp = await searchParams
  const data = await load(() => paperLibraryDTO(actor, spUuid(sp, 'learner')))
  return <PaperLibraryScreen data={data} />
}
