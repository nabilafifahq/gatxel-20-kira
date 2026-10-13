import type { Metadata } from 'next'
import { ProgramsScreen } from '@/screens/console/PustakaScreens'
import { cancelProgramAction, startProgramAction } from '@/server/actions/console-pustaka'
import { pageActor } from '@/server/auth/actor'
import { programsDTO } from '@/server/dal/console-program'
import { load } from '@/server/page'
import { spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Program olimpiade' }

/** Program Persiapan Olimpiade 8 minggu: pilih program dan tanggal mulai, Kira mengisi Rencana. */
export default async function ProgramPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['tutor'], '/konsol/pustaka/program')
  const sp = await searchParams
  const data = await load(() => programsDTO(actor, spUuid(sp, 'learner')))
  return <ProgramsScreen data={data} actions={{ startProgram: startProgramAction, cancelProgram: cancelProgramAction }} />
}
