import type { Metadata } from 'next'
import { TutorTodayScreen } from '@/screens/console/TutorTodayScreen'
import { pageActor } from '@/server/auth/actor'
import { tutorTodayDTO } from '@/server/dal/console-today'
import { load } from '@/server/page'
import { spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Hari ini' }

/** T01 Hari ini: perlu perhatian, status quest hari ini, tren 4 minggu. */
export default async function TutorTodayPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['tutor'], '/konsol')
  const sp = await searchParams
  const { data, failed } = await load(() => tutorTodayDTO(actor, spUuid(sp, 'learner')))
  return <TutorTodayScreen data={data} failed={failed} />
}
