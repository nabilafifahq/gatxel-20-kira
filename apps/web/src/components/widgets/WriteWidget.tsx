'use client'

import { useId, useState, type ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { useT } from '@/lib/i18n/client'
import { asText, countWords } from './answers'
import type { WidgetProps } from './types'

/**
 * Menulis bebas dinilai tutor (papan RunnerMenulis): pertanyaan bantu sebagai daftar
 * centang untuk anak sendiri, kotak tulis dengan hitungan kata, batas minimal dan maksimal.
 * Nilai { text }. Daftar centang tidak ikut terkirim.
 */

const FOCUS: Record<WidgetProps['subject'], string> = {
  math: 'focus-visible:border-fg',
  english: 'focus-visible:border-fg',
  science: 'focus-visible:border-fg',
}
const TINT: Record<WidgetProps['subject'], string> = { math: 'bg-math-50', english: 'bg-english-50', science: 'bg-science-50' }

export function WriteWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement {
  const text = asText(value)
  const words = countWords(text)
  const min = item.minWords ?? 0
  const max = item.maxWords ?? 0
  const [ticks, setTicks] = useState<boolean[]>(() => (item.planning ?? []).map(() => false))
  const areaId = useId()
  const countId = useId()
  const locked = disabled || !!feedback
  const dict = useT()

  let countLine = dict.widgets.write.words(words)
  let countTone = 'text-fg-muted'
  if (min > 0 && words < min) countLine += dict.widgets.write.writeMore(min - words, min)
  else if (max > 0 && words > max) {
    countLine += dict.widgets.write.tooMany(words - max, max)
    countTone = 'text-warn font-bold'
  } else if (words > 0) {
    countLine += '.'
    countTone = 'text-fg'
  }

  const range = min > 0 && max > 0 ? dict.widgets.write.range(min, max) : min > 0 ? dict.widgets.write.atLeast(min) : max > 0 ? dict.widgets.write.upTo(max) : null

  return (
    <div className="flex w-full flex-col gap-4">
      {item.planning && item.planning.length > 0 ? (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-body-lg font-bold">{dict.widgets.write.checkWriting}</legend>
          {item.planning.map((p, k) => (
            <label
              key={k}
              className={cx(
                'flex min-h-14 cursor-pointer items-center gap-3.5 rounded-control px-3.5 py-2',
                ticks[k] ? cx('border-3 border-fg', TINT[subject]) : 'border-2 border-border bg-surface',
              )}
            >
              <input
                type="checkbox"
                checked={ticks[k] ?? false}
                onChange={() => setTicks((t) => t.map((x, j) => (j === k ? !x : x)))}
                className="h-6.5 w-6.5 flex-none accent-fg"
              />
              <span lang={item.lang} className="font-reading text-h3">{p}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="flex flex-col gap-2">
        <label htmlFor={areaId} className="text-body-lg font-bold">
          {dict.widgets.write.yourWriting}
        </label>
        {range ? <p className="m-0 text-body text-fg-muted">{range}</p> : null}
        <textarea
          id={areaId}
          lang={item.lang}
          value={text}
          disabled={locked}
          rows={7}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={countId}
          onChange={(e) => onChange(e.target.value === '' ? null : { text: e.target.value })}
          className={cx(
            'min-h-44 w-full resize-y rounded-control border-2 bg-surface px-4 py-3 font-reading text-h3',
            locked ? 'border-divider bg-bg' : cx('border-border', FOCUS[subject]),
          )}
        />
        <p id={countId} aria-live="polite" className={cx('m-0 text-body tabular-nums', countTone)}>
          {countLine}
        </p>
      </div>
    </div>
  )
}
