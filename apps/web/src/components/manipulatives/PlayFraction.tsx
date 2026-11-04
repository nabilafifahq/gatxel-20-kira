'use client'

import { useState, type ReactElement } from 'react'
import type { BarState } from '@kira/content/manip'
import { useT } from '@/lib/i18n/client'
import { Chips } from './Chips'
import { FractionBars, initialBars } from './FractionBars'
import type { ToolMilestone } from './types'

type Props = { onMilestone?(k: ToolMilestone): void }

const SPLITS = [2, 3, 4, 5, 6, 8, 10, 12] as const

export function FractionPlay({ bars, split, fixed = false, onMilestone }: Props & { bars?: number; split?: number; fixed?: boolean }): ReactElement {
  const t = useT()
  const [count, setCount] = useState(bars ?? 2)
  const [value, setValue] = useState<BarState[]>(() => initialBars(Array.from({ length: bars ?? 2 }, () => ({})), SPLITS, split ?? 2))
  const rows = Array.from({ length: count }, () => ({}))
  const resize = (n: number) => {
    setCount(n)
    setValue((v) => Array.from({ length: n }, (_, i) => v[i] ?? { den: i === 0 ? 2 : SPLITS[Math.min(i * 2, SPLITS.length - 1)]!, shaded: 0 }))
  }
  return (
    <div className="flex w-full flex-col gap-4">
      {fixed ? null : <Chips label={t.widgets.tools.barsChip} value={count} options={[1, 2, 3] as const} onPick={resize} />}
      <FractionBars rows={rows} splits={SPLITS} value={value.length === count ? value : initialBars(rows, SPLITS)} onChange={setValue} onMilestone={onMilestone} showCompare />
    </div>
  )
}
