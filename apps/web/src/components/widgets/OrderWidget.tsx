'use client'

import { useState, type ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { SUBJECT_STYLE } from '@/components/learner/subject'
import { asOrder } from './answers'
import type { WidgetProps } from './types'

/**
 * Urutkan kartu (papan RunnerUrutkan) tanpa seret: ketuk kartu, lalu ketuk tempatnya.
 * Kartu di tempat bisa diketuk untuk dipindah ke tempat lain atau dikembalikan.
 * Nilai { order: number[] } berisi indeks asli kartu per tempat; -1 untuk tempat kosong.
 */

const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

type Picked = { from: 'pool'; card: number } | { from: 'slot'; slot: number } | null

export function OrderWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement {
  const cards = item.orderItems ?? []
  const n = cards.length
  const raw = asOrder(value)
  const slots = Array.from({ length: n }, (_, k) => (typeof raw[k] === 'number' ? (raw[k] as number) : -1))
  const [picked, setPicked] = useState<Picked>(null)
  const style = SUBJECT_STYLE[subject]
  const locked = disabled || !!feedback
  const long = cards.some((c) => c.text.length > 8)
  const textOf = (i: number) => cards.find((c) => c.i === i)?.text ?? ''

  const commit = (next: number[]) => {
    setPicked(null)
    onChange(next.every((x) => x < 0) ? null : { order: next })
  }

  const tapPool = (i: number) => {
    if (locked) return
    if (picked?.from === 'pool' && picked.card === i) setPicked(null)
    else setPicked({ from: 'pool', card: i })
  }

  const tapSlot = (k: number) => {
    if (locked) return
    const next = slots.slice()
    if (picked?.from === 'pool') {
      next[k] = picked.card
      commit(next)
      return
    }
    if (picked?.from === 'slot') {
      if (picked.slot === k) {
        setPicked(null)
        return
      }
      const a = next[picked.slot] ?? -1
      next[picked.slot] = next[k] ?? -1
      next[k] = a
      commit(next)
      return
    }
    if ((slots[k] ?? -1) >= 0) setPicked({ from: 'slot', slot: k })
  }

  const putBack = () => {
    if (picked?.from !== 'slot') return
    const next = slots.slice()
    next[picked.slot] = -1
    commit(next)
  }

  const pickedText = picked ? (picked.from === 'pool' ? textOf(picked.card) : textOf(slots[picked.slot] ?? -1)) : ''
  const cardText = long ? 'font-reading text-h3 font-bold' : 'font-reading text-h1 font-bold'
  const cardBox = long ? 'min-h-16 px-4 py-2 text-left justify-start' : 'h-[88px] max-md:h-18 justify-center'

  return (
    <div
      className="flex w-full flex-col gap-3"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && picked) {
          e.stopPropagation()
          setPicked(null)
        }
      }}
    >
      <p className="m-0 text-body font-semibold text-fg-muted" aria-live="polite">
        {locked ? 'Your order' : picked ? `Picked: ${pickedText}. Now tap its place.` : 'Tap a card, then tap its place.'}
      </p>
      <ol aria-label="Your order" className={cx('m-0 grid list-none gap-3 p-0', long ? 'grid-cols-1' : n <= 4 ? 'grid-cols-4' : 'grid-cols-4 lg:grid-cols-5')}>
        {slots.map((card, k) => {
          const filled = card >= 0
          const ok = feedback ? card === k : null
          const isPicked = picked?.from === 'slot' && picked.slot === k
          const target = !!picked && !isPicked
          return (
            <li key={k} className={cx('flex gap-1.5', long ? 'flex-row items-center gap-3' : 'flex-col items-center')}>
              {long ? <span className="w-10 flex-none text-body font-semibold text-fg-muted">{ORD[k] ?? k + 1}</span> : null}
              <button
                type="button"
                disabled={locked}
                onClick={() => tapSlot(k)}
                aria-pressed={isPicked || undefined}
                aria-label={
                  filled
                    ? `${ORD[k] ?? k + 1}, ${textOf(card)}${ok === true ? ', right place' : ok === false ? ', not yet' : ''}`
                    : `${ORD[k] ?? k + 1}, empty${target ? '. Tap to put the card here' : ''}`
                }
                className={cx(
                  'flex w-full items-center rounded-control p-0 text-fg transition-transform duration-150 ease-kira',
                  cardBox,
                  filled
                    ? ok === true
                      ? 'border-3 border-success bg-success-50'
                      : ok === false
                        ? 'border-3 border-warn bg-surface'
                        : isPicked
                          ? cx('border-3 border-fg', style.tint)
                          : cx('border-3', style.border, style.tint)
                    : target
                      ? cx('border-3 border-dashed bg-surface', style.border)
                      : 'border-2 border-dashed border-border bg-surface',
                  !locked && 'cursor-pointer active:scale-97',
                )}
              >
                {filled ? <span className={cardText}>{textOf(card)}</span> : null}
              </button>
              {long ? null : <span className="text-body font-semibold text-fg-muted">{ORD[k] ?? k + 1}</span>}
            </li>
          )
        })}
      </ol>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-body font-semibold text-fg-muted">Cards</span>
        {picked?.from === 'slot' && !locked ? (
          <button
            type="button"
            onClick={putBack}
            className="ml-auto inline-flex h-11 cursor-pointer items-center gap-2 rounded-control border-2 border-border bg-surface px-3 text-body font-bold hover:border-fg"
          >
            <UiIcon name="undo" size={20} />
            Put it back
          </button>
        ) : null}
      </div>
      <div className={cx('grid gap-3', long ? 'grid-cols-1' : n <= 4 ? 'grid-cols-4' : 'grid-cols-4 lg:grid-cols-5')}>
        {cards.map((c) => {
          const used = slots.includes(c.i)
          const isPicked = picked?.from === 'pool' && picked.card === c.i
          if (used) {
            return <div key={c.i} aria-hidden="true" className={cx('rounded-control border-2 border-dashed border-divider bg-bg', long ? 'min-h-16' : 'h-[88px] max-md:h-18')} />
          }
          return (
            <button
              key={c.i}
              type="button"
              disabled={locked}
              aria-pressed={isPicked}
              aria-label={`Card ${c.text}`}
              onClick={() => tapPool(c.i)}
              className={cx(
                'flex w-full items-center rounded-control p-0 text-fg transition-transform duration-150 ease-kira',
                cardBox,
                isPicked ? cx('border-3', style.border, style.tint) : 'border-2 border-border bg-surface',
                locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-fg active:scale-97',
              )}
            >
              <span className={cardText}>{c.text}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
