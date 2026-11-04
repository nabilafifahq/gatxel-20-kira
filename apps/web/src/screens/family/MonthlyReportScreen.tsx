import Link from 'next/link'
import type { ConsoleShell } from '@/lib/dto'
import type { ReportPageDTO } from '@/lib/dto-coach'
import { ChildPicker } from '@/components/coach/ChildPicker'
import { ReportBody } from '@/components/coach/ReportBody'
import { ButtonLink } from '@/components/console/Button'
import { cx } from '@/components/console/cx'
import { EmptyState } from '@/components/console/Feedback'
import { PRINT_ROUTES } from '@/components/console/routes'
import { FamilyShell } from '@/components/family/FamilyShell'

/** Rapor bulanan di aplikasi: pilih anak dan bulan, lihat isi, lalu buka versi cetak A4. */
export function ReportScreen({ shell, data }: { shell: ConsoleShell; data: ReportPageDTO }) {
  const r = data.report
  return (
    <FamilyShell shell={shell} active="report" {...(r ? { learnerName: r.name } : {})}>
      <header className="flex flex-col gap-1.5">
        <h1 className="m-0 text-h2 font-bold">Rapor bulanan</h1>
        <p className="m-0 text-body text-fg-muted">Ringkasan satu bulan belajar yang bisa dicetak atau disimpan sebagai PDF.</p>
      </header>
      {!r ? (
        <EmptyState
          icon="learners"
          title="Belum ada anak di keluarga ini."
          body="Tambahkan anak lebih dulu. Rapor pertama muncul setelah ia belajar."
          actions={
            <ButtonLink href="/keluarga" variant="primary">
              Ke halaman Anak saya
            </ButtonLink>
          }
        />
      ) : (
        <>
          <ChildPicker children={data.children} selectedId={data.selectedId} href={(id) => `/keluarga/rapor?learner=${encodeURIComponent(id)}&bulan=${r.month}`} />
          <nav aria-label="Pilih bulan" className="flex gap-2 overflow-x-auto pb-1">
            {r.months.map((m) => {
              const on = m.value === r.month
              return (
                <Link
                  key={m.value}
                  href={`/keluarga/rapor?learner=${encodeURIComponent(r.learnerId)}&bulan=${m.value}`}
                  aria-current={on ? 'page' : undefined}
                  className={cx(
                    'inline-flex h-11 flex-none items-center rounded-pill border-2 px-4 text-body no-underline',
                    on ? 'border-fg bg-fg font-extrabold text-white hover:text-white' : 'border-border bg-surface font-semibold text-fg hover:border-fg',
                  )}
                >
                  {m.label}
                </Link>
              )
            })}
          </nav>
          <div className="flex flex-col gap-0.5">
            <h2 className="m-0 text-h3 font-bold">
              {r.name}, kelas {r.grade}, {r.monthLabel}
            </h2>
          </div>
          <ReportBody r={r} />
          <div>
            <ButtonLink href={PRINT_ROUTES.report(r.learnerId, r.month)} variant="primary" icon="printer" external>
              Buka versi cetak
            </ButtonLink>
          </div>
        </>
      )}
    </FamilyShell>
  )
}
