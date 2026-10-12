import type { Metadata } from 'next'
import { PaperBuilderScreen } from '@/screens/console/PaperBuilderScreen'
import { pageActor } from '@/server/auth/actor'
import { assignPaperAction, deletePaperAction, generatePaperAction, savePaperAction } from '@/server/actions/console-paper'
import { paperBuilderDTO, paperParams } from '@/server/dal/console-paper'
import { load } from '@/server/page'
import type { SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Susun paper' }

/** T04 Penyusun paper. ?paper= membuka paper tersimpan, ?mapel= dan ?grade= memilih kolam soal, ?tambah= dari bank soal. */
export default async function PaperBuilderPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['tutor'], '/konsol/paper')
  const sp = await searchParams
  const data = await load(() => paperBuilderDTO(actor, paperParams(sp)))
  return (
    <PaperBuilderScreen
      data={data}
      actions={{ savePaper: savePaperAction, generatePaper: generatePaperAction, assignPaper: assignPaperAction, deletePaper: deletePaperAction }}
    />
  )
}
