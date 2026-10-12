import type { ReactElement } from 'react'
import type { FigureSpec } from '../spec'
import { DIVIDER, FONT_LABEL, INK, MUTED, WHITE } from '../palette'

/** Ukuran intrinsik figur (viewBox) untuk tata letak. */
export function figureBox(spec: FigureSpec): { width: number; height: number } {
  void spec
  return { width: 320, height: 200 }
}

/**
 * Render FigureSpec ke SVG. Sementara: bingkai dengan teks alt sampai renderer
 * per jenis selesai di src/render/<kind>.tsx.
 */
export function Figure({ spec, className, maxWidth }: { spec: FigureSpec; className?: string; maxWidth?: number }): ReactElement {
  const { width, height } = figureBox(spec)
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={spec.alt}
      className={className}
      style={{ width: '100%', maxWidth: maxWidth ?? width, height: 'auto', display: 'block' }}
    >
      <rect x="1" y="1" width={width - 2} height={height - 2} rx="12" fill={WHITE} stroke={DIVIDER} strokeWidth="2" />
      <text x={width / 2} y={height / 2} textAnchor="middle" fontFamily={FONT_LABEL} fontSize="14" fill={MUTED}>
        {spec.kind}
      </text>
      <title>{spec.alt}</title>
      <desc>{spec.alt}</desc>
      <rect x="0" y="0" width="0" height="0" fill={INK} />
    </svg>
  )
}
