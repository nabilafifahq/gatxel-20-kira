'use client'

import type { ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { asTexts, blankCount } from './answers'
import type { WidgetProps } from './types'

/**
 * Isian kata pendek (text). Kotak isian muncul langsung di tempat ___ pada teks soal
 * lewat TextPrompt. Bila jumlah ___ lebih sedikit dari jumlah blank, sisanya muncul
 * di area jawaban. Nilai { texts: string[] } sepanjang jumlah blank.
 */

const SUBJECT_FOCUS: Record<WidgetProps['subject'], string> = {
  math: 'focus-visible:border-math',
  english: 'focus-visible:border-english',
  science: 'focus-visible:border-science',
}

function BlankInput({
  index,
  total,
  text,
  onText,
  disabled,
  feedback,
  subject,
}: {
  index: number
  total: number
  text: string
  onText: (t: string) => void
  disabled: boolean
  feedback: WidgetProps['feedback']
  subject: WidgetProps['subject']
}): ReactElement {
  return (
    <input
      type="text"
      inputMode="text"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      enterKeyHint="done"
      aria-label={total > 1 ? `Gap ${index + 1} of ${total}` : 'Your answer'}
      value={text}
      disabled={disabled}
      maxLength={60}
      onChange={(e) => onText(e.target.value)}
      style={{ width: `${Math.max(6, text.length + 2)}ch` }}
      className={cx(
        'mx-1 inline-block h-[1.7em] max-w-full rounded-control border-2 bg-surface px-2 align-baseline font-reading outline-offset-2',
        feedback === 'correct'
          ? 'border-3 border-success bg-success-50'
          : feedback === 'not-yet'
            ? 'border-3 border-warn'
            : disabled
              ? 'border-divider bg-bg'
              : cx('border-border', SUBJECT_FOCUS[subject]),
      )}
    />
  )
}

type PromptProps = Pick<WidgetProps, 'item' | 'value' | 'onChange' | 'disabled' | 'feedback' | 'subject'> & { className?: string; id?: string }

/** Teks soal dengan kotak isian di setiap ___. */
export function TextPrompt({ item, value, onChange, disabled = false, feedback = null, subject, className, id }: PromptProps): ReactElement {
  const total = Math.max(1, item.blanks ?? 1)
  const texts = asTexts(value, total)
  const parts = item.prompt.split(/_{3,}/)
  const set = (i: number, t: string) => {
    const next = texts.slice()
    next[i] = t
    onChange(next.every((x) => x === '') ? null : { texts: next })
  }
  return (
    <p id={id} lang={item.lang} className={cx('text-question m-0', className)}>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && i < total ? (
            <BlankInput index={i} total={total} text={texts[i] ?? ''} onText={(t) => set(i, t)} disabled={disabled || !!feedback} feedback={feedback} subject={subject} />
          ) : i < parts.length - 1 ? (
            <span aria-label="blank">___</span>
          ) : null}
        </span>
      ))}
    </p>
  )
}

/** Area jawaban untuk soal isian: kotak yang tidak muat di teks soal, atau petunjuk singkat. */
export function TextWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement {
  const total = Math.max(1, item.blanks ?? 1)
  const inline = Math.min(blankCount(item.prompt), total)
  const texts = asTexts(value, total)
  const set = (i: number, t: string) => {
    const next = texts.slice()
    next[i] = t
    onChange(next.every((x) => x === '') ? null : { texts: next })
  }
  const rest = Array.from({ length: total - inline }, (_, k) => inline + k)
  return (
    <div className="flex w-full flex-col gap-4">
      {rest.length > 0 ? (
        rest.map((i) => (
          <label key={i} className="flex flex-col gap-2">
            <span className="text-body font-semibold text-fg-muted">{total > 1 ? `Answer ${i + 1}` : 'Your answer'}</span>
            <span className="text-question">
              <BlankInput index={i} total={total} text={texts[i] ?? ''} onText={(t) => set(i, t)} disabled={disabled || !!feedback} feedback={feedback} subject={subject} />
            </span>
          </label>
        ))
      ) : (
        <p className="m-0 flex items-center gap-2 text-body-lg text-fg-muted">
          <UiIcon name="pencil" size={22} />
          {total > 1 ? 'Type a word in each gap.' : 'Type your answer in the gap.'}
        </p>
      )}
    </div>
  )
}
