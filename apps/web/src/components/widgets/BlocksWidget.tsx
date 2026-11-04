'use client'

import type { ReactElement } from 'react'
import { PlaceValueBlocks } from '@/components/manipulatives/PlaceValueBlocks'
import { asBlocks } from './answers'
import type { WidgetProps } from './types'

/** Balok nilai tempat sebagai jawaban soal. Nilai { blocks: { h, t, o } }. */
export function BlocksWidget({ item, value, onChange, disabled = false, feedback = null }: WidgetProps): ReactElement {
  const start = item.blocks?.start ?? { h: 0, t: 0, o: 0 }
  return (
    <PlaceValueBlocks
      places={item.blocks?.places ?? 'hto'}
      value={asBlocks(value) ?? start}
      onChange={(b) => onChange({ blocks: b })}
      disabled={disabled}
      feedback={feedback}
    />
  )
}
