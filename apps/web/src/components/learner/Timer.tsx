'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { useReducedMotion } from './hooks'
import { playSfx, primeSfx } from './sfx'
import {
  RING_CIRCUMFERENCE,
  RING_RADIUS,
  RING_STROKE,
  RING_STROKE_URGENT,
  RING_VIEWBOX,
  formatClock,
  isUrgent,
  remainingFraction,
  ringOffset,
  smoothRemaining,
  spokenDuration,
  timerSound,
  toneForFraction,
  type TimerTone,
} from './timer-logic'

/**
 * Timer (papan Timer). Hitung mundur berupa cincin yang menyusut halus: hijau di atas 50 persen,
 * kuning sampai 20 persen, merah di bawahnya. Di 10 detik terakhir angka membesar, cincin menebal,
 * dan ada bunyi tik tiap detik (bisa dimatikan dari tombol suara). Saat habis ada bunyi dan satu
 * gerakan singkat. Dengan reduced motion hanya warna yang berubah. Mohave dengan angka tabular,
 * tidak berkedip. Sisa 1 menit ditandai warna dan teks, lalu diumumkan sekali ke pembaca layar lewat
 * wilayah status yang isinya hanya berubah satu kali. Server tetap penentu batas waktu.
 */

export { formatClock, spokenDuration }

const RING_CLASS: Record<TimerTone, string> = {
  neutral: 'stroke-fg',
  green: 'stroke-success',
  amber: 'stroke-warn',
  red: 'stroke-danger',
}

const DIGIT_CLASS: Record<TimerTone, string> = {
  neutral: 'text-fg',
  green: 'text-fg',
  amber: 'text-warn',
  red: 'text-danger',
}

export function Timer({
  mode,
  seconds,
  className,
  compact = false,
  warnAt = 60,
  total,
  tick = true,
}: {
  /** countdown: `seconds` adalah sisa waktu. stopwatch: waktu yang sudah lewat. */
  mode: 'countdown' | 'stopwatch'
  seconds: number
  className?: string
  /** Tanpa label teks di HP sempit; aria-label tetap lengkap. */
  compact?: boolean
  /** Detik tersisa saat peringatan mulai. Default 60; sprint 60 detik memakai 10. 0 berarti tanpa peringatan. */
  warnAt?: number
  /** Waktu penuh dalam detik untuk ukuran cincin. Tanpa ini dipakai sisa waktu terbesar yang pernah terlihat. */
  total?: number
  /** Bunyi tik di 10 detik terakhir dan bunyi waktu habis. Tetap tunduk pada tombol suara. */
  tick?: boolean
}): ReactElement {
  const s = Math.max(0, Math.floor(seconds))
  const countdown = mode === 'countdown'
  const calm = warnAt <= 0
  const up = countdown && s === 0
  const low = countdown && s > 0 && s <= warnAt
  const reduce = useReducedMotion()
  const urgent = countdown && isUrgent(s, calm)
  const grow = urgent && !reduce

  const [peak, setPeak] = useState(s)
  if (s > peak) setPeak(s)
  const full = total !== undefined && total > 0 ? total : Math.max(peak, s)
  const fraction = remainingFraction(s, full)
  const tone: TimerTone = calm || !countdown ? 'neutral' : toneForFraction(fraction)

  // Bunyi: tik tiap detik di 10 detik terakhir, lalu bunyi waktu habis. Render pertama tidak berbunyi.
  const before = useRef<number | null>(null)
  useEffect(() => {
    const prev = before.current
    before.current = s
    if (!countdown || !tick) return
    const sound = timerSound(prev, s, calm)
    if (sound) playSfx(sound)
  }, [s, countdown, tick, calm])
  useEffect(() => {
    if (countdown && tick && !calm) primeSfx()
  }, [countdown, tick, calm])

  // Cincin turun mulus di antara dua nilai detik. Dengan reduced motion cincin turun per detik tanpa transisi.
  const ring = useRef<SVGCircleElement>(null)
  useEffect(() => {
    const el = ring.current
    if (!el || !countdown || reduce || s <= 0) return
    const start = performance.now()
    let raf = 0
    const frame = (now: number) => {
      el.style.strokeDashoffset = String(ringOffset(remainingFraction(smoothRemaining(s, now - start), full)))
      if (now - start < 1000) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [s, full, countdown, reduce])

  const aria = !countdown ? `${spokenDuration(s)} spent` : up ? "Time's up" : `${spokenDuration(s)} left`
  const lowLabel = warnAt >= 60 && !urgent ? '1 minute left' : `${s} ${s === 1 ? 'second' : 'seconds'} left`
  const label = !countdown ? 'so far' : up ? "Time's up" : low ? lowLabel : 'left'
  const stroke = grow ? RING_STROKE_URGENT : RING_STROKE
  const borderTone = up ? 'border-fg' : tone === 'red' ? 'border-danger' : low && tone === 'amber' ? 'border-warn' : 'border-border'

  return (
    <>
      <div
        role="timer"
        aria-label={aria}
        suppressHydrationWarning
        className={cx(
          'inline-flex h-14 flex-none items-center gap-2 rounded-control border-2 bg-surface',
          countdown ? 'pr-4.5 pl-1.5' : 'px-4.5',
          up && 'kira-pop bg-bg',
          borderTone,
          className,
        )}
      >
        {countdown ? (
          <span className="relative inline-flex h-11 w-11 flex-none items-center justify-center">
            <svg viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`} width={RING_VIEWBOX} height={RING_VIEWBOX} aria-hidden="true" focusable="false" className="absolute inset-0">
              <circle cx={RING_VIEWBOX / 2} cy={RING_VIEWBOX / 2} r={RING_RADIUS} fill="none" strokeWidth={stroke} className="stroke-divider" />
              <circle
                ref={ring}
                cx={RING_VIEWBOX / 2}
                cy={RING_VIEWBOX / 2}
                r={RING_RADIUS}
                fill="none"
                strokeWidth={stroke}
                strokeDasharray={RING_CIRCUMFERENCE}
                transform={`rotate(-90 ${RING_VIEWBOX / 2} ${RING_VIEWBOX / 2})`}
                style={{ strokeDashoffset: ringOffset(fraction) }}
                className={RING_CLASS[tone]}
                suppressHydrationWarning
              />
            </svg>
            <UiIcon name="clock" size={18} className="relative text-fg" />
          </span>
        ) : (
          <UiIcon name="stopwatch" size={24} className="text-fg" />
        )}
        <span
          aria-hidden="true"
          className={cx(
            'inline-block font-display text-h1 font-semibold tabular-nums transition-transform duration-(--duration-base) ease-kira',
            countdown && 'mx-1',
            grow && 'scale-125',
            DIGIT_CLASS[tone],
          )}
          suppressHydrationWarning
        >
          {formatClock(s, !countdown)}
        </span>
        {compact ? null : (
          <span
            aria-hidden="true"
            className={cx('text-body whitespace-nowrap', low ? cx('font-bold', tone === 'red' ? 'text-danger' : 'text-warn') : up ? 'font-bold' : 'font-semibold text-fg-muted')}
          >
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
