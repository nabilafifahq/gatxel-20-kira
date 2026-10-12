import type { ReactNode } from 'react'
import type { Subject } from '@/lib/dto'

/**
 * Lembar A4 portrait (210 x 297 mm) untuk paper, kunci, dan LJK (papan PaperA4Hal1,
 * PaperA4Kunci, LjkA4). Satu <PrintSheet> sama dengan satu halaman kertas:
 * header dengan kode, isi, footer dengan kode dan nomor halaman.
 * Di layar lembar ditumpuk dengan jarak; saat dicetak setiap lembar satu halaman.
 */

export const SHEET_CSS = `
@page { size: A4 portrait; margin: 0; }
.print-stack { display: flex; flex-direction: column; align-items: center; gap: 24px; padding-bottom: 24px; background: var(--color-bg); }
.print-sheet {
  position: relative; box-sizing: border-box; width: 210mm; height: 297mm; padding: 14.8mm 16.9mm 12.7mm;
  display: flex; flex-direction: column; gap: 5.3mm; overflow: hidden;
  background: var(--color-white); color: var(--color-fg); font-family: var(--font-body);
  border: 1px solid var(--color-divider);
}
.print-sheet .print-avoid { break-inside: avoid; }
@media screen and (max-width: 52rem) {
  .print-stack { align-items: flex-start; overflow-x: auto; max-width: 100vw; }
}
@media print {
  html, body { background: var(--color-white) !important; }
  .print-stack { gap: 0; padding: 0; background: var(--color-white); }
  .print-sheet { border: 0; break-after: page; }
  .print-sheet:last-child { break-after: auto; }
  .print-sheet, .print-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`

/** Gaya halaman cetak. Dirender sekali per dokumen cetak. */
export function PrintStyles() {
  return <style>{SHEET_CSS}</style>
}

const ACCENT_BORDER: Record<Subject, string> = { math: 'border-math', english: 'border-english', science: 'border-science' }

export function PrintSheet({
  code,
  label,
  accent,
  page,
  pages,
  footerLabel,
  children,
  bare,
}: {
  code: string
  /** Teks di samping logo, misalnya "Math, Grade 2" atau "Answer key, for the tutor". */
  label?: string
  /** Garis aksen header; null berarti garis --fg (kunci jawaban). */
  accent: Subject | null
  page: number
  pages: number
  footerLabel: string
  children: ReactNode
  /** Tanpa header standar (LJK punya header sendiri). */
  bare?: boolean
}) {
  return (
    <section className="print-sheet" aria-label={`Page ${page} of ${pages}`}>
      {!bare ? (
        <header className={`flex flex-none items-center gap-3.5 border-b-2 pb-3.5 ${accent ? ACCENT_BORDER[accent] : 'border-fg'}`}>
          <span className="font-display text-h2 leading-7 font-bold">Kira</span>
          {label ? <span className="text-body font-semibold">{label}</span> : null}
          <span className="ml-auto rounded-sm border-2 border-fg px-3 py-1 font-display text-h3 leading-[26px] font-semibold tabular">{code}</span>
        </header>
      ) : null}
      {children}
      <footer className="mt-auto flex flex-none justify-between gap-4 border-t border-fg-muted pt-2.5 text-small text-fg-muted">
        <span>{footerLabel}</span>
        <span className="tabular">
          Page {page} of {pages}
        </span>
      </footer>
    </section>
  )
}
