'use client'

import { useState, type ReactElement } from 'react'
import type { Blocks } from '@kira/content/manip'
import { PlaceValueBlocks } from './PlaceValueBlocks'
import type { ToolMilestone } from './types'

type Props = { onMilestone?(k: ToolMilestone): void }

export function BlocksPlay({ start, onMilestone }: Props & { start?: Blocks }): ReactElement {
  const [value, setValue] = useState<Blocks>(start ?? { h: 0, t: 0, o: 0 })
  return <PlaceValueBlocks places={start && start.h === 0 ? 'to' : 'hto'} value={value} onChange={setValue} onMilestone={onMilestone} />
}
