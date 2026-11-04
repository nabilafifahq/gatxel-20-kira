'use client'

import { useRef, type KeyboardEvent, type PointerEvent, type ReactElement } from 'react'
import { IconButton } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { useT } from '@/lib/i18n/client'
import { asPosition } from './answers'
import type { WidgetProps } from './types'

/**
 * Garis bilangan: ketuk garis untuk menaruh penanda, atau pakai tombol minus dan plus.
 * Penanda juga slider keyboard (panah, Home, End). Posisi selalu dibulatkan ke kelipatan step.
 * Nilai { position: number }.
 */

const W = 600
const H = 120
const PAD = 36
const Y = 64

const MARK: Record<WidgetProps['subject'], string> = { math: 'fill-math', english: 'fill-english', science: 'fill-science' }

function roundTo(v: number, step: number, min: number): number {
  const r = Math.round((v - min) / step) * step + min
  return Math.round(r * 1e6) / 1e6
}

function fmt(n: number): string {
  // Pemisah ribuan sama dengan soal: Mark 320,000 on the number line.
  return Number.isInteger(n) ? n.toLocaleString('en-GB') : String(Math.round(n * 100) / 100)
}

/** Lebar kira-kira satu angka per satuan fontSize, dipakai supaya label tidak saling menimpa. */
const CHAR_EM = 0.56

/** Label besar memakai huruf lebih kecil dan dijarangkan supaya tiap angka tetap terbaca dan tidak terpotong di ujung. */
function labelLayout(min: number, max: number, step: number, count: number): { every: number; fontSize: number } {
  const longest = Math.max(fmt(min).length, fmt(max).length, fmt(min + step).length)
  const fontSize = longest * CHAR_EM * 22 > PAD * 2 ? Math.floor((PAD * 2) / (longest * CHAR_EM)) : 22
  const byCount = count <= 12 ? 1 : count <= 24 ? 2 : count <= 60 ? 5 : 10
  const slot = (W - PAD * 2) / Math.max(count, 1)
  const byWidth = Math.ceil((longest * CHAR_EM * fontSize + 8) / slot)
  return { every: Math.max(byCount, byWidth), fontSize }
}

export function NumberLineWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement {
  const nl = item.numberline ?? { min: 0, max: 10, step: 1 }
  const { min, max } = nl
  const step = nl.step > 0 ? nl.step : 1
  const pos = asPosition(value)
  const svgRef = useRef<SVGSVGElement>(null)
  const locked = disabled || !!feedback
  const t = useT()
  const count = Math.round((max - min) / step)
  const { every: labelEvery, fontSize } = labelLayout(min, max, step, count)
  const xOf = (v: number) => PAD + ((v - min) / (max - min || 1)) * (W - PAD * 2)

  const set = (v: number) => {
    if (locked) return
    const clamped = Math.min(max, Math.max(min, roundTo(v, step, min)))
    onChange({ position: clamped })
  }

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    if (locked || !svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    const v = min + ((x - PAD) / (W - PAD * 2)) * (max - min)
    set(v)
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const base = pos ?? min
    let next: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = pos === null ? min : base + step
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = pos === null ? min : base - step
    else if (e.key === 'Home') next = min
    else if (e.key === 'End') next = max
    if (next !== null) {
      e.preventDefault()
      set(next)
    }
  }

  const markFill = feedback === 'correct' ? 'fill-success' : feedback === 'not-yet' ? 'fill-warn' : MARK[subject]

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="m-0 text-body font-semibold text-fg-muted">{t.widgets.numberLine.tapLine}</p>
      <div
        role="slider"
        tabIndex={locked ? -1 : 0}
        aria-label={t.widgets.numberLine.marker}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={pos ?? undefined}
        aria-valuetext={pos === null ? t.widgets.numberLine.noNumber : fmt(pos)}
        aria-disabled={locked || undefined}
        onKeyDown={onKey}
        className="rounded-control border-2 border-border bg-surface px-2 py-3"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={cx('block h-auto w-full touch-none select-none', !locked && 'cursor-pointer')}
          onPointerDown={onPointer}
          aria-hidden="true"
        >
          <line x1={PAD - 12} y1={Y} x2={W - PAD + 12} y2={Y} className="stroke-fg" strokeWidth="3" strokeLinecap="round" />
          {Array.from({ length: count + 1 }, (_, k) => {
            const v = min + k * step
            const x = xOf(v)
            const major = k % labelEvery === 0
            return (
              <g key={k}>
                <line x1={x} y1={Y - (major ? 12 : 7)} x2={x} y2={Y + (major ? 12 : 7)} className="stroke-fg" strokeWidth={major ? 3 : 2} />
                {major ? (
                  <text x={x} y={Y + 40} textAnchor="middle" className="fill-fg font-reading" fontSize={fontSize}>
                    {fmt(v)}
                  </text>
                ) : null}
              </g>
            )
          })}
          {pos !== null ? (
            <g>
              <path d={`M${xOf(pos)} ${Y - 6} l-13 -22 h26 z`} className={cx(markFill, 'stroke-fg')} strokeWidth="2" strokeLinejoin="round" />
              <circle cx={xOf(pos)} cy={Y} r="7" className={cx(markFill, 'stroke-fg')} strokeWidth="2" />
            </g>
          ) : null}
        </svg>
      </div>
      <div className="flex items-center gap-3">
        <IconButton icon="minus" label={t.widgets.numberLine.moveLeft} disabled={locked} onClick={() => set((pos ?? min + step) - step)} />
        <output aria-live="polite" className="min-w-24 flex-1 text-center font-reading text-h1 tabular-nums">
          {pos === null ? '' : fmt(pos)}
        </output>
        <IconButton icon="plus" label={t.widgets.numberLine.moveRight} disabled={locked} onClick={() => set(pos === null ? min : pos + step)} />
      </div>
    </div>
  )
}
