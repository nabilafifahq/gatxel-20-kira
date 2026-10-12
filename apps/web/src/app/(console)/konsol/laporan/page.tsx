import type { Metadata } from 'next'
import { ButtonLink } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { EmptyState } from '@/components/console/Feedback'
import { CONSOLE_ROUTES } from '@/components/console/routes'
import { ReportScreen } from '@/screens/console/ReportScreen'
import { exportJsonAction, sendReportAction } from '@/server/actions/console-report'
import { pageActor } from '@/server/auth/actor'
import { reportDTO } from '@/server/dal/console-report'
import { load } from '@/server/page'
import { spDate, spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Laporan' }

/** T09 Laporan dan ekspor: ringkasan minggu untuk orang tua, kirim laporan, Markdown dan JSON untuk Claude. */
export default async function ReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['tutor'], '/konsol/laporan')
  const sp = await searchParams
  const { shell, report } = await load(() => reportDTO(actor, spUuid(sp, 'learner'), spDate(sp, 'minggu')))
  if (!report) {
    return (
      <ConsoleShell shell={shell} active="reports">
        <h1 className="m-0 text-h1 font-bold max-sm:text-h2">Laporan minggu</h1>
        <EmptyState
          icon="report"
          title="Belum ada learner untuk dilaporkan."
          body="Laporan minggu dibuat dari quest dan jawaban learner. Tambah learner dulu, lalu laporan pertama muncul di sini."
          actions={
            <ButtonLink href={CONSOLE_ROUTES.learners} variant="primary">
              Tambah learner
            </ButtonLink>
          }
        />
      </ConsoleShell>
    )
  }
  // Kunci per learner dan minggu: catatan, status kirim, dan JSON yang sudah dimuat tidak terbawa ke learner atau minggu lain.
  return <ReportScreen key={`${report.learnerId}:${report.weekStart}`} data={report} actions={{ sendReport: sendReportAction, exportJson: exportJsonAction }} />
}
