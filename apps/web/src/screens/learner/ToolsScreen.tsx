'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { LessonTool } from '@kira/content/schema'
import type { ToolsDTO } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { Mascot, type MascotMood } from '@/components/learner/Mascot'
import { SUBJECT_STYLE } from '@/components/learner/subject'
import { TapSound } from '@/components/learner/TapSound'
import { playSfx } from '@/components/learner/sfx'
import { TOOL_INFO, ToolPlay } from '@/components/manipulatives/ToolPlay'
import type { ToolMilestone } from '@/components/manipulatives/types'

/**
 * Alat peraga Math (bermain bebas). Lima alat ketuk: balok nilai tempat, batang pecahan, model batang,
 * tangram, geoboard. Tanpa soal dan tanpa nilai; maskot ikut senang saat anak menukar, menutup bentuk,
 * atau menyelesaikan teka-teki.
 */

const ORDER: LessonTool['kind'][] = ['blocks', 'fractionbar', 'barmodel', 'tangram', 'geoboard']

export function ToolsScreen({ data }: { data: ToolsDTO }): ReactElement {
  const [kind, setKind] = useState<LessonTool['kind']>('blocks')
  const [mood, setMood] = useState<{ mood: MascotMood; n: number }>({ mood: 'idle', n: 0 })
  const timer = useRef(0)
  const style = SUBJECT_STYLE.math

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const react = (k: ToolMilestone) => {
    if (k !== 'trade' && k !== 'shape' && k !== 'done') return
    if (k === 'done') playSfx('correct')
    setMood((m) => ({ mood: 'cheer', n: m.n + 1 }))
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMood((m) => ({ ...m, mood: 'idle' })), 1600)
  }

  return (
    <LearnerFrame shell={data.shell} current="tools" className="flex flex-col gap-6 md:gap-7">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-h1 font-bold">Maths Tools</h1>
          <p className="m-0 text-body-lg text-fg-muted">Play with blocks, bars, shapes and pegs. There are no marks here. Try things out.</p>
        </div>
        <Mascot name={data.shell.avatar} mood={mood.mood} replayKey={mood.n} size={72} accessory={data.shell.accessory} background={data.shell.background} className="flex-none" />
      </header>

      <div role="radiogroup" aria-label="Choose a tool" className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {ORDER.map((k) => {
          const on = kind === k
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setKind(k)
                setMood((m) => ({ ...m, mood: 'idle' }))
              }}
              className={cx(
                'flex min-h-14 cursor-pointer flex-col items-start justify-center rounded-control border-2 px-3.5 py-2 text-left text-body font-bold transition-transform duration-150 ease-kira active:scale-97',
                on ? cx('border-3', style.border, style.tint, 'text-fg') : 'border-divider bg-surface text-fg hover:border-border',
              )}
            >
              {TOOL_INFO[k].title}
            </button>
          )
        })}
      </div>

      <section aria-labelledby="tool-title" className="flex flex-col gap-3">
        <h2 id="tool-title" className="m-0 text-h2 font-bold">
          {TOOL_INFO[kind].title}
        </h2>
        <p className="m-0 text-body text-fg-muted">{TOOL_INFO[kind].blurb}</p>
        <TapSound>
          <div key={kind} className="kira-rise max-w-3xl">
            <ToolPlay kind={kind} onMilestone={react} />
          </div>
        </TapSound>
      </section>
    </LearnerFrame>
  )
}
