'use client'

import { useState, type ReactElement } from 'react'
import type { BarModelState } from '@kira/content/manip'
import { useT } from '@/lib/i18n/client'
import { BarModel } from './BarModel'
import { Chips } from './Chips'
import type { ToolMilestone } from './types'

type Props = { onMilestone?(k: ToolMilestone): void }

export function BarModelPlay({ kind: startKind = 'compare', fixed = false }: Props & { kind?: 'partwhole' | 'compare'; fixed?: boolean }): ReactElement {
  const t = useT()
  const [kind, setKind] = useState<'partwhole' | 'compare'>(startKind)
  const [model, setModel] = useState<BarModelState>({ bars: [] })
  return (
    <div className="flex w-full flex-col gap-4">
      {fixed ? null : <Chips<'compare' | 'partwhole'> label={t.widgets.tools.modelChip} value={kind} options={['compare', 'partwhole'] as const} onPick={setKind} render={(k) => (k === 'compare' ? t.widgets.tools.compare : t.widgets.tools.partWhole)} />}
      <BarModel config={{ kind, labels: t.widgets.tools.barLabels, barCount: 4, maxUnits: 12 }} value={model} onChange={setModel} />
    </div>
  )
}
