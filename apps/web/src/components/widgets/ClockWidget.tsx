'use client'

import type { ReactElement } from 'react'
import { IconButton } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { asClock } from './answers'
import type { WidgetProps } from './types'

/**
 * Atur jarum jam dengan tombol (tanpa seret): jam naik atau turun 1, menit naik atau
 * turun sesuai stepMinutes soal. Jarum jam ikut bergeser sesuai menit.
 * Nilai { h, m } dengan h 1 sampai 12.
 */

const HAND: Record<WidgetProps['subject'], string> = { math: 'stroke-math', english: 'stroke-english', science: 'stroke-science' }

export function clockLabel(h: number, m: number): string {
  return `${h}:${m < 10 ? `0${m}` : m}`
}

/** Koordinat dibulatkan supaya HTML server dan client sama persis (hasil sin dan cos bisa beda di digit akhir). */
function r2(n: number): number {
  return Math.round(n * 100) / 100
}

export function ClockFace({ h, m, empty = false, handClass = 'stroke-math', size = 220 }: { h: number; m: number; empty?: boolean; handClass?: string; size?: number }): ReactElement {
  const hourAngle = ((h % 12) + m / 60) * 30
  const minuteAngle = m * 6
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true" className="flex-none">
      <circle cx="100" cy="100" r="92" className="fill-surface stroke-fg" strokeWidth="4" />
      {Array.from({ length: 60 }, (_, k) => {
        const major = k % 5 === 0
        const a = (k * 6 * Math.PI) / 180
        const r1 = major ? 76 : 82
        return (
          <line
            key={k}
            x1={r2(100 + Math.sin(a) * r1)}
            y1={r2(100 - Math.cos(a) * r1)}
            x2={r2(100 + Math.sin(a) * 88)}
            y2={r2(100 - Math.cos(a) * 88)}
            className={major ? 'stroke-fg' : 'stroke-border'}
            strokeWidth={major ? 3 : 1.5}
          />
        )
      })}
      {Array.from({ length: 12 }, (_, k) => {
        const n = k + 1
        const a = (n * 30 * Math.PI) / 180
        return (
          <text key={n} x={r2(100 + Math.sin(a) * 60)} y={r2(100 - Math.cos(a) * 60 + 8)} textAnchor="middle" fontSize="22" className="fill-fg font-reading">
            {n}
          </text>
        )
      })}
      <g className={cx(empty && 'opacity-40')}>
        <line x1="100" y1="100" x2={r2(100 + Math.sin((hourAngle * Math.PI) / 180) * 42)} y2={r2(100 - Math.cos((hourAngle * Math.PI) / 180) * 42)} className="stroke-fg" strokeWidth="8" strokeLinecap="round" />
        <line x1="100" y1="100" x2={r2(100 + Math.sin((minuteAngle * Math.PI) / 180) * 70)} y2={r2(100 - Math.cos((minuteAngle * Math.PI) / 180) * 70)} className={handClass} strokeWidth="5" strokeLinecap="round" />
      </g>
      <circle cx="100" cy="100" r="7" className="fill-fg" />
    </svg>
  )
}

export function ClockWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement {
  const t = asClock(value)
  const step = item.clockStep && item.clockStep > 0 ? item.clockStep : 5
  const h = t?.h ?? 12
  const m = t?.m ?? 0
  const locked = disabled || !!feedback

  const setTime = (nh: number, nm: number) => {
    if (locked) return
    const hh = ((((nh - 1) % 12) + 12) % 12) + 1
    const mm = ((nm % 60) + 60) % 60
    onChange({ h: hh, m: mm })
  }
  const addMinutes = (delta: number) => {
    let nm = m + delta
    let nh = h
    if (nm >= 60) {
      nm -= 60
      nh += 1
    } else if (nm < 0) {
      nm += 60
      nh -= 1
    }
    setTime(nh, nm)
  }

  const handClass = feedback === 'correct' ? 'stroke-success' : feedback === 'not-yet' ? 'stroke-warn' : HAND[subject]

  return (
    <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
      <div
        role="img"
        aria-label={t ? `Clock showing ${clockLabel(h, m)}` : 'Clock, not set yet'}
        className={cx(
          'rounded-pill p-1',
          feedback === 'correct' ? 'bg-success-50' : feedback === 'not-yet' ? 'bg-warn-50' : 'bg-transparent',
        )}
      >
        <ClockFace h={h} m={m} empty={!t} handClass={handClass} />
      </div>
      <div className="flex flex-col gap-3">
        <output aria-live="polite" className="text-center font-display text-h1 font-semibold tabular-nums">
          {t ? clockLabel(h, m) : <span className="font-body text-body-lg font-bold text-fg-muted">Set the time</span>}
        </output>
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <IconButton icon="minus" label="Hour back" disabled={locked} onClick={() => setTime(h - 1, m)} />
          <span className="text-center text-body font-bold">Hour</span>
          <IconButton icon="plus" label="Hour forward" disabled={locked} onClick={() => setTime(h + 1, m)} />
          <IconButton icon="minus" label={`Minutes back by ${step}`} disabled={locked} onClick={() => addMinutes(-step)} />
          <span className="text-center text-body font-bold">Minutes</span>
          <IconButton icon="plus" label={`Minutes forward by ${step}`} disabled={locked} onClick={() => addMinutes(step)} />
        </div>
      </div>
    </div>
  )
}
