'use client'

import dynamic from 'next/dynamic'
import type { ReactElement } from 'react'
import type { LessonTool } from '@kira/content/schema'
import type { ToolMilestone } from './types'

/** Tiap alat dimuat sendiri hanya saat dipakai, supaya halaman pelajaran, soal, dan Alat tetap ringan. */
function Loading(): ReactElement {
  return <div role="status" aria-label="Loading the tool" className="h-48 w-full animate-pulse rounded-card border border-divider bg-surface" />
}
const Blocks = dynamic(() => import('./PlayBlocks').then((m) => m.BlocksPlay), { loading: Loading })
const Fraction = dynamic(() => import('./PlayFraction').then((m) => m.FractionPlay), { loading: Loading })
const BarModelTool = dynamic(() => import('./PlayBarModel').then((m) => m.BarModelPlay), { loading: Loading })
const TangramTool = dynamic(() => import('./PlayTangram').then((m) => m.TangramPlay), { loading: Loading })
const GeoboardTool = dynamic(() => import('./PlayGeoboard').then((m) => m.GeoboardPlay), { loading: Loading })

export const TOOL_INFO: Record<LessonTool['kind'], { title: string; blurb: string }> = {
  blocks: { title: 'Place value blocks', blurb: 'Build numbers with hundreds, tens and ones. Trade 10 small blocks for 1 bigger block.' },
  fractionbar: { title: 'Fraction bars', blurb: 'Cut bars into equal parts, shade them and compare fractions.' },
  barmodel: { title: 'Bar models', blurb: 'Draw bars to show how amounts are shared, joined or compared.' },
  tangram: { title: 'Tangram', blurb: 'Pick a piece, turn it, then tap a place to fit it into the shape.' },
  geoboard: { title: 'Geoboard', blurb: 'Tap pegs to make shapes. See the sides, perimeter and area.' },
}

/**
 * Alat dalam mode bermain. `config` datang dari lesson.steps[].tool; tanpa config, anak boleh memilih sendiri
 * (halaman Alat).
 */
export function ToolPlay({ kind, config, onMilestone }: { kind: LessonTool['kind']; config?: LessonTool; onMilestone?(k: ToolMilestone): void }): ReactElement {
  const fixed = config !== undefined
  switch (kind) {
    case 'blocks':
      return <Blocks onMilestone={onMilestone} {...(config?.blocks ? { start: config.blocks } : {})} />
    case 'fractionbar':
      return <Fraction fixed={fixed} onMilestone={onMilestone} {...(config?.bars ? { bars: config.bars } : {})} {...(config?.split ? { split: config.split } : {})} />
    case 'barmodel':
      return <BarModelTool fixed={fixed} />
    case 'tangram':
      return <TangramTool fixed={fixed} onMilestone={onMilestone} {...(config?.pieces ? { pieces: config.pieces.length } : {})} />
    case 'geoboard':
      return <GeoboardTool fixed={fixed} onMilestone={onMilestone} {...(config?.size ? { size: config.size } : {})} />
  }
}
