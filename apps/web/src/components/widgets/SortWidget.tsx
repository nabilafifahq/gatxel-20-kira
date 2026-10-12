'use client'

import { useState, type ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { SUBJECT_STYLE } from '@/components/learner/subject'
import { asGroups } from './answers'
import type { WidgetProps } from './types'

/**
 * Kelompokkan kartu tanpa seret: ketuk kartu, lalu ketuk kotak kelompoknya.
 * Kartu di dalam kotak bisa diketuk lagi untuk dipindah atau dikembalikan.
 * Nilai { groups: number[] }: untuk setiap kartu (indeks asli), nomor kelompok; -1 bila belum.
 */
export function SortWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement {
  const groupNames = item.sortGroups ?? []
  const cards = item.sortItems ?? []
  const n = cards.reduce((m, c) => Math.max(m, c.i + 1), 0)
  const groups = asGroups(value, n)
  const [picked, setPicked] = useState<number | null>(null)
  const style = SUBJECT_STYLE[subject]
  const locked = disabled || !!feedback
  const key = item.key?.type === 'sort' ? item.key.groupsOf : null

  const assign = (card: number, g: number) => {
    const next = groups.slice()
    next[card] = g
    setPicked(null)
    onChange(next.every((x) => x < 0) ? null : { groups: next })
  }

  const tapCard = (i: number) => {
    if (locked) return
    setPicked((p) => (p === i ? null : i))
  }

  const pickedText = picked === null ? '' : (cards.find((c) => c.i === picked)?.text ?? '')
  const unsorted = cards.filter((c) => (groups[c.i] ?? -1) < 0)

  const cardButton = (c: { i: number; text: string }) => {
    const isPicked = picked === c.i
    const ok = feedback && key ? key[c.i] === groups[c.i] : null
    return (
      <button
        key={c.i}
        type="button"
        disabled={locked}
        aria-pressed={isPicked}
        aria-label={`${c.text}${ok === true ? ', right group' : ok === false ? ', not yet' : ''}`}
        onClick={() => tapCard(c.i)}
        className={cx(
          'inline-flex min-h-14 items-center gap-2 rounded-control px-4 py-2 font-reading text-h3 font-bold text-fg transition-transform duration-150 ease-kira',
          ok === true
            ? 'border-3 border-success bg-success-50'
            : ok === false
              ? 'border-3 border-warn bg-surface'
              : isPicked
                ? cx('border-3', style.border, style.tint)
                : 'border-2 border-border bg-surface',
          !locked && 'cursor-pointer hover:border-fg active:scale-97',
        )}
      >
        {ok === true ? <UiIcon name="check" size={18} className="text-success" /> : ok === false ? <UiIcon name="not-yet" size={18} className="text-warn" /> : null}
        {c.text}
      </button>
    )
  }

  return (
    <div className="flex w-full flex-col gap-3" onKeyDown={(e) => e.key === 'Escape' && setPicked(null)}>
      <p className="m-0 text-body font-semibold text-fg-muted" aria-live="polite">
        {locked ? 'Your groups' : picked !== null ? `Picked: ${pickedText}. Now tap its group.` : 'Tap a card, then tap its group.'}
      </p>
      <section aria-label="Cards to sort" className="flex min-h-18 flex-wrap items-start gap-2.5 rounded-control border-2 border-dashed border-divider bg-bg p-3">
        {unsorted.length > 0 ? (
          unsorted.map(cardButton)
        ) : picked !== null && !locked ? (
          <button
            type="button"
            onClick={() => assign(picked, -1)}
            className="inline-flex h-14 cursor-pointer items-center gap-2 rounded-control border-2 border-border bg-surface px-4 text-body-lg font-bold"
          >
            <UiIcon name="undo" size={20} />
            Put it back here
          </button>
        ) : (
          <span className="self-center text-body text-fg-muted">All cards are in a group.</span>
        )}
      </section>
      <div className={cx('grid gap-3', groupNames.length >= 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2')}>
        {groupNames.map((name, g) => {
          const inside = cards.filter((c) => groups[c.i] === g)
          const target = picked !== null && groups[picked] !== g && !locked
          return (
            <div
              key={g}
              onClick={(e) => {
                if (target && picked !== null && e.target === e.currentTarget) assign(picked, g)
              }}
              className={cx(
                'flex min-h-36 flex-col gap-2.5 rounded-card border-2 p-3',
                target ? cx('border-dashed', style.border, style.tint) : 'border-border bg-surface',
              )}
            >
              <button
                type="button"
                disabled={locked || picked === null}
                onClick={() => picked !== null && assign(picked, g)}
                aria-label={picked !== null ? `Put ${pickedText} in ${name}` : `${name}, ${inside.length} cards`}
                className={cx(
                  'flex min-h-11 items-center justify-between gap-2 rounded-control px-2 text-left text-body-lg font-bold',
                  target ? 'cursor-pointer' : 'cursor-default',
                )}
              >
                <span>{name}</span>
                {target ? <UiIcon name="arrow-down" size={20} /> : <span className="text-body font-semibold text-fg-muted tabular-nums">{inside.length}</span>}
              </button>
              <div className="flex flex-wrap gap-2">{inside.map(cardButton)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
