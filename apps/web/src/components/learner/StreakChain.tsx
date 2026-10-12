import type { ReactElement } from 'react'
import type { DayStatus, StreakDTO } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'

/**
 * Rantai bintang streak (papan StreakChain). Bintang --star bergaris tinta,
 * keterangan selalu berupa teks. Tanpa ikon api dan tanpa warna peringatan untuk hari terlewat.
 */

const STAR = 'M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.15L12 16.9l-5.5 2.9 1.05-6.15L3.1 9.3l6.15-.9L12 2.8z'
const HALF = 'M12 2.8L9.25 8.4 3.1 9.3l4.45 4.35L6.5 19.8 12 16.9z'

const WORD: Record<DayStatus, string> = {
  complete: 'done',
  partial: 'part done',
  rest: 'rest day',
  freeze: 'freeze used',
  missed: 'missed',
  today: 'not started yet',
  upcoming: 'coming up',
  none: 'no quests',
}

export function dayStatusWord(s: DayStatus): string {
  return WORD[s]
}

/** Satu bintang hari. `isToday` membuat bintang kosong bergaris tinta. */
export function DayGlyph({ status, size = 32, isToday = false }: { status: DayStatus; size?: number; isToday?: boolean }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="flex-none">
      {status === 'complete' ? (
        <path d={STAR} className="fill-star stroke-fg" strokeWidth="1.5" strokeLinejoin="round" />
      ) : status === 'partial' ? (
        <>
          <path d={STAR} className="fill-white" />
          <path d={HALF} className="fill-star" />
          <path d={STAR} fill="none" className="stroke-fg" strokeWidth="1.5" strokeLinejoin="round" />
        </>
      ) : status === 'rest' ? (
        <>
          <circle cx="12" cy="12" r="10" className="fill-bg stroke-border" strokeWidth="1.5" />
          <path d="M16.5 13.6A5.2 5.2 0 0 1 10.4 7.5a5.2 5.2 0 1 0 6.1 6.1z" fill="none" className="stroke-fg-muted" strokeWidth="1.5" strokeLinejoin="round" />
        </>
      ) : status === 'freeze' ? (
        <>
          <path d={STAR} className="fill-math-50 stroke-math" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M12 8.5v6.5M9.2 10.1l5.6 3.3M9.2 13.4l5.6-3.3" fill="none" className="stroke-math" strokeWidth="1.2" strokeLinecap="round" />
        </>
      ) : status === 'missed' ? (
        <path d={STAR} className="fill-bg stroke-border" strokeWidth="1.5" strokeDasharray="2 2" strokeLinejoin="round" />
      ) : (
        <path d={STAR} className={cx('fill-white', isToday || status === 'today' ? 'stroke-fg' : 'stroke-border')} strokeWidth="1.5" strokeLinejoin="round" />
      )}
    </svg>
  )
}

/** Bintang penilaian skill: terisi atau kosong. */
export function StarGlyph({ filled, size = 18 }: { filled: boolean; size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="flex-none">
      <path d={STAR} className={filled ? 'fill-star stroke-fg' : 'fill-white stroke-border'} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

const SIZES = {
  L: { star: 44, gap: 'gap-5', li: 'w-12 gap-1.5', connector: true },
  M: { star: 32, gap: 'gap-1.5', li: 'w-10.5 gap-0.5', connector: false },
  S: { star: 28, gap: 'justify-between gap-0.5', li: 'min-w-0 max-w-10 flex-1', connector: false },
} as const

export function streakChainLabel(streak: StreakDTO): string {
  if (streak.weekDone === 0) return 'This week: no days done yet'
  return `This week: ${streak.weekDone} of ${streak.week.length} days done`
}

export function StreakChain({ streak, size = 'M', className }: { streak: StreakDTO; size?: keyof typeof SIZES; className?: string }): ReactElement {
  const s = SIZES[size]
  return (
    <ol aria-label={streakChainLabel(streak)} className={cx('m-0 flex list-none p-0', s.gap, className)}>
      {streak.week.map((d, i) => {
        const quiet = !d.isToday && (d.status === 'upcoming' || d.status === 'rest' || d.status === 'none')
        const prev = streak.week[i - 1]
        const solidLink = prev && (prev.status === 'complete' || prev.status === 'freeze') && (d.status === 'complete' || d.status === 'partial' || d.status === 'freeze')
        return (
          <li
            key={d.date}
            aria-label={`${d.longLabel}${d.isToday ? ', today' : ''}, ${WORD[d.status]}`}
            aria-current={d.isToday ? 'date' : undefined}
            className={cx('relative flex flex-col items-center', s.li)}
          >
            {s.connector && i > 0 ? (
              <span
                aria-hidden="true"
                className={cx('absolute top-5 -left-5 w-5 border-t-3', solidLink ? 'border-solid border-fg' : 'border-dashed border-border')}
              />
            ) : null}
            <DayGlyph status={d.status} size={s.star} isToday={d.isToday} />
            <span
              aria-hidden="true"
              className={cx(
                'text-body',
                d.isToday ? 'font-extrabold underline decoration-3 underline-offset-4' : 'font-semibold',
                quiet ? 'text-fg-muted' : 'text-fg',
              )}
            >
              {size === 'S' && d.isToday ? d.longLabel.slice(0, 3) : d.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** Angka streak Mohave dengan label. Streak 0 ditulis sebagai kalimat. */
export function StreakCount({ current, layout = 'stack', className }: { current: number; layout?: 'stack' | 'inline'; className?: string }): ReactElement {
  if (current <= 0) {
    return <div className={cx('max-w-[120px] text-body font-bold', className)}>Your streak starts today</div>
  }
  return (
    <div className={cx('flex', layout === 'stack' ? 'flex-col items-start' : 'items-baseline gap-1.5', className)}>
      <span className="font-display text-h1 font-semibold tabular-nums">{current}</span>
      <span className="text-body font-bold">day streak</span>
    </div>
  )
}

/** Pill pembeku streak. */
export function FreezePill({ count, saved = false, className }: { count: number; saved?: boolean; className?: string }): ReactElement | null {
  if (count <= 0) return null
  return (
    <span className={cx('inline-flex h-10 flex-none items-center gap-1.5 rounded-pill border border-math bg-math-50 pr-3 pl-2 text-body font-bold whitespace-nowrap', className)}>
      <UiIcon name="snowflake" size={20} className="text-math" />
      {count === 1 ? '1 freeze' : `${count} freezes`}
      {saved ? ' saved' : ''}
    </span>
  )
}
