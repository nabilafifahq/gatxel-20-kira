'use client'

import { useState, type ReactElement } from 'react'
import { normaliseText } from '@kira/content/check'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { SUBJECT_STYLE } from '@/components/learner/subject'
import { asTexts } from './answers'
import { FigureStage, pinStyle } from './FigureStage'
import type { WidgetProps } from './types'

/**
 * Beri label diagram tanpa seret: ketuk label, lalu ketuk titik bernomor di gambar atau baris di bawahnya.
 * Ketuk titik yang sudah berisi tanpa memilih label untuk mengembalikan labelnya. Label pengecoh tidak
 * punya titik. Nilai { texts: string[] }, label di tiap titik (urut titik), kosong bila belum.
 */
export function LabelWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement | null {
  const style = SUBJECT_STYLE[subject]
  const diagram = item.labelDiagram
  const figure = item.figure
  const [picked, setPicked] = useState<string | null>(null)
  if (!diagram || !figure) return null
  const spots = diagram.spots
  const placed = asTexts(value, spots.length)
  const bank = diagram.labels.filter((l) => !placed.includes(l))
  const locked = disabled || !!feedback
  const key = item.key?.type === 'label' ? item.key.labels : null

  const write = (next: string[]) => onChange(next.every((t) => t === '') ? null : { texts: next })

  const tapSpot = (s: number) => {
    if (locked) return
    const next = placed.slice()
    if (picked !== null) {
      next[s] = picked
      setPicked(null)
    } else {
      next[s] = ''
    }
    write(next)
  }

  const stateOf = (s: number): 'correct' | 'not-yet' | null => {
    if (!feedback || !key) return null
    return normaliseText(placed[s] ?? '', false) === normaliseText(key[s] ?? '', false) ? 'correct' : 'not-yet'
  }

  return (
    <div className="flex w-full flex-col gap-3.5" onKeyDown={(e) => e.key === 'Escape' && setPicked(null)}>
      <p className="m-0 text-body font-semibold text-fg-muted" aria-live="polite">
        {locked ? 'Your labels' : picked !== null ? `Picked: ${picked}. Now tap its number.` : 'Tap a label, then tap its place.'}
      </p>
      <FigureStage spec={figure}>
        <div role="group" aria-label="Places to label">
          {spots.map((sp, s) => {
            const label = placed[s] ?? ''
            const st = stateOf(s)
            const target = picked !== null && !locked
            return (
              <button
                key={s}
                type="button"
                disabled={locked}
                aria-label={label !== '' ? `Place ${s + 1}: ${label}${st === 'correct' ? ', right' : st === 'not-yet' ? ', not yet' : ''}` : `Place ${s + 1}, empty`}
                onClick={() => tapSpot(s)}
                style={pinStyle(sp.x, sp.y)}
                className={cx(
                  'absolute flex items-center justify-center rounded-pill border-3 font-bold tabular-nums transition-transform duration-150 ease-kira',
                  st === 'correct'
                    ? 'border-success bg-success-50 text-fg'
                    : st === 'not-yet'
                      ? 'border-warn bg-surface text-fg'
                      : label !== ''
                        ? cx(style.border, style.solid, 'text-white')
                        : target
                          ? cx('border-dashed bg-surface text-fg', style.border)
                          : 'border-fg bg-surface text-fg',
                  !locked && 'cursor-pointer active:scale-97',
                )}
              >
                <span className="text-body-lg">{s + 1}</span>
              </button>
            )
          })}
        </div>
      </FigureStage>
      <ol className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
        {spots.map((_, s) => {
          const label = placed[s] ?? ''
          const st = stateOf(s)
          return (
            <li key={s}>
              <button
                type="button"
                disabled={locked}
                onClick={() => tapSpot(s)}
                aria-label={label !== '' ? `Place ${s + 1}: ${label}` : `Place ${s + 1}, empty`}
                className={cx(
                  'flex min-h-14 w-full items-center gap-3 rounded-control border-2 px-3 text-left font-reading text-h3',
                  st === 'correct' ? 'border-3 border-success bg-success-50' : st === 'not-yet' ? 'border-3 border-warn bg-surface' : picked !== null && !locked ? cx('border-dashed bg-surface', style.border) : 'border-border bg-surface',
                  !locked && 'cursor-pointer hover:border-fg',
                )}
              >
                <span aria-hidden="true" className={cx('inline-flex h-8 w-8 flex-none items-center justify-center rounded-pill text-body font-bold', label !== '' ? cx(style.solid, 'text-white') : 'border-2 border-border text-fg')}>
                  {s + 1}
                </span>
                <span className={cx('min-w-0 flex-1 font-bold', label === '' && 'font-normal text-fg-muted')}>{label !== '' ? label : 'Empty'}</span>
                {st ? <UiIcon name={st === 'correct' ? 'check' : 'not-yet'} size={20} className={st === 'correct' ? 'text-success' : 'text-warn'} /> : null}
              </button>
            </li>
          )
        })}
      </ol>
      <div role="group" aria-label="Labels" lang={item.lang} className="flex flex-wrap gap-2.5">
        {bank.map((l) => (
          <button
            key={l}
            type="button"
            disabled={locked}
            aria-pressed={picked === l}
            onClick={() => setPicked((p) => (p === l ? null : l))}
            className={cx(
              'inline-flex min-h-14 items-center rounded-control px-4 py-2 font-reading text-h3 font-bold text-fg transition-transform duration-150 ease-kira',
              picked === l ? cx('border-3', style.border, style.tint) : 'border-2 border-border bg-surface',
              locked ? 'cursor-not-allowed text-border' : 'cursor-pointer hover:border-fg active:scale-97',
            )}
          >
            {l}
          </button>
        ))}
        {bank.length === 0 ? <span className="self-center text-body text-fg-muted">All the labels are placed.</span> : null}
      </div>
    </div>
  )
}
