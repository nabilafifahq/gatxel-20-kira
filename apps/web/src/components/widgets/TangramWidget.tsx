'use client'

import type { ReactElement } from 'react'
import { Tangram } from '@/components/manipulatives/Tangram'
import { asPlaced } from './answers'
import type { WidgetProps } from './types'

/** Tangram sebagai jawaban soal. Nilai { placed: ([keping, putaran, cermin] | null)[] } satu entri per tempat. */
export function TangramWidget({ item, value, onChange, disabled = false, feedback = null }: WidgetProps): ReactElement | null {
  const cfg = item.tangram
  if (!cfg) return null
  const placed = asPlaced(value, cfg.slots.length, cfg.pieces.length) ?? cfg.slots.map(() => null)
  return <Tangram pieces={cfg.pieces} slots={cfg.slots} value={placed} onChange={(p) => onChange({ placed: p })} disabled={disabled} feedback={feedback} />
}
