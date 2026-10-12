import type { ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { StarGlyph } from './StreakChain'

/** Pill XP: bintang dan angka Mohave tabular (papan FeedbackSheet dan Hasil). */
export function XpPill({ xp, size = 'M', className }: { xp: number; size?: 'M' | 'L'; className?: string }): ReactElement {
  return (
    <span
      className={cx(
        'inline-flex flex-none items-center gap-1.5 rounded-pill border-2 border-fg bg-surface font-display font-semibold tabular-nums whitespace-nowrap',
        size === 'L' ? 'h-11 pr-4 pl-3 text-h2' : 'h-10 pr-3.5 pl-2.5 text-h2',
        className,
      )}
    >
      <StarGlyph filled size={size === 'L' ? 24 : 22} />
      {xp >= 0 ? `+${xp} XP` : `${xp} XP`}
    </span>
  )
}
