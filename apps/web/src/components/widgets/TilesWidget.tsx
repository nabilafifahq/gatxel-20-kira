'use client'

import type { ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { SUBJECT_STYLE } from '@/components/learner/subject'
import { useT } from '@/lib/i18n/client'
import { asWords } from './answers'
import type { WidgetProps } from './types'

/**
 * Susun kata tanpa seret: ketuk kartu kata untuk menaruhnya di kalimat, ketuk kartu di kalimat untuk
 * mengembalikannya. Ada kartu pengecoh. Nilai { words: string[] }, kata-kata di kalimat dari kiri ke kanan.
 */

/** Kartu yang masih di bank: semua kartu dikurangi kata yang sudah dipakai (per salinan, jadi kata kembar aman). */
export function remainingTiles(tiles: readonly string[], used: readonly string[]): { text: string; index: number }[] {
  const left = tiles.map((text, index) => ({ text, index }))
  for (const w of used) {
    const at = left.findIndex((t) => t.text === w)
    if (at >= 0) left.splice(at, 1)
  }
  return left
}

export function TilesWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement {
  const style = SUBJECT_STYLE[subject]
  const tiles = item.tiles ?? []
  const words = asWords(value)
  const bank = remainingTiles(tiles, words)
  const locked = disabled || !!feedback
  const dict = useT()

  const set = (next: string[]) => onChange(next.length === 0 ? null : { words: next })
  const place = (text: string) => {
    if (!locked) set([...words, text])
  }
  const take = (at: number) => {
    if (!locked) set(words.filter((_, i) => i !== at))
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="m-0 text-body font-semibold text-fg-muted" aria-live="polite">
        {locked ? dict.widgets.tiles.yourSentence : words.length === 0 ? dict.widgets.tiles.tapInOrder : dict.widgets.tiles.tapToTakeBack}
      </p>
      <div
        role="group"
        aria-label={dict.widgets.tiles.yourSentence}
        className={cx(
          'flex min-h-22 flex-wrap items-center gap-2.5 rounded-control border-2 p-3',
          feedback === 'correct' ? 'border-3 border-success bg-success-50' : feedback === 'not-yet' ? 'border-3 border-warn bg-surface' : locked ? 'border-divider bg-bg' : cx('border-dashed bg-surface', style.border),
        )}
      >
        {words.length === 0 ? <span className="px-1 text-body-lg text-fg-muted">{dict.widgets.tiles.goesHere}</span> : null}
        {words.map((w, i) => (
          <button
            key={`${i}-${w}`}
            type="button"
            disabled={locked}
            aria-label={dict.widgets.tiles.wordAria(w, i + 1, words.length)}
            onClick={() => take(i)}
            className={cx(
              'inline-flex min-h-14 min-w-14 items-center justify-center rounded-control border-2 px-4 py-2 font-reading text-h3 font-bold text-fg transition-transform duration-150 ease-kira',
              locked ? 'cursor-default border-divider bg-surface' : cx('cursor-pointer bg-surface hover:border-fg active:scale-97', style.border, style.tint),
            )}
          >
            <span lang={item.lang}>{w}</span>
          </button>
        ))}
      </div>
      <div role="group" aria-label={dict.widgets.tiles.wordCards} className="flex flex-wrap gap-2.5">
        {bank.map((t) => (
          <button
            key={t.index}
            type="button"
            lang={item.lang}
            disabled={locked}
            onClick={() => place(t.text)}
            className={cx(
              'inline-flex min-h-14 min-w-14 items-center justify-center rounded-control border-2 px-4 py-2 font-reading text-h3 font-bold text-fg transition-transform duration-150 ease-kira',
              locked ? 'cursor-not-allowed border-divider bg-bg text-border' : 'cursor-pointer border-border bg-surface hover:border-fg active:scale-97',
            )}
          >
            {t.text}
          </button>
        ))}
        {bank.length === 0 ? <span className="self-center text-body text-fg-muted">{dict.widgets.tiles.allInSentence}</span> : null}
      </div>
      {!locked && words.length > 0 ? (
        <button
          type="button"
          onClick={() => set([])}
          className="inline-flex h-14 w-fit cursor-pointer items-center gap-2 rounded-control border-2 border-border bg-surface px-4 text-body-lg font-bold hover:border-fg active:scale-97"
        >
          <UiIcon name="undo" size={20} />
          {dict.widgets.shared.startAgain}
        </button>
      ) : null}
    </div>
  )
}
