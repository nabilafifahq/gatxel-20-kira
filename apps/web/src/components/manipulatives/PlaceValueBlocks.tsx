'use client'

import type { ReactElement } from 'react'
import { BLOCK_MAX, blocksValue, exchangeDown, exchangeUp, type Blocks } from '@kira/content/manip'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { playSfx } from '@/components/learner/sfx'
import type { ToolProps } from './types'

/**
 * Balok nilai tempat: ratusan (lempeng), puluhan (batang), satuan (kubus). Ketuk tombol tambah atau
 * kurang, tukar 10 satuan menjadi 1 puluhan, atau pecah 1 puluhan menjadi 10 satuan. Nilai { h, t, o }.
 */

type Place = 'h' | 't' | 'o'
const PLACE_NAME: Record<Place, { one: string; many: string; head: string }> = {
  h: { one: 'hundred', many: 'hundreds', head: 'Hundreds' },
  t: { one: 'ten', many: 'tens', head: 'Tens' },
  o: { one: 'one', many: 'ones', head: 'Ones' },
}

function Flat(): ReactElement {
  return (
    <span aria-hidden="true" className="kira-pop block h-14 w-14 flex-none rounded-control border-2 border-fg bg-knowledge-50 p-0.5">
      <span className="grid h-full w-full grid-cols-5 grid-rows-5 gap-px">
        {Array.from({ length: 25 }, (_, i) => (
          <span key={i} className="rounded-[1px] bg-knowledge" />
        ))}
      </span>
    </span>
  )
}

function Rod(): ReactElement {
  return (
    <span aria-hidden="true" className="kira-pop flex h-14 w-3.5 flex-none flex-col gap-px rounded-[3px] border-2 border-fg bg-math-50 p-px">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="flex-1 rounded-[1px] bg-math" />
      ))}
    </span>
  )
}

function Cube(): ReactElement {
  return <span aria-hidden="true" className="kira-pop block h-5 w-5 flex-none rounded-[4px] border-2 border-fg bg-star" />
}

const SHAPE: Record<Place, () => ReactElement> = { h: Flat, t: Rod, o: Cube }

export function PlaceValueBlocks({ value, onChange, disabled = false, feedback = null, onMilestone, places = 'hto' }: ToolProps<Blocks> & { places?: 'to' | 'hto' }): ReactElement {
  const locked = disabled || feedback !== null
  const cols: Place[] = places === 'to' ? ['t', 'o'] : ['h', 't', 'o']
  const total = blocksValue(value)

  const set = (b: Blocks, sound: 'tap' | 'whoosh' = 'tap', milestone?: 'trade') => {
    if (sound === 'whoosh') playSfx('whoosh')
    onChange(b)
    if (milestone) onMilestone?.(milestone)
  }
  const add = (p: Place) => {
    if (locked || value[p] >= BLOCK_MAX) return
    set({ ...value, [p]: value[p] + 1 })
  }
  const take = (p: Place) => {
    if (locked || value[p] <= 0) return
    set({ ...value, [p]: value[p] - 1 })
  }

  const edge = feedback === 'correct' ? 'border-success' : feedback === 'not-yet' ? 'border-warn' : 'border-divider'
  const sentence = cols
    .map((p) => `${value[p]} ${value[p] === 1 ? PLACE_NAME[p].one : PLACE_NAME[p].many}`)
    .join(', ')

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
        {cols.map((p) => {
          const Shape = SHAPE[p]
          const n = value[p]
          const canUp = p !== 'h' && n >= 10 && !(p === 't' && places === 'to')
          const canDown = p !== 'o' && n >= 1 && value[p === 'h' ? 't' : 'o'] + 10 <= BLOCK_MAX
          const next = p === 'o' ? 'ten' : 'hundred'
          const lower = p === 'h' ? 'tens' : 'ones'
          return (
            <section key={p} aria-label={PLACE_NAME[p].head} className={cx('flex min-w-0 flex-col gap-2 rounded-card border-2 bg-surface p-3', edge)}>
              <h3 className="m-0 flex items-baseline justify-between text-body font-bold">
                {PLACE_NAME[p].head}
                <span className="font-display text-h2 tabular-nums">{n}</span>
              </h3>
              <div className={cx('flex min-h-[72px] flex-wrap content-start items-end gap-1.5', p === 'o' && 'gap-1')}>
                {Array.from({ length: n }, (_, i) => (
                  <Shape key={i} />
                ))}
              </div>
              <div className="mt-auto flex gap-2">
                <button
                  type="button"
                  aria-label={`Add one ${PLACE_NAME[p].one}`}
                  disabled={locked || n >= BLOCK_MAX}
                  onClick={() => add(p)}
                  className="inline-flex h-14 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-control border-2 border-fg bg-surface text-h2 font-bold transition-transform duration-150 ease-kira enabled:active:scale-95 disabled:cursor-not-allowed disabled:border-divider disabled:text-border"
                >
                  +
                </button>
                <button
                  type="button"
                  aria-label={`Take away one ${PLACE_NAME[p].one}`}
                  disabled={locked || n <= 0}
                  onClick={() => take(p)}
                  className="inline-flex h-14 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-control border-2 border-border bg-surface text-h2 font-bold transition-transform duration-150 ease-kira enabled:active:scale-95 disabled:cursor-not-allowed disabled:border-divider disabled:text-border"
                >
                  −
                </button>
              </div>
              {p !== 'h' ? (
                <Button variant={canUp ? 'primary' : 'secondary'} size="M" disabled={locked || !canUp} className={cx('w-full', canUp && !locked && 'kira-pulse')} onClick={() => set(exchangeUp(value, p), 'whoosh', 'trade')}>
                  Trade 10 for 1 {next}
                </Button>
              ) : null}
              {p !== 'o' ? (
                <Button variant="secondary" size="M" disabled={locked || !canDown} className="w-full" onClick={() => set(exchangeDown(value, p), 'whoosh', 'trade')}>
                  Break 1 into 10 {lower}
                </Button>
              ) : null}
            </section>
          )
        })}
      </div>
      <div className="flex items-center justify-between gap-3">
        <output aria-live="polite" className="text-body-lg font-bold tabular-nums">
          {total} is {sentence}
        </output>
        <Button variant="secondary" size="M" disabled={locked || total === 0} onClick={() => set({ h: 0, t: 0, o: 0 })}>
          Clear
        </Button>
      </div>
    </div>
  )
}
