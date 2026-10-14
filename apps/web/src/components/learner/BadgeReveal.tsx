'use client'

import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { cx } from '@/components/ui/cx'

/**
 * Pembuka lencana baru: kartu berputar masuk (flip) dengan kilau yang lewat sekali. Dibungkus di sekitar
 * isi kartu lencana; wadahnya relative dan overflow-hidden supaya kilau terpotong rapi. Reduced motion:
 * kartu langsung tampil, kilau hanya memudar.
 */
export function BadgeReveal({ children, className, delayMs = 600 }: { children: ReactNode; className?: string; delayMs?: number }): ReactElement {
  return (
    <div className={cx('kira-flip-in kira-shine relative overflow-hidden rounded-card', className)} style={{ '--kira-delay': `${delayMs}ms` } as CSSProperties}>
      {children}
    </div>
  )
}
