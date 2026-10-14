'use client'

import { useState, type ReactElement } from 'react'
import { WORLD_MAP } from '@kira/content/worldmap'
import { cx } from '@/components/ui/cx'

/**
 * Peta dunia sederhana untuk soal "Point on the map" (Quiz Arena). Path SVG dibuat saat build dari world-atlas
 * (packages/content/scripts/build-worldmap.mjs) dan dilayani sendiri, tanpa aset luar. Hanya ketuk, tanpa seret.
 * Samudra digambar di bawah daratan, jadi mengetuk air memilih samudra dan mengetuk daratan memilih benua.
 * Warna hanya dari token DESIGN.md.
 */

export type MapFeedback = { chosen: string | null; correct: string } | null

type Region = { id: string; label: string; d: string; kind: 'land' | 'water' }

const REGIONS: readonly Region[] = [
  ...WORLD_MAP.water.map((r) => ({ ...r, kind: 'water' as const })),
  ...WORLD_MAP.land.map((r) => ({ ...r, kind: 'land' as const })),
]

function fillOf(r: Region, feedback: MapFeedback, hot: boolean): string {
  if (feedback) {
    if (r.id === feedback.correct) return 'fill-success stroke-success'
    if (r.id === feedback.chosen) return 'fill-danger-50 stroke-danger'
    return r.kind === 'water' ? 'fill-math-50 stroke-math-50' : 'fill-science-50 stroke-science-50'
  }
  if (hot) return 'fill-knowledge-50 stroke-knowledge'
  return r.kind === 'water' ? 'fill-math-50 stroke-math-50' : 'fill-science-50 stroke-science'
}

/** Id wilayah dari namanya (label di kunci server), untuk menandai jawaban yang benar. */
export function regionIdByLabel(label: string | undefined): string | null {
  return REGIONS.find((r) => r.label === label)?.id ?? null
}

export function WorldMap({ onPick, disabled, feedback }: { onPick: (regionId: string) => void; disabled: boolean; feedback: MapFeedback }): ReactElement {
  const [hot, setHot] = useState<string | null>(null)
  return (
    <svg
      role="group"
      aria-label="World map. Tap a continent or an ocean."
      viewBox={WORLD_MAP.viewBox}
      className="block h-auto w-full max-w-[860px] touch-manipulation rounded-card border-2 border-border bg-bg"
    >
      {REGIONS.map((r) => (
        <path
          key={r.id}
          d={r.d}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={r.label}
          aria-disabled={disabled}
          strokeWidth={r.kind === 'land' ? 0.5 : 0.3}
          strokeLinejoin="round"
          className={cx('outline-none transition-colors duration-150', disabled ? 'cursor-default' : 'cursor-pointer focus-visible:stroke-fg', fillOf(r, feedback, hot === r.id && !disabled))}
          onPointerEnter={() => setHot(r.id)}
          onPointerLeave={() => setHot((h) => (h === r.id ? null : h))}
          onClick={() => {
            if (!disabled) onPick(r.id)
          }}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onPick(r.id)
            }
          }}
        />
      ))}
    </svg>
  )
}
