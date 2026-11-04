'use client'

import type { ReactElement } from 'react'
import type { BarModelState } from '@kira/content/manip'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { playSfx } from '@/components/learner/sfx'
import type { ToolProps } from './types'

/**
 * Model batang untuk bagian-utuh dan perbandingan. Ketuk Add bar, pilih label, lalu tambah unit satu per satu.
 * Bila soal meminta nilai satu unit, atur dengan tombol plus dan minus. Nilai: { bars: { label, units }[], unit? }.
 */

export type BarModelConfig = {
  kind: 'partwhole' | 'compare'
  labels: string[]
  barCount: number
  maxUnits: number
  unit?: { max: number }
  unitName?: string
}

const TINT = ['bg-math', 'bg-science', 'bg-english', 'bg-mental'] as const
const SOFT = ['bg-math-50', 'bg-science-50', 'bg-english-50', 'bg-mental-50'] as const

function Stepper({ label, onDown, onUp, downDisabled, upDisabled }: { label: string; onDown(): void; onUp(): void; downDisabled: boolean; upDisabled: boolean }): ReactElement {
  const cls =
    'inline-flex h-14 w-14 cursor-pointer items-center justify-center rounded-control border-2 text-h2 font-bold transition-transform duration-150 ease-kira enabled:active:scale-95 disabled:cursor-not-allowed disabled:border-divider disabled:text-border'
  return (
    <span className="inline-flex gap-2">
      <button type="button" aria-label={`Fewer ${label}`} disabled={downDisabled} onClick={onDown} className={cx(cls, 'border-border bg-surface')}>
        −
      </button>
      <button type="button" aria-label={`More ${label}`} disabled={upDisabled} onClick={onUp} className={cx(cls, 'border-fg bg-surface')}>
        +
      </button>
    </span>
  )
}

export function BarModel({ value, onChange, disabled = false, feedback = null, config }: ToolProps<BarModelState> & { config: BarModelConfig }): ReactElement {
  const locked = disabled || feedback !== null
  const { bars } = value
  const used = new Set(bars.map((b) => b.label))
  const setBars = (next: BarModelState['bars']) => onChange({ ...value, bars: next })
  const totalUnits = bars.reduce((n, b) => n + b.units, 0)
  const ring = feedback === 'correct' ? 'border-success' : feedback === 'not-yet' ? 'border-warn' : 'border-fg'
  const unitNow = value.unit ?? 0
  // Batang diukur terhadap yang terpanjang supaya perbandingannya jelas.
  const longest = Math.max(4, ...bars.map((b) => b.units))

  const addBar = () => {
    if (locked || bars.length >= config.barCount) return
    playSfx('whoosh')
    setBars([...bars, { label: '', units: 1 }])
  }
  const setLabel = (i: number, label: string) => setBars(bars.map((b, k) => (k === i ? { ...b, label } : b)))
  const setUnits = (i: number, units: number) => setBars(bars.map((b, k) => (k === i ? { ...b, units: Math.max(0, Math.min(config.maxUnits, units)) } : b)))
  const remove = (i: number) => setBars(bars.filter((_, k) => k !== i))
  const setUnit = (n: number) => onChange({ ...value, unit: Math.max(0, Math.min(config.unit?.max ?? 100, n)) })

  const segments = (b: BarModelState['bars'][number], i: number) =>
    b.units === 0 ? (
      <span className={cx('w-full', SOFT[i % SOFT.length])} />
    ) : (
      Array.from({ length: b.units }, (_, k) => <span key={k} aria-hidden="true" className={cx('kira-pop h-full min-w-0 flex-1 border-l-2 border-fg first:border-l-0', TINT[i % TINT.length])} />)
    )

  return (
    <div className="flex w-full flex-col gap-4">
      <div
        role="img"
        aria-label={bars.length === 0 ? 'No bars yet' : bars.map((b) => `${b.label || 'Unnamed bar'}: ${b.units} units`).join('; ')}
        className="flex min-h-24 flex-col gap-2 rounded-card border border-divider bg-surface p-3"
      >
        {bars.length === 0 ? <p className="m-0 self-center py-6 text-body text-fg-muted">Tap Add bar to start your model.</p> : null}
        {config.kind === 'partwhole' && bars.length > 0 ? (
          <>
            <p className="m-0 w-full border-x-2 border-b-2 border-fg pb-1 text-center text-body font-bold">
              {totalUnits} unit{totalUnits === 1 ? '' : 's'}
              {config.unit ? ` = ${totalUnits * unitNow}${config.unitName ? ` ${config.unitName}` : ''}` : ''}
            </p>
            <div className={cx('flex h-14 w-full overflow-hidden rounded-control border-3', ring)}>
              {bars.map((b, i) => (
                <div key={i} className="flex h-full min-w-0 items-stretch border-l-2 border-fg first:border-l-0" style={{ flex: Math.max(b.units, 0.4) }}>
                  {segments(b, i)}
                </div>
              ))}
            </div>
            <div className="flex w-full">
              {bars.map((b, i) => (
                <span key={i} className="min-w-0 truncate text-center text-small font-bold" style={{ flex: Math.max(b.units, 0.4) }}>
                  {b.label || '?'}
                </span>
              ))}
            </div>
          </>
        ) : (
          bars.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-24 flex-none truncate text-small font-bold md:w-32 md:text-body">{b.label || '?'}</span>
              <div className="relative h-12 flex-1">
                <div className={cx('flex h-full overflow-hidden rounded-control border-3 transition-[width] duration-150 ease-kira', ring)} style={{ width: `${(Math.max(b.units, 1) / longest) * 100}%` }}>
                  {segments(b, i)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {bars.map((b, i) => (
          <li key={i} className="kira-rise flex flex-col gap-2 rounded-card border border-divider bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="m-0 text-body font-bold">Bar {i + 1}</h3>
              <Button variant="quiet" size="M" disabled={locked} onClick={() => remove(i)} aria-label={`Remove bar ${i + 1}`}>
                Remove
              </Button>
            </div>
            <div role="radiogroup" aria-label={`Label for bar ${i + 1}`} className="flex flex-wrap gap-1.5">
              {config.labels.map((l) => {
                const taken = used.has(l) && b.label !== l
                return (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={b.label === l}
                    disabled={locked || taken}
                    onClick={() => setLabel(i, l)}
                    className={cx(
                      'inline-flex min-h-11 cursor-pointer items-center rounded-control border-2 px-3 text-body font-bold transition-transform duration-150 ease-kira enabled:active:scale-95 disabled:cursor-not-allowed disabled:border-divider disabled:text-border',
                      b.label === l ? 'border-fg bg-fg text-white' : 'border-border bg-surface text-fg',
                    )}
                  >
                    {l}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between gap-3">
              <output aria-live="polite" className="text-body-lg font-bold tabular-nums">
                {b.units} unit{b.units === 1 ? '' : 's'}
              </output>
              <Stepper label={`units in bar ${i + 1}`} downDisabled={locked || b.units <= 0} upDisabled={locked || b.units >= config.maxUnits} onDown={() => setUnits(i, b.units - 1)} onUp={() => setUnits(i, b.units + 1)} />
            </div>
          </li>
        ))}
      </ul>

      {bars.length < config.barCount ? (
        <Button variant="secondary" icon="plus" disabled={locked} onClick={addBar} className="self-start">
          Add bar
        </Button>
      ) : null}

      {config.unit ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-divider bg-surface p-3">
          <output aria-live="polite" className="text-body-lg font-bold tabular-nums">
            1 unit = {unitNow}
            {config.unitName ? ` ${config.unitName}` : ''}
          </output>
          <span className="inline-flex flex-wrap gap-2">
            {config.unit.max > 20 ? <Stepper label="value by 10" downDisabled={locked || unitNow < 10} upDisabled={locked || unitNow + 10 > config.unit.max} onDown={() => setUnit(unitNow - 10)} onUp={() => setUnit(unitNow + 10)} /> : null}
            <Stepper label="value by 1" downDisabled={locked || unitNow <= 0} upDisabled={locked || unitNow >= config.unit.max} onDown={() => setUnit(unitNow - 1)} onUp={() => setUnit(unitNow + 1)} />
          </span>
        </div>
      ) : null}
    </div>
  )
}
