import type { MonthlyReportDTO } from '@/lib/dto-coach'
import { ReportBody } from '@/components/coach/ReportBody'
import { PrintToolbar } from '@/components/print/PrintToolbar'

/**
 * Rapor bulanan di kertas A4. Satu dokumen yang mengalir (bukan lembar bertinggi tetap), dengan header Kira.
 * Dicetak lewat peramban; di HP pilih Simpan sebagai PDF.
 */
const CSS = `
@page { size: A4 portrait; margin: 14mm 16mm; }
.report-page { box-sizing: border-box; max-width: 210mm; margin: 0 auto; padding: 14mm 16mm; background: var(--color-white); color: var(--color-fg); }
@media screen { .report-page { margin-block: 16px; border: 1px solid var(--color-divider); } }
@media screen and (max-width: 40rem) { .report-page { padding: 16px; margin: 0; border: 0; } }
@media print { html, body { background: var(--color-white) !important; } .report-page { padding: 0; border: 0; margin: 0; max-width: none; } .report-page * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`

export function MonthlyReportPrint({ report: r }: { report: MonthlyReportDTO }) {
  return (
    <main className="report-page flex flex-col gap-5" lang="id">
      <style>{CSS}</style>
      <PrintToolbar note={`Rapor ${r.monthLabel}`} />
      <header className="flex items-center gap-3.5 border-b-2 border-fg pb-3.5">
        <span className="font-display text-h2 leading-7 font-bold">Kira</span>
        <span className="text-body font-semibold">Rapor bulanan</span>
        <span className="ml-auto text-body font-semibold">{r.monthLabel}</span>
      </header>
      <div>
        <h1 className="m-0 text-h2 font-bold">{r.name}</h1>
        <p className="m-0 text-body text-fg-muted">Kelas {r.grade}</p>
      </div>
      <ReportBody r={r} />
      <footer className="mt-2 border-t border-fg-muted pt-2.5 text-small text-fg-muted">Dibuat oleh Kira dari catatan belajar di aplikasi. Rapor ini untuk keluarga dan bukan dokumen sekolah.</footer>
    </main>
  )
}
