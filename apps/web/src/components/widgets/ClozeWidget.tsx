'use client'

import type { ReactElement } from 'react'
import { normaliseText } from '@kira/content/check'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { asTexts } from './answers'
import type { WidgetProps } from './types'

/**
 * Pilih kata di celah. Setiap ___ di teks soal menjadi daftar pilihan (elemen select asli, jadi bisa
 * dipakai dengan ketuk, keyboard, dan pembaca layar). Daftar pilihan ada di item.cloze, urut per celah.
 * Nilai { texts: string[] }, kata yang dipilih untuk tiap celah.
 */

const SUBJECT_FOCUS: Record<WidgetProps['subject'], string> = {
  math: 'focus-visible:border-math',
  english: 'focus-visible:border-english',
  science: 'focus-visible:border-science',
}

type PromptProps = Pick<WidgetProps, 'item' | 'value' | 'onChange' | 'disabled' | 'feedback' | 'subject'> & { className?: string; id?: string }

function GapSelect({
  index,
  total,
  options,
  chosen,
  onPick,
  disabled,
  state,
  subject,
}: {
  index: number
  total: number
  options: string[]
  chosen: string
  onPick: (t: string) => void
  disabled: boolean
  state: 'correct' | 'not-yet' | null
  subject: WidgetProps['subject']
}): ReactElement {
  return (
    <span className="mx-1 inline-flex items-center gap-1 align-middle">
      <select
        aria-label={total > 1 ? `Gap ${index + 1} of ${total}` : 'Your answer'}
        value={chosen}
        disabled={disabled}
        onChange={(e) => onPick(e.target.value)}
        className={cx(
          'h-14 min-w-28 max-w-full rounded-control border-2 bg-surface px-3 font-reading text-h3 font-bold outline-offset-2',
          state === 'correct' ? 'border-3 border-success bg-success-50' : state === 'not-yet' ? 'border-3 border-warn' : disabled ? 'border-divider bg-bg' : cx('cursor-pointer border-border hover:border-fg', SUBJECT_FOCUS[subject]),
        )}
      >
        <option value="">Choose</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {state ? <UiIcon name={state === 'correct' ? 'check' : 'not-yet'} size={22} className={state === 'correct' ? 'text-success' : 'text-warn'} title={state === 'correct' ? 'Right word' : 'Not yet'} /> : null}
    </span>
  )
}

/** Teks soal dengan daftar pilihan di setiap ___. */
export function ClozePrompt({ item, value, onChange, disabled = false, feedback = null, subject, className, id }: PromptProps): ReactElement {
  const gaps = item.cloze ?? []
  const texts = asTexts(value, gaps.length)
  const parts = item.prompt.split(/_{3,}/)
  const key = item.key?.type === 'cloze' ? item.key.answers : null
  const set = (i: number, t: string) => {
    const next = texts.slice()
    next[i] = t
    onChange(next.every((x) => x === '') ? null : { texts: next })
  }
  return (
    <p id={id} lang={item.lang} className={cx('text-question m-0 leading-[3.6rem]', className)}>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && i < gaps.length ? (
            <GapSelect
              index={i}
              total={gaps.length}
              options={gaps[i] ?? []}
              chosen={texts[i] ?? ''}
              onPick={(t) => set(i, t)}
              disabled={disabled || !!feedback}
              state={feedback && key ? (normaliseText(texts[i] ?? '', false) === normaliseText(key[i] ?? '', false) ? 'correct' : 'not-yet') : feedback ? (feedback === 'correct' ? 'correct' : null) : null}
              subject={subject}
            />
          ) : i < parts.length - 1 ? (
            <span aria-label="blank">___</span>
          ) : null}
        </span>
      ))}
    </p>
  )
}

/** Area jawaban untuk soal celah: petunjuk singkat, pilihan ada di teks soal. */
export function ClozeWidget({ item }: WidgetProps): ReactElement {
  const total = item.cloze?.length ?? 1
  return (
    <p className="m-0 flex items-center gap-2 text-body-lg text-fg-muted">
      <UiIcon name="pencil" size={22} />
      {total > 1 ? 'Choose a word for each gap.' : 'Choose a word for the gap.'}
    </p>
  )
}
