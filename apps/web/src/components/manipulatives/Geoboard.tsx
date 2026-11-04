'use client'

import { useMemo, type KeyboardEvent, type ReactElement } from 'react'
import { analysePegs, formatLength, type Peg } from '@kira/content/manip'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { playSfx } from '@/components/learner/sfx'
import { useT } from '@/lib/i18n/client'
import type { ToolProps } from './types'

/**
 * Geoboard: ketuk pasak untuk menaruh titik sudut satu per satu. Ketuk pasak pertama lagi untuk menutup bentuk.
 * Sisi, keliling, dan luas dihitung langsung dari kotak satuan di papan. Nilai: { pegs, closed }.
 */

export type GeoState = { pegs: Peg[]; closed: boolean }

const GAP = 52

export function Geoboard({ value, onChange, disabled = false, feedback = null, onMilestone, size }: ToolProps<GeoState> & { size: number }): ReactElement {
  const t = useT()
  const len = (x: number) => t.widgets.geoboard.length(formatLength(x))
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
      ? t.widgets.geoboard.tapToStart
      : pegs.length < 3
        ? t.widgets.geoboard.pegsPlaced(pegs.length)
        : t.widgets.geoboard.closeShape
    : info.ok
      ? t.widgets.geoboard.summary(info.sides, len(info.perimeter), len(info.area))
      : info.reason === 'cross'
        ? t.widgets.geoboard.cross
        : t.widgets.geoboard.flat

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full justify-center overflow-x-auto rounded-card border border-divider bg-surface p-2">
        <svg viewBox={`0 0 ${W} ${W}`} width={W} height={W} role="group" aria-label={t.widgets.geoboard.boardAria(size)} className="h-auto max-w-full flex-none" style={{ touchAction: 'manipulation', minWidth: Math.min(W, 340) }}>
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
                  aria-label={`${t.widgets.geoboard.pegAria(x + 1, y + 1)}${used ? (at === 0 ? t.widgets.geoboard.ariaFirstPeg : t.widgets.geoboard.ariaPegN(at + 1)) : ''}`}
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
          [t.widgets.geoboard.sides, info?.ok ? String(info.sides) : '-'],
          [t.widgets.geoboard.perimeter, info?.ok ? len(info.perimeter) : '-'],
          [t.widgets.geoboard.area, info?.ok ? len(info.area) : '-'],
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
            {t.widgets.shared.undo}
          </Button>
          <Button variant="secondary" size="M" disabled={locked || pegs.length === 0} onClick={clear}>
            {t.widgets.shared.clear}
          </Button>
        </div>
      </div>
    </div>
  )
}
