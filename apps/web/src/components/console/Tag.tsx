import type { ReactNode } from 'react'
import { cx } from './cx'

/** Label kecil seperti Pill, tetapi teks panjang (alamat, catatan) boleh turun baris supaya halaman tidak melebar di HP. */
export function Tag({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warn'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex min-h-[26px] max-w-full items-center gap-1 rounded-pill border px-2.5 py-0.5 text-small font-bold [overflow-wrap:anywhere]',
        tone === 'neutral' && 'border-border bg-surface text-fg',
        tone === 'success' && 'border-success bg-surface text-fg',
        tone === 'warn' && 'border-warn bg-warn-50 text-fg',
        className,
      )}
    >
      {children}
    </span>
  )
}
