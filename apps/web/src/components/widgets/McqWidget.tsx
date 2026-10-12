'use client'

import type { ReactElement } from 'react'
import { Figure } from '@kira/figures'
import type { ClientOption } from '@kira/content/present'
import { AnswerTile, type AnswerTileState } from '@/components/learner/AnswerTile'
import { cx } from '@/components/ui/cx'
import { asChoice, asChoices, letterAt } from './answers'
import { useWidgetDensity } from './density'
import type { WidgetProps } from './types'

/**
 * Pilihan ganda satu jawaban (mcq) dan beberapa jawaban (multi) dengan AnswerTile.
 * Nilai selalu memakai indeks asli opsi `i`, huruf A sampai E mengikuti urutan tampil.
 */

function optionLabel(o: ClientOption): string {
  return o.text ?? o.figure?.alt ?? ''
}

function OptionContent({ o, exam = false, short = true }: { o: ClientOption; exam?: boolean; short?: boolean }): ReactElement {
  if (exam && !o.figure) {
    return <span className={cx('block text-center font-reading font-bold', short ? 'text-h1' : 'text-h2')}>{o.text}</span>
  }
  if (o.figure) {
    return (
      <>
        <span className="block w-full max-w-[220px]" aria-hidden="true">
          <Figure spec={o.figure} />
        </span>
        {o.text ? <span className="text-center font-reading text-h3">{o.text}</span> : null}
      </>
    )
  }
  return <span className="text-question block">{o.text}</span>
}

function useLayout(options: ClientOption[]): { pictures: boolean; wide: boolean } {
  const pictures = options.some((o) => !!o.figure)
  const wide = !pictures && options.some((o) => (o.text ?? '').length > 14)
  return { pictures, wide }
}

function tileState(selected: boolean, disabled: boolean, feedback: WidgetProps['feedback']): AnswerTileState {
  if (feedback) return selected ? (feedback === 'correct' ? 'correct' : 'not-yet') : 'dimmed'
  if (disabled) return selected ? 'selected' : 'disabled'
  return selected ? 'selected' : 'default'
}

export function McqWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement {
  const options = item.options ?? []
  const chosen = asChoice(value)
  const { pictures, wide } = useLayout(options)
  const exam = useWidgetDensity() === 'exam'
  const stack = pictures || exam
  // Satu ukuran huruf untuk semua opsi di satu soal: besar hanya bila semua opsi pendek.
  const short = options.every((o) => (o.text ?? '').length <= 6)
  return (
    <div className="@container flex w-full flex-col gap-3.5">
      <p className="m-0 text-body font-semibold text-fg-muted">{pictures ? 'Tap a picture.' : 'Choose one answer.'}</p>
      <div
        role="group"
        aria-label="Answers"
        className={cx('grid gap-x-4 gap-y-5 pt-1', pictures || exam ? 'grid-cols-2' : wide ? 'grid-cols-1 @lg:grid-cols-2' : 'grid-cols-2')}
      >
        {options.map((o, idx) => {
          const selected = chosen === o.i
          const letter = letterAt(idx)
          return (
            <AnswerTile
              key={o.i}
              letter={letter}
              subject={subject}
              layout={stack ? 'stack' : 'row'}
              state={tileState(selected, disabled, feedback)}
              aria-pressed={selected}
              aria-label={`${letter}, ${optionLabel(o)}${feedback && selected ? (feedback === 'correct' ? ', correct' : ', not yet') : ''}`}
              disabled={disabled || !!feedback}
              onClick={() => onChange({ choice: o.i })}
              className={pictures ? 'min-h-[150px]' : exam ? 'min-h-[132px] max-md:min-h-24' : undefined}
            >
              <OptionContent o={o} exam={exam} short={short} />
            </AnswerTile>
          )
        })}
      </div>
    </div>
  )
}

export function MultiWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement {
  const options = item.options ?? []
  const chosen = asChoices(value)
  const { pictures, wide } = useLayout(options)
  const need = item.multiCount ?? 0
  const toggle = (i: number) => {
    const has = chosen.includes(i)
    let next = has ? chosen.filter((c) => c !== i) : [...chosen, i]
    // Saat jumlah pilihan sudah penuh, pilihan baru menggantikan pilihan paling lama.
    if (!has && need > 0 && next.length > need) next = next.slice(next.length - need)
    onChange(next.length === 0 ? null : { choices: next })
  }
  return (
    <div className="@container flex w-full flex-col gap-3">
      <p className="m-0 text-body font-semibold text-fg-muted" aria-live="polite">
        {need > 0 ? `Choose ${need}. ${chosen.length} of ${need} chosen.` : `Choose all the right answers. ${chosen.length} chosen.`}
      </p>
      <div
        role="group"
        aria-label="Answers"
        className={cx('grid gap-x-4 gap-y-5 pt-1', pictures ? 'grid-cols-2' : wide ? 'grid-cols-1 @lg:grid-cols-2' : 'grid-cols-2')}
      >
        {options.map((o, idx) => {
          const selected = chosen.includes(o.i)
          const letter = letterAt(idx)
          return (
            <AnswerTile
              key={o.i}
              letter={letter}
              subject={subject}
              layout={pictures ? 'stack' : 'row'}
              state={tileState(selected, disabled, feedback)}
              aria-pressed={selected}
              aria-label={`${letter}, ${optionLabel(o)}`}
              disabled={disabled || !!feedback}
              onClick={() => toggle(o.i)}
            >
              <OptionContent o={o} />
            </AnswerTile>
          )
        })}
      </div>
    </div>
  )
}
