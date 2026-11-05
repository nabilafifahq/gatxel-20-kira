'use client'

import type { ReactElement } from 'react'
import { Figure } from '@kira/figures'
import type { ClientOption } from '@kira/content/present'
import { AnswerTile, type AnswerTileState } from '@/components/learner/AnswerTile'
import { cx } from '@/components/ui/cx'
import { useT } from '@/lib/i18n/client'
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

function OptionContent({ o, lang, exam = false, short = true }: { o: ClientOption; lang: string; exam?: boolean; short?: boolean }): ReactElement {
  if (exam && !o.figure) {
    return <span lang={lang} className={cx('block text-center font-reading font-bold', short ? 'text-h1' : 'text-h2')}>{o.text}</span>
  }
  if (o.figure) {
    return (
      <>
        <span lang={lang} className="block w-full max-w-[220px]" aria-hidden="true">
          <Figure spec={o.figure} />
        </span>
        {o.text ? <span lang={lang} className="text-center font-reading text-h3">{o.text}</span> : null}
      </>
    )
  }
  return <span lang={lang} className="text-question block min-w-0 [overflow-wrap:anywhere]">{o.text}</span>
}

/** Kata terpanjang di opsi: kata utuh tidak bisa dilipat, jadi menentukan apakah dua kolom muat di layar HP. */
const longestWord = (options: ClientOption[]) => Math.max(0, ...options.flatMap((o) => (o.text ?? '').split(/\s+/).map((w) => w.length)))

function useLayout(options: ClientOption[]): { pictures: boolean; columns: string } {
  const pictures = options.some((o) => !!o.figure)
  const wide = !pictures && options.some((o) => (o.text ?? '').length > 14)
  const word = longestWord(options)
  const columns = pictures ? 'grid-cols-2' : wide ? 'grid-cols-1 @lg:grid-cols-2' : word >= 6 ? 'grid-cols-1 @sm:grid-cols-2' : 'grid-cols-2'
  return { pictures, columns }
}

function tileState(selected: boolean, disabled: boolean, feedback: WidgetProps['feedback']): AnswerTileState {
  if (feedback) return selected ? (feedback === 'correct' ? 'correct' : 'not-yet') : 'dimmed'
  if (disabled) return selected ? 'selected' : 'disabled'
  return selected ? 'selected' : 'default'
}

export function McqWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement {
  const options = item.options ?? []
  const chosen = asChoice(value)
  const { pictures, columns } = useLayout(options)
  const exam = useWidgetDensity() === 'exam'
  const stack = pictures || exam
  // Satu ukuran huruf untuk semua opsi di satu soal: besar hanya bila semua opsi pendek.
  const short = options.every((o) => (o.text ?? '').length <= 6)
  const t = useT()
  return (
    <div className="@container flex w-full flex-col gap-3.5">
      <p className="m-0 text-body font-semibold text-fg-muted">{pictures ? t.widgets.mcq.tapPicture : t.widgets.mcq.chooseOne}</p>
      <div
        role="group"
        aria-label={t.widgets.shared.answers}
        className={cx('grid gap-x-4 gap-y-5 pt-1', pictures ? 'grid-cols-2' : exam ? (longestWord(options) >= 10 ? 'grid-cols-1 @sm:grid-cols-2' : 'grid-cols-2') : columns)}
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
              aria-label={`${letter}, ${optionLabel(o)}${feedback && selected ? (feedback === 'correct' ? t.widgets.shared.ariaCorrect : t.widgets.shared.ariaNotYet) : ''}`}
              disabled={disabled || !!feedback}
              onClick={() => onChange({ choice: o.i })}
              className={pictures ? 'min-h-[150px]' : exam ? 'min-h-[132px] max-md:min-h-24' : undefined}
            >
              <OptionContent o={o} lang={item.lang} exam={exam} short={short} />
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
  const { pictures, columns } = useLayout(options)
  const need = item.multiCount ?? 0
  const t = useT()
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
        {need > 0 ? t.widgets.mcq.chooseN(need, chosen.length) : t.widgets.mcq.chooseAll(chosen.length)}
      </p>
      <div
        role="group"
        aria-label={t.widgets.shared.answers}
        className={cx('grid gap-x-4 gap-y-5 pt-1', columns)}
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
              <OptionContent o={o} lang={item.lang} />
            </AnswerTile>
          )
        })}
      </div>
    </div>
  )
}
