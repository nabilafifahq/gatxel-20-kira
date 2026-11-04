import type { Metadata } from 'next'
import { ReportScreen } from '@/screens/family/MonthlyReportScreen'
import { pageActor } from '@/server/auth/actor'
import { parentReportDTO } from '@/server/dal/coach-report'
import { consoleShell } from '@/server/dal/console-shell'
import { load } from '@/server/page'
import { spString, spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Rapor bulanan' }

/** Rapor bulanan yang bisa dicetak. Khusus orang tua. */
export default async function MonthlyReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['guardian'], '/keluarga/rapor')
  const sp = await searchParams
  const learner = spUuid(sp, 'learner')
  const [{ shell }, data] = await Promise.all([load(() => consoleShell(actor, learner)), load(() => parentReportDTO(actor, learner, spString(sp, 'bulan', 7)))])
  return <ReportScreen shell={shell} data={data} />
}
