'use client'

import { useState, type ReactElement } from 'react'
import { StoryScene } from '@kira/figures'
import type { StoryDTO } from '@/lib/dto-world'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { ReadAloudButton } from '@/components/learner/ReadAloudButton'
import { playSfx } from '@/components/learner/sfx'
import { WorldTabs } from '@/components/learner/world/parts'

type Chapter = StoryDTO['chapters'][number]

function Reader({ chapter, onClose, last }: { chapter: Chapter; onClose: () => void; last: boolean }): ReactElement {
  const [i, setI] = useState(0)
  const page = chapter.pages[i]!
  const end = i === chapter.pages.length - 1
  const go = (d: number) => {
    playSfx('whoosh')
    setI((n) => Math.min(chapter.pages.length - 1, Math.max(0, n + d)))
  }
  return (
    <section aria-label={`Chapter ${chapter.n}: ${chapter.title}`} className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <Button variant="quiet" size="M" icon="arrow-left" onClick={onClose}>
          All chapters
        </Button>
        <h2 className="m-0 min-w-0 flex-1 text-h3 font-bold">
          Chapter {chapter.n}: {chapter.title}
        </h2>
      </div>
      <div className="kw-animate overflow-hidden rounded-card border-2 border-fg bg-surface">
        <div key={i} className="kira-fade-in aspect-[2/1] max-h-[46svh] w-full">
          <StoryScene scene={chapter.scene} cx={page.cx} zoom={page.zoom} lumi={{ x: page.lx, y: page.ly }} title={`Picture for page ${i + 1}`} className="h-full w-full" />
        </div>
        <div className="flex flex-col gap-3 border-t-2 border-fg p-4 md:p-5">
          <p key={`t${i}`} className="kira-fade-in m-0 font-reading text-h3 leading-relaxed">
            {page.text}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <ReadAloudButton text={page.text} subject="english" style="narrator" />
            <span className="ml-auto text-small font-bold tabular-nums" aria-live="polite">
              Page {i + 1} of {chapter.pages.length}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="secondary" icon="arrow-left" onClick={() => go(-1)} disabled={i === 0}>
          Back
        </Button>
        {end ? (
          <Button className="ml-auto" iconAfter="check" onClick={onClose}>
            Finish chapter
          </Button>
        ) : (
          <Button className="ml-auto" iconAfter="arrow-right" onClick={() => go(1)}>
            Turn the page
          </Button>
        )}
      </div>
      {end ? (
        <p className="kira-fade-in m-0 rounded-card border-2 border-dashed border-border bg-surface p-4 text-body-lg">
          <strong>{last ? 'The story is not over: ' : 'Next time: '}</strong>
          {chapter.tease}
        </p>
      ) : null}
    </section>
  )
}

export function StoryScreen({ data }: { data: StoryDTO }): ReactElement {
  const [reading, setReading] = useState<number | null>(null)
  const chapter = data.chapters.find((c) => c.n === reading)
  return (
    <LearnerFrame shell={data.shell} current="world" className="flex flex-col gap-4 md:gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-h1 font-bold">{data.title}</h1>
        <p className="m-0 text-body-lg text-fg-muted">
          A new chapter opens each week you study on {data.goalDays} days. This week: {Math.min(data.thisWeekDays, data.goalDays)} of {data.goalDays} days.
        </p>
      </header>
      <WorldTabs current="story" />
      {chapter ? (
        <Reader chapter={chapter} last={chapter.n === data.chapters.length} onClose={() => setReading(null)} />
      ) : (
        <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
          {data.chapters.map((c) => (
            <li key={c.n}>
              {c.isOpen ? (
                <button type="button" onClick={() => { playSfx('tap'); setReading(c.n) }} className="flex min-h-14 w-full cursor-pointer items-center gap-3.5 rounded-card border-2 border-fg bg-surface p-3.5 text-left hover:bg-bg">
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded-pill bg-fg text-h3 font-bold text-white">{c.n}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body-lg font-bold">{c.title}</span>
                    <span className="text-small text-fg-muted">Read with pictures and voice</span>
                  </span>
                  <UiIcon name="arrow-right" size={22} />
                </button>
              ) : (
                <div className={cx('flex min-h-14 w-full items-center gap-3.5 rounded-card border-2 border-dashed border-border bg-surface p-3.5')}>
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded-pill bg-divider text-h3 font-bold text-fg-muted">{c.n}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body-lg font-bold text-fg-muted">Chapter {c.n}</span>
                    <span className="text-small text-fg-muted">Opens when you finish a weekly goal</span>
                  </span>
                  <UiIcon name="lock" size={20} className="text-fg-muted" />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {!chapter && data.open < data.chapters.length ? (
        <p className="m-0 text-body text-fg-muted">
          <strong>Next up: </strong>
          {data.chapters[data.open - 1]?.tease}
        </p>
      ) : null}
    </LearnerFrame>
  )
}
