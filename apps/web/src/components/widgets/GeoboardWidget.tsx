'use client'

import type { ReactElement } from 'react'
import { Geoboard } from '@/components/manipulatives/Geoboard'
import { asPegs } from './answers'
import type { WidgetProps } from './types'

/** Geoboard sebagai jawaban soal. Nilai { pegs: [x, y][], closed }. */
export function GeoboardWidget({ item, value, onChange, disabled = false, feedback = null }: WidgetProps): ReactElement | null {
  const cfg = item.geoboard
  if (!cfg) return null
  return <Geoboard size={cfg.size} value={asPegs(value)} onChange={(g) => onChange({ pegs: g.pegs, closed: g.closed })} disabled={disabled} feedback={feedback} />
}
