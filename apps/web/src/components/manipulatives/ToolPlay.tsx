'use client'

import dynamic from 'next/dynamic'
import type { ReactElement } from 'react'
import type { LessonTool } from '@kira/content/schema'
import { useT } from '@/lib/i18n/client'
import type { ToolMilestone } from './types'

/** Tiap alat dimuat sendiri hanya saat dipakai, supaya halaman pelajaran, soal, dan Alat tetap ringan. */
function Loading(): ReactElement {
  const t = useT()
  return <div role="status" aria-label={t.widgets.shared.loadingTool} className="h-48 w-full animate-pulse rounded-card border border-divider bg-surface" />
}
const Blocks = dynamic(() => import('./PlayBlocks').then((m) => m.BlocksPlay), { loading: Loading })
const Fraction = dynamic(() => import('./PlayFraction').then((m) => m.FractionPlay), { loading: Loading })
const BarModelTool = dynamic(() => import('./PlayBarModel').then((m) => m.BarModelPlay), { loading: Loading })
const TangramTool = dynamic(() => import('./PlayTangram').then((m) => m.TangramPlay), { loading: Loading })
const GeoboardTool = dynamic(() => import('./PlayGeoboard').then((m) => m.GeoboardPlay), { loading: Loading })

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
