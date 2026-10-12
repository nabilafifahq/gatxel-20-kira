import { useId, type ReactElement } from 'react'
import type { FigureSpec } from '../spec'
import { FONT_LABEL } from '../palette'
import { draw } from './draw'

/** Ukuran intrinsik figur (viewBox) untuk tata letak. */
export function figureBox(spec: FigureSpec): { width: number; height: number } {
  const d = draw(spec, { uid: 'kbox' })
  return { width: Math.ceil(d.w), height: Math.ceil(d.h) }
}

/**
 * Render FigureSpec ke satu <svg>. viewBox mengikuti isi, lebar mengalir 100% sampai
 * `maxWidth` (bawaan: lebar alami), tinggi mengikuti rasio. Nama aksesibel dari `alt`.
 */
export function Figure({ spec, className, maxWidth }: { spec: FigureSpec; className?: string; maxWidth?: number }): ReactElement {
  // awalan id untuk <defs>; huruf k supaya tidak pernah terbaca sebagai warna hex
  const uid = `k${useId().replace(/[^A-Za-z0-9_-]/g, '')}`
  const d = draw(spec, { uid })
  const w = Math.ceil(d.w)
  const h = Math.ceil(d.h)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      role="img"
      aria-label={spec.alt}
      className={className}
      fontFamily={FONT_LABEL}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '100%', maxWidth: maxWidth ?? w, height: 'auto', display: 'block', fontVariantNumeric: 'tabular-nums' }}
    >
      <title>{spec.alt}</title>
      {d.el}
    </svg>
  )
}
