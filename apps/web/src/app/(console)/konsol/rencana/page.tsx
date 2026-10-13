import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PlannerScreen } from '@/screens/console/PlannerScreen'
import { pageActor } from '@/server/auth/actor'
import { plannerDTO } from '@/server/dal/console-planner'
import { load } from '@/server/page'
import { spDate, spUuid, type SearchParams } from '@/server/params'
import {
  applySuggestionsAction,
  copyWeekAction,
  deleteSlotAction,
  moveSlotAction,
  publishWeekAction,
  setDayTemplateAction,
  setRestDayAction,
  upsertSlotAction,
} from '@/server/actions/console-planner'

export const metadata: Metadata = { title: 'Rencana' }

/** T03 Perencana mingguan: ?learner= dari pemilih learner, ?minggu= tanggal apa pun di minggu itu. */
export default async function PlannerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['tutor'], '/konsol/rencana')
  const sp = await searchParams
  const data = await load(() => plannerDTO(actor, spUuid(sp, 'learner'), spDate(sp, 'minggu')))
  // Belum ada learner: rencana butuh learner, jadi arahkan ke halaman tambah learner.
  if (!data) redirect('/konsol/learner')
  return (
    <PlannerScreen
      data={data}
      actions={{
        upsertSlot: upsertSlotAction,
        moveSlot: moveSlotAction,
        deleteSlot: deleteSlotAction,
        setRestDay: setRestDayAction,
        applySuggestions: applySuggestionsAction,
        publishWeek: publishWeekAction,
        setDayTemplate: setDayTemplateAction,
        copyWeek: copyWeekAction,
      }}
    />
  )
}
