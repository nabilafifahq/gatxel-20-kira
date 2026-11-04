import type { Metadata } from 'next'
import { WorksheetClient } from '@/screens/family/WorksheetClient'
import { pageActor } from '@/server/auth/actor'
import { consoleShell } from '@/server/dal/console-shell'
import { worksheetPageDTO } from '@/server/dal/worksheet'
import { load } from '@/server/page'
import { spString, spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Lembar kerja' }

/** Lembar kerja PDF: pilih anak, mapel, skill, dan panjang. Khusus orang tua. */
export default async function WorksheetPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['guardian'], '/keluarga/lembar')
  const sp = await searchParams
  const learner = spUuid(sp, 'learner')
  const [{ shell }, data] = await Promise.all([load(() => consoleShell(actor, learner)), load(() => worksheetPageDTO(actor, learner))])
  return <WorksheetClient shell={shell} data={data} initialSkill={spString(sp, 'skill', 60)} />
}
