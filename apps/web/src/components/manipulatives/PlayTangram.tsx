'use client'

import { useState, type ReactElement } from 'react'
import type { TangramState } from '@kira/content/manip'
import { Chips } from './Chips'
import { Tangram } from './Tangram'
import { TANGRAM_PLAY } from './tangram-puzzles'
import type { ToolMilestone } from './types'

type Props = { onMilestone?(k: ToolMilestone): void }

export function TangramPlay({ pieces, fixed = false, onMilestone }: Props & { pieces?: number; fixed?: boolean }): ReactElement {
  const startAt = pieces ? Math.max(0, TANGRAM_PLAY.findIndex((p) => p.pieces.length === pieces)) : 0
  const [at, setAt] = useState(startAt)
  const [value, setValue] = useState<TangramState>(() => TANGRAM_PLAY[startAt]!.slots.map(() => null))
  const puzzle = TANGRAM_PLAY[at]!
  const choose = (i: number) => {
    setAt(i)
    setValue(TANGRAM_PLAY[i]!.slots.map(() => null))
  }
  return (
    <div className="flex w-full flex-col gap-4">
      {fixed ? null : <Chips label="Puzzle" value={at} options={TANGRAM_PLAY.map((_, i) => i)} onPick={choose} render={(i) => TANGRAM_PLAY[i]!.name} />}
      <Tangram key={at} pieces={puzzle.pieces} slots={puzzle.slots} value={value} onChange={setValue} onMilestone={onMilestone} />
    </div>
  )
}
