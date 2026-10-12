'use client'

import { useState, type KeyboardEvent, type ReactElement } from 'react'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { asShaded } from './answers'
import type { WidgetProps } from './types'

/**
 * Arsir pecahan: ketuk bagian bangun untuk mengarsir atau menghapus arsiran.
 * Setiap bagian bisa difokus dan dipilih dengan Enter atau Spasi.
 * Nilai { shaded: number } berisi jumlah bagian yang diarsir.
 */

const FILL: Record<WidgetProps['subject'], string> = { math: 'fill-math', english: 'fill-english', science: 'fill-science' }

function gridDims(parts: number): { rows: number; cols: number } {
  let best = { rows: 1, cols: parts }
  for (let r = 1; r * r <= parts; r++) if (parts % r === 0) best = { rows: r, cols: parts / r }
  return best
}

function slicePath(k: number, parts: number, cx0: number, cy0: number, r: number): string {
  if (parts === 1) return `M${cx0 - r} ${cy0} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`
  const a0 = (k / parts) * Math.PI * 2 - Math.PI / 2
  const a1 = ((k + 1) / parts) * Math.PI * 2 - Math.PI / 2
  const x0 = cx0 + Math.cos(a0) * r
  const y0 = cy0 + Math.sin(a0) * r
  const x1 = cx0 + Math.cos(a1) * r
  const y1 = cy0 + Math.sin(a1) * r
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${cx0} ${cy0} L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`
}

export function FractionWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement {
  const shape = item.fraction?.shape ?? 'bar'
  const parts = Math.max(1, item.fraction?.parts ?? 4)
  const count = asShaded(value)
  const [set, setSet] = useState<Set<number>>(() => new Set(Array.from({ length: count ?? 0 }, (_, k) => k)))
  const locked = disabled || !!feedback
  // Nilai dari luar berubah (misalnya Try again): samakan arsiran.
  const current = set.size === (count ?? 0) ? set : new Set(Array.from({ length: count ?? 0 }, (_, k) => k))
  if (current !== set) setSet(current)

  const toggle = (k: number) => {
    if (locked) return
    const next = new Set(current)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    setSet(next)
    onChange({ shaded: next.size })
  }
  const onKey = (e: KeyboardEvent<SVGElement>, k: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle(k)
    }
  }

  const fill = feedback === 'correct' ? 'fill-success' : feedback === 'not-yet' ? 'fill-warn' : FILL[subject]
  const partProps = (k: number) => ({
    role: 'button',
    tabIndex: locked ? -1 : 0,
    'aria-pressed': current.has(k),
    'aria-label': `Part ${k + 1} of ${parts}${current.has(k) ? ', shaded' : ''}`,
    onClick: () => toggle(k),
    onKeyDown: (e: KeyboardEvent<SVGElement>) => onKey(e, k),
    className: cx(current.has(k) ? fill : 'fill-surface', 'stroke-fg', !locked && 'cursor-pointer'),
    strokeWidth: 3,
  })

  let svg: ReactElement
  if (shape === 'circle') {
    svg = (
      <svg viewBox="0 0 240 240" className="h-auto w-full max-w-[280px]">
        {Array.from({ length: parts }, (_, k) => (
          <path key={k} d={slicePath(k, parts, 120, 120, 108)} strokeLinejoin="round" {...partProps(k)} />
        ))}
      </svg>
    )
  } else if (shape === 'square') {
    const { rows, cols } = gridDims(parts)
    const size = 220
    const cw = size / cols
    const ch = size / rows
    svg = (
      <svg viewBox={`0 0 ${size + 8} ${size + 8}`} className="h-auto w-full max-w-[280px]">
        {Array.from({ length: parts }, (_, k) => (
          <rect key={k} x={4 + (k % cols) * cw} y={4 + Math.floor(k / cols) * ch} width={cw} height={ch} {...partProps(k)} />
        ))}
      </svg>
    )
  } else {
    const w = 480
    const pw = w / parts
    svg = (
      <svg viewBox={`0 0 ${w + 8} 108`} className="h-auto w-full max-w-[520px]">
        {Array.from({ length: parts }, (_, k) => (
          <rect key={k} x={4 + k * pw} y={4} width={pw} height={100} {...partProps(k)} />
        ))}
      </svg>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="m-0 self-start text-body font-semibold text-fg-muted">Tap the parts to shade them.</p>
      <div role="group" aria-label={`Shape cut into ${parts} equal parts`} className="flex w-full justify-center">
        {svg}
      </div>
      <div className="flex w-full items-center justify-between gap-3">
        <output aria-live="polite" className="text-body-lg font-bold tabular-nums">
          {current.size} of {parts} parts shaded
        </output>
        <Button variant="secondary" size="M" disabled={locked || current.size === 0} onClick={() => {
          setSet(new Set())
          onChange({ shaded: 0 })
        }}>
          Clear
        </Button>
      </div>
    </div>
  )
}
