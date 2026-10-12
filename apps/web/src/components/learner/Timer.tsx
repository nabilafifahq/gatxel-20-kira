import type { ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'

/**
 * Timer (papan Timer). Mohave dengan angka tabular, tidak berkedip. Sisa 1 menit
 * ditandai warna, ikon, dan teks, lalu diumumkan sekali ke pembaca layar lewat
 * wilayah status yang isinya hanya berubah satu kali.
 */

export function formatClock(totalSec: number, pad = false): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${pad && m < 10 ? `0${m}` : m}:${r < 10 ? `0${r}` : r}`
}

export function spokenDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  const parts: string[] = []
  if (m > 0) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`)
  if (r > 0 || m === 0) parts.push(`${r} ${r === 1 ? 'second' : 'seconds'}`)
  return parts.join(' ')
}

export function Timer({
  mode,
  seconds,
  className,
  compact = false,
  warnAt = 60,
}: {
  /** countdown: `seconds` adalah sisa waktu. stopwatch: waktu yang sudah lewat. */
  mode: 'countdown' | 'stopwatch'
  seconds: number
  className?: string
  /** Tanpa label teks di HP sempit; aria-label tetap lengkap. */
  compact?: boolean
  /** Detik tersisa saat peringatan mulai. Default 60; sprint 60 detik memakai 10. */
  warnAt?: number
}): ReactElement {
  const s = Math.max(0, Math.floor(seconds))
  const up = mode === 'countdown' && s === 0
  const low = mode === 'countdown' && s > 0 && s <= warnAt
  const aria =
    mode === 'stopwatch' ? `${spokenDuration(s)} spent` : up ? "Time's up" : `${spokenDuration(s)} left`
  const lowLabel = warnAt >= 60 ? '1 minute left' : `${s} seconds left`
  const label = mode === 'stopwatch' ? 'so far' : up ? "Time's up" : low ? lowLabel : 'left'
  return (
    <>
      <div
        role="timer"
        aria-label={aria}
        suppressHydrationWarning
        className={cx(
          'inline-flex h-14 flex-none items-center gap-2.5 rounded-control',
          up ? 'border-2 border-fg bg-bg px-4.5' : low ? 'border-3 border-warn bg-surface px-[17px]' : 'border-2 border-border bg-surface px-4.5',
          className,
        )}
      >
        <UiIcon name={mode === 'stopwatch' ? 'stopwatch' : 'clock'} size={24} className={low ? 'text-warn' : 'text-fg'} />
        <span aria-hidden="true" className="font-display text-h1 font-semibold tabular-nums" suppressHydrationWarning>
          {formatClock(s, mode === 'stopwatch')}
        </span>
        {compact ? null : (
          <span aria-hidden="true" className={cx('text-body whitespace-nowrap', low ? 'font-bold text-warn' : up ? 'font-bold' : 'font-semibold text-fg-muted')}>
            {label}
          </span>
        )}
      </div>
      <span role="status" className="visually-hidden">
        {low || up ? (up ? "Time's up" : warnAt >= 60 ? '1 minute left' : 'Almost out of time') : ''}
      </span>
    </>
  )
}
