'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type ReactElement } from 'react'
import { CARD_COUNT } from '@kira/core'
import { StoryScene } from '@kira/figures'
import type { CardMiniDTO, StoryDTO } from '@/lib/dto-world'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { Dialog } from '@/components/ui/Dialog'
import { UiIcon } from '@/components/ui/icons'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { ReadAloudButton } from '@/components/learner/ReadAloudButton'
import { playSfx } from '@/components/learner/sfx'
import { TapWords } from '@/components/learner/TapWords'
import { CollectCard, RarityMark, WorldTabs } from '@/components/learner/world/parts'
import { finishChapterAction } from '@/server/actions/world'

type Chapter = StoryDTO['chapters'][number]

/** Sobekan surat. Tampil saat bab selesai dan di surat yang makin lengkap. */
function ScrapLine({ text, n }: { text: string; n: number }): ReactElement {
  return (
    <li className="rounded-control border-2 border-fg bg-surface px-3.5 py-2 font-reading text-body-lg" style={{ rotate: `${n % 2 === 0 ? 0.6 : -0.6}deg` }}>
      {text}
    </li>
  )
}

function Reader({ chapter, onClose, last }: { chapter: Chapter; onClose: (earned: CardMiniDTO[]) => void; last: boolean }): ReactElement {
  const [i, setI] = useState(0)
  const [busy, start] = useTransition()
  const page = chapter.pages[i]!
  const end = i === chapter.pages.length - 1
  const go = (d: number) => {
    playSfx('whoosh')
    setI((n) => Math.min(chapter.pages.length - 1, Math.max(0, n + d)))
  }
  const finish = () =>
    start(async () => {
      playSfx('complete')
      const res = await finishChapterAction({ n: chapter.n })
      onClose(res.ok ? (res.data?.cards ?? []) : [])
    })
  return (
    <section aria-label={`Chapter ${chapter.n}: ${chapter.title}`} className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <Button variant="quiet" size="M" icon="arrow-left" onClick={() => onClose([])}>
          All chapters
        </Button>
        <h2 className="m-0 min-w-0 flex-1 text-h3 font-bold">
          Chapter {chapter.n}: {chapter.title}
        </h2>
      </div>
      <div className="kw-animate overflow-hidden rounded-card border-2 border-fg bg-surface">
        <div key={i} className="kw-page aspect-[2/1] max-h-[46svh] w-full">
          <StoryScene
            scene={page.scene}
            cx={page.cx}
            cy={page.cy}
            zoom={page.zoom}
            lumi={{ x: page.lx, y: page.ly }}
            glow={chapter.glow}
            pip={page.pip}
            kira={page.kira}
            show={page.show}
            title={`Picture for page ${i + 1}`}
            className="h-full w-full"
          />
        </div>
        <div className="flex flex-col gap-3 border-t-2 border-fg p-4 md:p-5">
          <p key={`t${i}`} className="kira-fade-in m-0 min-h-[4.5rem] font-reading text-h3 leading-relaxed">
            <TapWords text={page.text} />
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
          <Button className="ml-auto" iconAfter="check" onClick={finish} disabled={busy}>
            Finish chapter
          </Button>
        ) : (
          <Button className="ml-auto" iconAfter="arrow-right" onClick={() => go(1)}>
            Turn the page
          </Button>
        )}
      </div>
      {end ? (
        <div className="kira-fade-in flex flex-col gap-3 rounded-card border-2 border-dashed border-border bg-surface p-4">
          {chapter.scrap ? (
            <div className="flex flex-col gap-1.5">
              <strong className="text-body">A new scrap of the note</strong>
              <ul className="m-0 list-none p-0">
                <ScrapLine text={chapter.scrap} n={chapter.n} />
              </ul>
            </div>
          ) : null}
          <p className="m-0 text-body-lg">
            <strong>Lumi wonders: </strong>
            {chapter.wonder}
          </p>
          <p className="m-0 text-body-lg">
            <strong>{last ? 'One last thing: ' : 'Next time: '}</strong>
            {chapter.tease}
          </p>
        </div>
      ) : null}
    </section>
  )
}

export function StoryScreen({ data }: { data: StoryDTO }): ReactElement {
  const router = useRouter()
  const [reading, setReading] = useState<number | null>(null)
  const [earned, setEarned] = useState<CardMiniDTO[]>([])
  const chapter = data.chapters.find((c) => c.n === reading)
  const found = data.chapters.filter((c) => c.done && c.scrap)
  const close = (cards: CardMiniDTO[]) => {
    setReading(null)
    if (cards.length > 0) {
      playSfx('chest')
      setEarned(cards)
    }
    router.refresh()
  }
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
        <Reader chapter={chapter} last={chapter.n === data.chapters.length} onClose={close} />
      ) : (
        <>
          <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
            {data.chapters.map((c) => (
              <li key={c.n}>
                {c.isOpen ? (
                  <button type="button" onClick={() => { playSfx('tap'); setReading(c.n) }} className="flex min-h-14 w-full cursor-pointer items-center gap-3.5 rounded-card border-2 border-fg bg-surface p-3.5 text-left hover:bg-bg">
                    <span className={cx('flex h-12 w-12 flex-none items-center justify-center rounded-pill text-h3 font-bold', c.done ? 'bg-success-50 text-success' : 'bg-fg text-white')}>
                      {c.done ? <UiIcon name="check" size={22} strokeWidth={3} /> : c.n}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body-lg font-bold">{c.title}</span>
                      <span className="text-small text-fg-muted">{c.done ? 'Read it again and look closely' : `${c.pages.length} pages with pictures and voice`}</span>
                    </span>
                    <UiIcon name="arrow-right" size={22} />
                  </button>
                ) : (
                  <div className="flex min-h-14 w-full items-center gap-3.5 rounded-card border-2 border-dashed border-border bg-surface p-3.5">
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
          {data.open < data.chapters.length ? (
            <p className="m-0 text-body text-fg-muted">
              <strong>Next up: </strong>
              {data.chapters[data.open - 1]?.tease}
            </p>
          ) : null}
          <section aria-label="The torn note" className="flex flex-col gap-3 rounded-card border-2 border-divider bg-surface p-4 md:p-5">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="m-0 text-h2 font-bold">The torn note</h2>
              <span className="text-body font-bold tabular-nums">
                {found.length} of {data.chapters.length} scraps
              </span>
            </div>
            {found.length > 0 ? (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {found.map((c) => (
                  <ScrapLine key={c.n} text={c.scrap!} n={c.n} />
                ))}
              </ul>
            ) : (
              <p className="m-0 text-body-lg text-fg-muted">Finish a chapter to find the first scrap. Who wrote this note?</p>
            )}
          </section>
        </>
      )}
      <Dialog open={earned.length > 0} onClose={() => setEarned([])} title="A new card!" size="md" footer={<Button onClick={() => setEarned([])}>Close</Button>}>
        {earned[0] ? (
          <div className="flex flex-col items-center gap-3">
            <div className="kw-flip w-56 max-w-full">
              <CollectCard card={{ ...earned[0], tone: 'knowledge' }} total={CARD_COUNT} big />
            </div>
            <RarityMark rarity={earned[0].rarity} />
            {earned[0].fact ? <p className="m-0 text-center text-body-lg">{earned[0].fact}</p> : null}
          </div>
        ) : null}
      </Dialog>
    </LearnerFrame>
  )
}
