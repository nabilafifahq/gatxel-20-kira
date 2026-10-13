'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { SUBJECT_STYLE } from '@/components/learner/subject'
import { asCells } from './answers'
import type { WidgetProps } from './types'

/**
 * Teka-teki kotak (persegi ajaib, sudoku 4x4, persegi latin): ketuk sel kosong, lalu ketuk angka di papan.
 * Sel awal terkunci. Nilai { cells: number[] }, datar baris demi baris, 0 untuk sel kosong; bernilai null bila
 * anak belum mengisi apa pun. Setelah diperiksa, sel yang keliru diberi tanda Not yet.
 */
export function GridWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement | null {
  const style = SUBJECT_STYLE[subject]
  const grid = item.grid
  const [active, setActive] = useState<number | null>(null)
  const cellsRef = useRef<number[]>([])
  const n = (grid?.size ?? 0) ** 2
  const given0 = grid?.given ?? []
  // Sel awal selalu ikut di jawaban, supaya server bisa memeriksa kotak yang utuh.
  const cells = asCells(value, n).map((c, i) => (given0[i] ? given0[i]! : c))
  const locked = disabled || !!feedback
  const solution = item.key?.type === 'grid' ? item.key.solution : null
  const isGiven = (i: number) => (given0[i] ?? 0) !== 0

  useEffect(() => {
    cellsRef.current = cells
  })

  // Sel kosong pertama jadi sel aktif.
  useEffect(() => {
    if (!grid || locked) return
    setActive((a) => (a !== null ? a : (grid.given.findIndex((g) => g === 0) >= 0 ? grid.given.findIndex((g) => g === 0) : null)))
  }, [grid, locked])

  if (!grid) return null
  const size = grid.size

  const write = (i: number, v: number) => {
    if (locked || isGiven(i)) return
    const next = cellsRef.current.slice()
    next[i] = v
    const touched = next.some((c, k) => c !== 0 && !isGiven(k))
    cellsRef.current = next
    onChange(touched ? { cells: next } : null)
  }

  const put = (v: number) => {
    if (active !== null) write(active, v)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (locked || e.ctrlKey || e.metaKey || e.altKey) return
    if (/^[0-9]$/.test(e.key) && grid.values.includes(Number(e.key))) {
      e.preventDefault()
      put(Number(e.key))
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      put(0)
    }
  }

  const boxBorder = (r: number, c: number): string => {
    if (grid.puzzle !== 'sudoku') return ''
    return cx(c === 1 && 'border-r-4 border-r-fg', r === 1 && 'border-b-4 border-b-fg')
  }

  return (
    <div className="flex w-full flex-col items-center gap-4" onKeyDown={onKeyDown}>
      <p className="m-0 self-start text-body font-semibold text-fg-muted" aria-live="polite">
        {locked ? 'Your puzzle' : 'Tap an empty box, then tap a number.'}
      </p>
      <div role="group" aria-label="Puzzle grid" className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${size}, 56px)` }}>
        {cells.slice(0, n).map((v, i) => {
          const r = Math.floor(i / size)
          const c = i % size
          const given = isGiven(i)
          const isActive = active === i && !locked
          const wrong = feedback && !given && solution ? v !== solution[i] : false
          const right = feedback && !given && solution ? v === solution[i] : false
          const common = cx(
            'flex h-14 w-14 items-center justify-center rounded-control border-2 font-reading text-h2 font-bold tabular-nums',
            boxBorder(r, c),
          )
          const name = `Row ${r + 1}, column ${c + 1}`
          if (given) {
            return (
              <div key={i} role="img" aria-label={`${name}: ${grid.given[i]}, given`} className={cx(common, 'border-divider bg-bg')}>
                {grid.given[i]}
              </div>
            )
          }
          return (
            <button
              key={i}
              type="button"
              disabled={locked}
              aria-label={`${name}: ${v === 0 ? 'empty' : v}${wrong ? ', not yet' : right ? ', right' : ''}`}
              aria-pressed={isActive}
              onClick={() => setActive(i)}
              className={cx(
                common,
                wrong ? 'border-3 border-warn bg-surface' : right ? 'border-success bg-success-50' : isActive ? cx('border-3', style.border, style.tint) : locked ? 'border-divider bg-surface' : 'border-border bg-surface',
                !locked && 'cursor-pointer hover:border-fg active:scale-97',
              )}
            >
              {v === 0 ? '' : v}
              {wrong ? <UiIcon name="not-yet" size={14} className="ml-0.5 text-warn" /> : null}
            </button>
          )
        })}
      </div>
      {!locked ? (
        <div role="group" aria-label="Numbers" className="flex max-w-[420px] flex-wrap justify-center gap-1.5">
          {grid.values.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => put(v)}
              className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-control border-2 border-border bg-surface font-reading text-h2 font-bold tabular-nums hover:border-fg active:scale-97"
            >
              {v}
            </button>
          ))}
          <button
            type="button"
            aria-label="Erase"
            onClick={() => put(0)}
            className="flex h-14 min-w-14 cursor-pointer items-center justify-center gap-1 rounded-control border-2 border-border bg-surface px-3 text-body-lg font-bold hover:border-fg active:scale-97"
          >
            <UiIcon name="eraser" size={22} />
            Erase
          </button>
        </div>
      ) : null}
    </div>
  )
}
