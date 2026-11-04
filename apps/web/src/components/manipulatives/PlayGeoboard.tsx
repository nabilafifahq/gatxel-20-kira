'use client'

import { useState, type ReactElement } from 'react'
import { Chips } from './Chips'
import { Geoboard, type GeoState } from './Geoboard'
import type { ToolMilestone } from './types'

type Props = { onMilestone?(k: ToolMilestone): void }

export function GeoboardPlay({ size: startSize, fixed = false, onMilestone }: Props & { size?: number; fixed?: boolean }): ReactElement {
  const [size, setSize] = useState(startSize ?? 6)
  const [value, setValue] = useState<GeoState>({ pegs: [], closed: false })
  return (
    <div className="flex w-full flex-col gap-4">
      {fixed ? null : (
        <Chips
          label="Board"
          value={size}
          options={[4, 5, 6, 7, 8] as const}
          onPick={(n) => {
            setSize(n)
            setValue({ pegs: [], closed: false })
          }}
        />
      )}
      <Geoboard key={size} size={size} value={value} onChange={setValue} onMilestone={onMilestone} />
    </div>
  )
}
