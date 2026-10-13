'use client'

import { useCallback, type ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { SUBJECT_STYLE } from '@/components/learner/subject'
import { asValue } from './answers'
import { CharKeypad, LETTERS_AZ } from './CharKeypad'
import { ListenButton } from './ListenButton'
import type { WidgetProps } from './types'

/**
 * Eja: anak mendengar kata (dan kalimat contoh), lalu mengetik huruf di papan huruf. Kata yang harus
 * dieja hanya ada di audio dan di kunci, tidak pernah di layar sebelum jawaban dikirim. Kotak huruf
 * menunjukkan panjang kata. Nilai { value: string }.
 */
export function SpellWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement {
  const style = SUBJECT_STYLE[subject]
  const letters = asValue(value).toLowerCase()
  const length = item.spellLength ?? 0
  const locked = disabled || !!feedback
  const keys = [...LETTERS_AZ, ...(item.spellExtra ?? [])]
  const maxLen = Math.max(length + 3, 8)

  const set = useCallback(
    (next: string) => {
      onChange(next === '' ? null : { value: next })
    },
    [onChange],
  )

  const boxes = Math.max(length, letters.length)
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <ListenButton text={item.listenText ?? ''} lang={item.lang} subject={subject} label="Hear the word" />
      <output
        aria-live="polite"
        aria-label={letters === '' ? 'Your spelling is empty' : `Your spelling: ${letters.split('').join(' ')}`}
        className="flex flex-wrap justify-center gap-1.5"
      >
        {Array.from({ length: boxes }, (_, i) => {
          const ch = letters[i]
          return (
            <span
              key={i}
              aria-hidden="true"
              className={cx(
                'flex h-16 w-12 items-center justify-center rounded-control border-b-4 bg-surface font-reading text-h1 font-bold uppercase',
                feedback === 'correct'
                  ? 'border-2 border-b-4 border-success bg-success-50'
                  : feedback === 'not-yet'
                    ? 'border-2 border-b-4 border-warn'
                    : locked
                      ? 'border-2 border-b-4 border-divider bg-bg'
                      : ch !== undefined
                        ? cx('border-2 border-b-4', style.border)
                        : i === letters.length
                          ? cx('border-3', style.border)
                          : 'border-2 border-b-4 border-border',
              )}
            >
              {ch ?? ''}
            </span>
          )
        })}
      </output>
      {feedback ? (
        <p className={cx('m-0 inline-flex items-center gap-2 text-body-lg font-bold', feedback === 'correct' ? 'text-success' : 'text-fg')}>
          <UiIcon name={feedback === 'correct' ? 'check' : 'not-yet'} size={22} className={feedback === 'correct' ? 'text-success' : 'text-warn'} />
          {feedback === 'correct' ? 'Correct' : 'Not yet'}
        </p>
      ) : null}
      <CharKeypad
        keys={keys}
        upper
        label="Letters"
        subject={subject}
        disabled={locked}
        onKey={(k) => letters.length < maxLen && set(letters + k)}
        onBackspace={() => set(letters.slice(0, -1))}
        onClear={() => set('')}
      />
    </div>
  )
}
