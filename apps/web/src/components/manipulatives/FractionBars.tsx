'use client'

import type { CSSProperties, ReactElement } from 'react'
import { compareFractions, DEFAULT_SPLITS, type BarState } from '@kira/content/manip'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { playSfx } from '@/components/learner/sfx'
import type { Dict } from '@/lib/i18n'
import { useT } from '@/lib/i18n/client'
import type { ToolProps } from './types'

/**
 * Batang pecahan: pilih berapa bagian sama besar, lalu ketuk bagian untuk mengarsir dari kiri.
 * Batang bertumpuk dengan lebar sama, jadi pecahan yang senilai terlihat sejajar. Nilai: BarState[].
 */

export type FractionRowConfig = { den?: number; locked?: number }

const TINT = ['bg-math', 'bg-science', 'bg-english'] as const

function relationText(a: BarState, b: BarState, t: Dict['widgets']['fractionBars']): string {
  const c = compareFractions(a.shaded, a.den, b.shaded, b.den)
  const fa = `${a.shaded}/${a.den}`
  const fb = `${b.shaded}/${b.den}`
  return c === 0 ? t.equal(fa, fb) : c < 0 ? t.less(fa, fb) : t.more(fa, fb)
}

export function initialBars(rows: FractionRowConfig[], splits: readonly number[], startSplit?: number): BarState[] {
  return rows.map((r) => ({ den: r.den ?? startSplit ?? splits[0] ?? 2, shaded: r.locked ?? 0 }))
}

export function FractionBars({
  value,
  onChange,
  disabled = false,
  feedback = null,
  onMilestone,
  rows,
  splits = DEFAULT_SPLITS,
  showCompare = false,
}: ToolProps<BarState[]> & { rows: FractionRowConfig[]; splits?: readonly number[]; showCompare?: boolean }): ReactElement {
  const t = useT()
  const locked = disabled || feedback !== null
  const bars = value.length === rows.length ? value : initialBars(rows, splits)

  const update = (i: number, next: BarState) => {
    onChange(bars.map((b, k) => (k === i ? next : b)))
  }
  const shadeTo = (i: number, k: number) => {
    const bar = bars[i]!
    update(i, { ...bar, shaded: bar.shaded === k + 1 ? k : k + 1 })
    onMilestone?.('bar')
  }
  const split = (i: number, den: number) => {
    playSfx('whoosh')
    update(i, { den, shaded: 0 })
  }

  const ring = feedback === 'correct' ? 'border-success' : feedback === 'not-yet' ? 'border-warn' : 'border-fg'

  return (
    <div className="flex w-full flex-col gap-4">
      {rows.map((row, i) => {
        const bar = bars[i]!
        const fixedShade = row.locked !== undefined
        const rowLocked = locked || fixedShade
        return (
          <section key={i} aria-label={t.widgets.barModel.bar(i + 1)} className="flex flex-col gap-2 rounded-card border border-divider bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="m-0 inline-flex items-center gap-1.5 text-body font-bold">
                {t.widgets.barModel.bar(i + 1)}
                {fixedShade ? (
                  <span className="inline-flex items-center gap-1 text-small font-semibold text-fg-muted">
                    <UiIcon name="lock" size={14} />
                    {t.widgets.fractionBars.alreadyShaded}
                  </span>
                ) : null}
              </h3>
              <output aria-live="polite" className="font-display text-h2 font-semibold tabular-nums">
                {bar.shaded}/{bar.den}
              </output>
            </div>
            {row.den === undefined ? (
              <div role="radiogroup" aria-label={t.widgets.fractionBars.cutBarAria(i + 1)} className="flex flex-wrap items-center gap-1.5">
                <span className="text-small font-semibold text-fg-muted">{t.widgets.fractionBars.cutInto}</span>
                {splits.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={bar.den === s}
                    disabled={locked}
                    onClick={() => split(i, s)}
                    className={cx(
                      'inline-flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-control border-2 px-2 text-body font-bold transition-transform duration-150 ease-kira enabled:active:scale-95 disabled:cursor-not-allowed',
                      bar.den === s ? 'border-fg bg-fg text-white' : 'border-border bg-surface text-fg enabled:hover:border-fg',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
            <div role="group" aria-label={t.widgets.fractionBars.barCutAria(i + 1, bar.den)} style={{ '--den': bar.den, '--cols': bar.den >= 8 ? Math.ceil(bar.den / 2) : bar.den } as CSSProperties} className={cx('grid w-full gap-0.5 overflow-hidden rounded-control border-3 bg-fg [grid-template-columns:repeat(var(--cols),minmax(0,1fr))] sm:[grid-template-columns:repeat(var(--den),minmax(0,1fr))]', ring)}>
              {Array.from({ length: bar.den }, (_, k) => {
                const on = k < bar.shaded
                return (
                  <button
                    key={`${bar.den}-${k}`}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${t.widgets.shared.part(k + 1, bar.den)}${on ? t.widgets.shared.ariaShaded : ''}`}
                    disabled={rowLocked}
                    onClick={() => shadeTo(i, k)}
                    className={cx(
                      'relative min-h-16 min-w-0 cursor-pointer border-0 p-0 disabled:cursor-default',
                      on ? (feedback === 'correct' ? 'bg-success' : feedback === 'not-yet' ? 'bg-warn' : TINT[i % TINT.length]) : 'bg-surface enabled:hover:bg-bg',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cx('absolute inset-0 origin-bottom bg-white/20 transition-[transform,opacity] duration-150 ease-kira', on ? 'scale-y-100 opacity-100' : 'scale-y-50 opacity-0')}
                    />
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
      {showCompare && bars.length >= 2 ? (
        <p role="status" className="m-0 rounded-control bg-bg px-4 py-2.5 text-body-lg font-bold">
          {relationText(bars[0]!, bars[1]!, t.widgets.fractionBars)}
        </p>
      ) : null}
    </div>
  )
}
