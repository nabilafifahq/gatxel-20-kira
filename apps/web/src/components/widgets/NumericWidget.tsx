'use client'

import type { ReactElement } from 'react'
import { useMediaQuery } from '@/components/learner/hooks'
import { NumericKeypad } from '@/components/learner/NumericKeypad'
import { asValue } from './answers'
import type { WidgetProps } from './types'

/** Jawaban angka lewat keypad 64 px dan keyboard fisik. Nilai { value: string }. */
export function NumericWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement {
  const phone = useMediaQuery('(max-width: 599px)')
  const v = asValue(value)
  return (
    <div className="flex w-full justify-center">
      <NumericKeypad
        value={v}
        onChange={(next) => onChange(next === '' ? null : { value: next })}
        subject={subject}
        disabled={disabled || !!feedback}
        feedback={feedback}
        allowDecimal={!!item.allowDecimal}
        allowNegative={!!item.allowNegative}
        decimalChar={item.lang === 'id' ? ',' : '.'}
        unit={item.unit}
        size={phone ? 'M' : 'L'}
        showLabel={!phone}
      />
    </div>
  )
}
