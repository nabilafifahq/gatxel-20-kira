'use client'

import type { CSSProperties, ReactElement } from 'react'
import { cx } from '@/components/ui/cx'

/**
 * "+15 XP" yang naik dari tempat jawaban ke arah bar XP lalu memudar. Hiasan (aria-hidden): XP tetap
 * dibacakan lewat teks di lembar umpan balik. `nonce` berubah tiap jawaban supaya gerak diputar ulang.
 * Reduced motion: angka muncul diam sebentar lalu memudar (opacity saja).
 */
export function XpFly({
  xp,
  nonce,
  className,
  toward = { x: 0, y: -96 },
}: {
  xp: number
  nonce: string | number
  className?: string
  toward?: { x: number; y: number }
}): ReactElement | null {
  if (xp <= 0) return null
  return (
    <span
      key={nonce}
      aria-hidden="true"
      className={cx(
        'kira-fly pointer-events-none absolute z-10 font-display text-h2 font-semibold text-fg tabular-nums',
        className,
      )}
      style={{ '--fly-x': `${toward.x}px`, '--fly-y': `${toward.y}px` } as CSSProperties}
    >
      +{xp}
    </span>
  )
}
