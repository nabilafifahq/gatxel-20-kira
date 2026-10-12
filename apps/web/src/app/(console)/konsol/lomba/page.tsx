import type { Metadata } from 'next'
import { CompetitionCalendarScreen } from '@/screens/console/CompetitionCalendarScreen'
import { deleteEventAction, saveEventAction, setEventStatusAction } from '@/server/actions/console-competitions'
import { pageActor } from '@/server/auth/actor'
import { competitionCalendarDTO } from '@/server/dal/console-competitions'
import { load } from '@/server/page'
import { spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Kalender lomba' }

/** T08 Kalender lomba: garis waktu 12 bulan, tabel lomba dengan status pendaftaran, dan katalog. */
export default async function CompetitionCalendarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['tutor'], '/konsol/lomba')
  const sp = await searchParams
  const data = await load(() => competitionCalendarDTO(actor, spUuid(sp, 'learner')))
  return <CompetitionCalendarScreen data={data} actions={{ saveEvent: saveEventAction, setStatus: setEventStatusAction, deleteEvent: deleteEventAction }} />
}
