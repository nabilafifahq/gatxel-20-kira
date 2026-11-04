'use client'

import type { ReactElement } from 'react'
import { BarModel } from '@/components/manipulatives/BarModel'
import { asModel } from './answers'
import type { WidgetProps } from './types'

/** Model batang sebagai jawaban soal. Nilai { model: { bars: { label, units }[], unit? } }. */
export function BarModelWidget({ item, value, onChange, disabled = false, feedback = null }: WidgetProps): ReactElement | null {
  const cfg = item.barmodel
  if (!cfg) return null
  const model = asModel(value) ?? { bars: [], ...(cfg.unit ? { unit: 0 } : {}) }
  return <BarModel config={cfg} value={model} onChange={(m) => onChange({ model: m })} disabled={disabled} feedback={feedback} />
}
