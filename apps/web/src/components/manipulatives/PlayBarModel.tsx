'use client'

import { useState, type ReactElement } from 'react'
import type { BarModelState } from '@kira/content/manip'
import { BarModel } from './BarModel'
import { Chips } from './Chips'
import type { ToolMilestone } from './types'

type Props = { onMilestone?(k: ToolMilestone): void }

const PLAY_LABELS = ['Bar A', 'Bar B', 'Bar C', 'Bar D']

export function BarModelPlay({ kind: startKind = 'compare', fixed = false }: Props & { kind?: 'partwhole' | 'compare'; fixed?: boolean }): ReactElement {
  const [kind, setKind] = useState<'partwhole' | 'compare'>(startKind)
  const [model, setModel] = useState<BarModelState>({ bars: [] })
  return (
    <div className="flex w-full flex-col gap-4">
      {fixed ? null : <Chips<'compare' | 'partwhole'> label="Model" value={kind} options={['compare', 'partwhole'] as const} onPick={setKind} render={(k) => (k === 'compare' ? 'Compare' : 'Part and whole')} />}
      <BarModel config={{ kind, labels: PLAY_LABELS, barCount: 4, maxUnits: 12 }} value={model} onChange={setModel} />
    </div>
  )
}
