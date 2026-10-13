'use client'

import { useState, type ReactElement } from 'react'
import { checkAnswer } from '@kira/content/check'
import type { ClientItem, ClientPart } from '@kira/content/present'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { SUBJECT_STYLE } from '@/components/learner/subject'
import { asParts, isPartComplete } from './answers'
import { McqWidget } from './McqWidget'
import { NumericWidget } from './NumericWidget'
import { TextWidget } from './TextWidget'
import type { WidgetFeedback, WidgetProps } from './types'

/**
 * Soal cerita bertahap. Ceritanya ada di teks soal. Di sini anak menjawab 2 sampai 4 pertanyaan satu per satu
 * lewat tab; tiap pertanyaan memakai widget pilihan ganda, angka, atau isian yang sama dengan soal biasa.
 * Nilai { parts: (jawaban | null)[] }, satu jawaban per pertanyaan menurut bentuk widgetnya.
 */

/** Soal sintetis untuk satu pertanyaan, supaya widget biasa bisa dipakai apa adanya. */
function partItem(item: ClientItem, part: ClientPart, k: number): ClientItem {
  const partKey = item.key?.type === 'story' ? item.key.parts[k] : undefined
  return {
    ref: `${item.ref}#${k + 1}`,
    type: part.type,
    skill: item.skill,
    difficulty: item.difficulty,
    prompt: part.prompt,
    lang: item.lang,
    expectedSeconds: item.expectedSeconds,
    ...(part.options ? { options: part.options } : {}),
    ...(part.unit ? { unit: part.unit } : {}),
    ...(part.allowDecimal !== undefined ? { allowDecimal: part.allowDecimal } : {}),
    ...(part.allowNegative !== undefined ? { allowNegative: part.allowNegative } : {}),
    ...(part.type === 'text' ? { blanks: 1 } : {}),
    ...(partKey ? { key: partKey } : {}),
  }
}

export function StoryWidget(props: WidgetProps): ReactElement | null {
  const { item, value, onChange, disabled = false, feedback = null, subject } = props
  const parts = item.parts ?? []
  const given = asParts(value, parts.length)
  const style = SUBJECT_STYLE[subject]
  const firstOpen = given.findIndex((g, k) => !isPartComplete(parts[k]!, g))
  const [active, setActive] = useState(firstOpen >= 0 ? firstOpen : 0)
  if (parts.length === 0) return null
  const k = Math.min(active, parts.length - 1)
  const part = parts[k]!
  const sub = partItem(item, part, k)

  const setPart = (v: unknown | null) => {
    const next = given.slice()
    next[k] = v
    onChange(next.every((x) => x === null) ? null : { parts: next })
  }

  const partFeedback = (i: number): WidgetFeedback => {
    if (!feedback) return null
    const key = item.key?.type === 'story' ? item.key.parts[i] : null
    if (!key) return feedback === 'correct' ? 'correct' : null
    return checkAnswer(key, given[i] ?? null).status === 'correct' ? 'correct' : 'not-yet'
  }

  const inner = { item: sub, value: given[k] ?? null, onChange: setPart, disabled, feedback: partFeedback(k), subject }
  return (
    <div className="flex w-full flex-col gap-4">
      <div role="tablist" aria-label="Questions about the story" className="flex flex-wrap gap-2">
        {parts.map((p, i) => {
          const done = isPartComplete(p, given[i])
          const pf = partFeedback(i)
          return (
            <button
              key={i}
              type="button"
              role="tab"
              id={`${item.ref}-tab-${i}`}
              aria-selected={i === k}
              aria-controls={`${item.ref}-panel`}
              onClick={() => setActive(i)}
              className={cx(
                'inline-flex min-h-14 min-w-14 cursor-pointer items-center justify-center gap-2 rounded-control px-4 text-body-lg font-bold text-fg transition-transform duration-150 ease-kira active:scale-97',
                i === k ? cx('border-3', style.border, style.tint) : 'border-2 border-border bg-surface hover:border-fg',
              )}
            >
              Question {i + 1}
              {pf === 'correct' ? (
                <UiIcon name="check" size={18} className="text-success" />
              ) : pf === 'not-yet' ? (
                <UiIcon name="not-yet" size={18} className="text-warn" />
              ) : done ? (
                <UiIcon name="check" size={18} />
              ) : null}
            </button>
          )
        })}
      </div>
      <div id={`${item.ref}-panel`} role="tabpanel" aria-labelledby={`${item.ref}-tab-${k}`} className="flex flex-col gap-4">
        <p lang={item.lang} className="text-question m-0">
          {part.prompt}
        </p>
        {part.type === 'mcq' ? <McqWidget key={sub.ref} {...inner} /> : part.type === 'numeric' ? <NumericWidget key={sub.ref} {...inner} /> : <TextWidget key={sub.ref} {...inner} />}
        {k < parts.length - 1 ? (
          <Button variant="secondary" iconAfter="arrow-right" className="self-start" onClick={() => setActive(k + 1)}>
            Next question
          </Button>
        ) : null}
      </div>
    </div>
  )
}
