'use client'

import type { ReactElement } from 'react'
import { FractionBars, initialBars } from '@/components/manipulatives/FractionBars'
import { asBars } from './answers'
import type { WidgetProps } from './types'

/** Batang pecahan sebagai jawaban soal. Nilai { bars: { den, shaded }[] }. */
export function FractionBarWidget({ item, value, onChange, disabled = false, feedback = null }: WidgetProps): ReactElement {
  const cfg = item.fractionbar ?? { rows: [{}], splits: [2, 3, 4] }
  const bars = asBars(value) ?? initialBars(cfg.rows, cfg.splits)
  return <FractionBars rows={cfg.rows} splits={cfg.splits} value={bars} onChange={(b) => onChange({ bars: b })} disabled={disabled} feedback={feedback} />
}
