'use client'

import type { CSSProperties, ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { StarGlyph } from './StreakChain'

/**
 * Tingkat kombo dari jumlah jawaban benar beruntun di percobaan pertama: 0 sampai 2 belum ada kombo,
 * 3 sampai 4 tingkat 1, 5 sampai 6 tingkat 2, 7 ke atas tingkat 3. Bintang tumbuh makin besar.
 */
export function comboLevel(streak: number): 0 | 1 | 2 | 3 {
  if (streak >= 7) return 3
  if (streak >= 5) return 2
  if (streak >= 3) return 1
  return 0
}

/** Bintang kombo: 1 sampai 3 bintang yang membesar mengikuti beruntun. Teks selalu menyertai (bukan hanya gambar). */
export function ComboStars({ streak, className }: { streak: number; className?: string }): ReactElement | null {
  const level = comboLevel(streak)
  if (level === 0) return null
  const sizes = [20, 26, 32]
  return (
    <span key={level} role="status" aria-label={`${streak} in a row`} className={cx('inline-flex items-end gap-0.5', className)}>
      {Array.from({ length: level }, (_, i) => (
        <span key={i} aria-hidden="true" className="kira-scale-in inline-flex" style={{ '--kira-delay': `${i * 90}ms` } as CSSProperties}>
          <StarGlyph filled size={sizes[Math.min(i + (level - 1), 2)]!} />
        </span>
      ))}
      <span className="ml-1.5 text-body font-bold tabular-nums">{streak} in a row</span>
    </span>
  )
}
