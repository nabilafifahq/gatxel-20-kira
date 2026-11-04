'use client'

import { useMemo, type KeyboardEvent, type ReactElement } from 'react'
import { analysePegs, formatLength, type Peg } from '@kira/content/manip'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { playSfx } from '@/components/learner/sfx'
import type { ToolProps } from './types'

/**
 * Geoboard: ketuk pasak untuk menaruh titik sudut satu per satu. Ketuk pasak pertama lagi untuk menutup bentuk.
 * Sisi, keliling, dan luas dihitung langsung dari kotak satuan di papan. Nilai: { pegs, closed }.
 */

export type GeoState = { pegs: Peg[]; closed: boolean }

const GAP = 52

export function Geoboard({ value, onChange, disabled = false, feedback = null, onMilestone, size }: ToolProps<GeoState> & { size: number }): ReactElement {
  const locked = disabled || feedback !== null
  const { pegs, closed } = value
  const info = useMemo(() => (closed ? analysePegs(pegs) : null), [closed, pegs])
  const W = (size - 1) * GAP + GAP
  const px = (n: number) => GAP / 2 + n * GAP
  const index = (x: number, y: number) => pegs.findIndex((p) => p[0] === x && p[1] === y)

  const tap = (x: number, y: number) => {
    if (locked || closed) return
    const at = index(x, y)
    if (at === 0 && pegs.length >= 3) {
      onChange({ pegs, closed: true })
      playSfx('whoosh')
      const shape = analysePegs(pegs)
      if (shape.ok) onMilestone?.('shape')
      return
    }
    if (at >= 0) return
    onChange({ pegs: [...pegs, [x, y]], closed: false })
  }
  const undo = () => {
    if (locked || pegs.length === 0) return
    if (closed) onChange({ pegs, closed: false })
    else onChange({ pegs: pegs.slice(0, -1), closed: false })
  }
  const clear = () => {
    if (locked) return
    onChange({ pegs: [], closed: false })
  }
  const onKey = (e: KeyboardEvent<SVGElement>, fn: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fn()
    }
  }

  const stroke = feedback === 'correct' ? 'stroke-success' : feedback === 'not-yet' ? 'stroke-warn' : 'stroke-math'
  const fill = feedback === 'correct' ? 'fill-success-50' : feedback === 'not-yet' ? 'fill-warn-50' : 'fill-math-50'
  const outline = pegs.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p[0])} ${px(p[1])}`).join(' ') + (closed ? ' Z' : '')

  const status = !info
    ? pegs.length === 0
      ? 'Tap a peg to start.'
      : pegs.length < 3
        ? `${pegs.length} peg${pegs.length === 1 ? '' : 's'} placed. Keep tapping pegs.`
        : 'Tap the first peg again to close the shape.'
    : info.ok
      ? `${info.sides} sides, perimeter ${formatLength(info.perimeter)}, area ${formatLength(info.area)} square units`
      : info.reason === 'cross'
        ? 'The sides cross each other. Tap Undo and try again.'
        : 'That shape is flat. Tap Undo and try again.'

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full justify-center overflow-x-auto rounded-card border border-divider bg-surface p-2">
        <svg viewBox={`0 0 ${W} ${W}`} width={W} height={W} role="group" aria-label={`Geoboard with ${size} by ${size} pegs`} className="h-auto max-w-full flex-none" style={{ touchAction: 'manipulation', minWidth: Math.min(W, 340) }}>
          {Array.from({ length: size - 1 }, (_, r) =>
            Array.from({ length: size - 1 }, (_, c) => <rect key={`${r}-${c}`} x={px(c)} y={px(r)} width={GAP} height={GAP} className="fill-transparent stroke-divider" strokeWidth={1} />),
          )}
          {pegs.length > 0 ? (
            <path
              d={outline}
              className={cx(stroke, closed ? fill : 'fill-transparent')}
              strokeWidth={5}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ transition: 'opacity 150ms' }}
            />
          ) : null}
          {Array.from({ length: size }, (_, y) =>
            Array.from({ length: size }, (_, x) => {
              const at = index(x, y)
              const used = at >= 0
              return (
                <g
                  key={`${x}-${y}`}
                  role="button"
                  tabIndex={locked || closed ? -1 : 0}
                  aria-label={`Peg column ${x + 1}, row ${y + 1}${used ? (at === 0 ? ', first peg' : `, peg ${at + 1}`) : ''}`}
                  onClick={() => tap(x, y)}
                  onKeyDown={(e) => onKey(e, () => tap(x, y))}
                  className={cx(!locked && !closed && 'cursor-pointer')}
                >
                  <circle cx={px(x)} cy={px(y)} r={GAP / 2 - 2} className="fill-transparent" />
                  <circle cx={px(x)} cy={px(y)} r={used ? 9 : 6} className={cx(used ? 'fill-fg' : 'fill-border', at === 0 && !closed && pegs.length >= 3 && 'kira-pulse')} style={{ transformBox: 'fill-box', transformOrigin: 'center', transition: 'transform 150ms' }} />
                </g>
              )
            }),
          )}
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-2" aria-live="polite">
        {[
          ['Sides', info?.ok ? String(info.sides) : '-'],
          ['Perimeter', info?.ok ? formatLength(info.perimeter) : '-'],
          ['Area', info?.ok ? formatLength(info.area) : '-'],
        ].map(([label, v]) => (
          <div key={label} className="flex flex-col items-center rounded-control border border-divider bg-surface py-2">
            <span className="text-small font-semibold text-fg-muted">{label}</span>
            <span className="font-display text-h2 font-semibold tabular-nums">{v}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="m-0 min-w-0 flex-1 text-body font-semibold">
          {status}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="M" icon="undo" disabled={locked || pegs.length === 0} onClick={undo}>
            Undo
          </Button>
          <Button variant="secondary" size="M" disabled={locked || pegs.length === 0} onClick={clear}>
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
}
