'use client'

import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { Figure, figureBox } from '@kira/figures'
import type { FigureSpec } from '@kira/figures/spec'
import { cx } from '@/components/ui/cx'

/**
 * Figur dengan lapisan ketuk di atasnya. Lapisan memakai persen dari lebar dan tinggi figur, jadi area
 * ketuk tetap pas di gambar saat figur mengecil di HP. Pusat area ada di (x, y); lebar dan tinggi minimal 56 px.
 */

export function stageStyle(x: number, y: number, w: number, h: number): CSSProperties {
  return { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, minWidth: 56, minHeight: 56, transform: 'translate(-50%, -50%)' }
}

/** Titik bulat 56 px yang berpusat di (x, y), untuk nomor di diagram. */
export function pinStyle(x: number, y: number): CSSProperties {
  return { left: `${x}%`, top: `${y}%`, width: 56, height: 56, transform: 'translate(-50%, -50%)' }
}

export function FigureStage({ spec, children, className }: { spec: FigureSpec; children: ReactNode; className?: string }): ReactElement {
  const box = figureBox(spec)
  return (
    <div className={cx('relative mx-auto w-full rounded-control border border-divider bg-surface', className)} style={{ maxWidth: Math.min(Math.max(box.width, 260), 480) }}>
      <Figure spec={spec} />
      {children}
    </div>
  )
}
