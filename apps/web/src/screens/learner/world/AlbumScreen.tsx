'use client'

import { useState, type ReactElement } from 'react'
import type { AlbumDTO, CardDTO } from '@/lib/dto-world'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { UiIcon } from '@/components/ui/icons'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { ReadAloudButton } from '@/components/learner/ReadAloudButton'
import { playSfx } from '@/components/learner/sfx'
import { CollectCard, RarityMark, WorldTabs } from '@/components/learner/world/parts'

export function AlbumScreen({ data }: { data: AlbumDTO }): ReactElement {
  const [open, setOpen] = useState<CardDTO | null>(null)
  const pick = (c: CardDTO) => {
    playSfx(c.owned ? (c.rarity === 'common' ? 'tap' : 'badge') : 'tap')
    setOpen(c)
  }
  return (
    <LearnerFrame shell={data.shell} current="world" className="flex flex-col gap-4 md:gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-h1 font-bold">Card album</h1>
        <p className="m-0 text-body-lg text-fg-muted">
          {data.owned} of {data.total} cards. Every card is earned by learning, so there are no surprises and no luck. Finish a set to earn a special reward.
        </p>
      </header>
      <WorldTabs current="cards" />
      {data.sets.map((s) => {
        const have = s.cards.filter((c) => c.owned).length
        return (
          <section key={s.id} aria-label={`${s.name} set`} className="flex flex-col gap-3 rounded-card border-2 border-divider bg-surface p-3.5 md:p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="m-0 text-h2 font-bold">{s.name}</h2>
              <span className="text-body font-bold tabular-nums">{have} / {s.cards.length}</span>
              {s.complete ? (
                <span className="inline-flex items-center gap-1 rounded-pill bg-success-50 px-3 py-1 text-small font-bold text-success">
                  <UiIcon name="check" size={14} strokeWidth={3} /> Set complete: {s.reward} earned
                </span>
              ) : (
                <span className="text-small text-fg-muted">Reward for the full set: {s.reward}</span>
              )}
            </div>
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4">
              {s.cards.map((c) => (
                <li key={c.id} className="flex flex-col gap-1.5">
                  <button type="button" onClick={() => pick(c)} aria-label={c.owned ? `${c.name}, ${c.rarity} card number ${c.no}` : `Card number ${c.no}, not earned yet`} className="cursor-pointer border-0 bg-transparent p-0 text-left">
                    <span className={c.owned && c.isNew ? 'kw-flip block' : 'block'}>
                      <CollectCard card={c} total={data.total} back={!c.owned} />
                    </span>
                  </button>
                  {!c.owned ? (
                    <div className="flex flex-col gap-1">
                      <span aria-hidden className="block h-2 overflow-hidden rounded-pill bg-divider">
                        <span className="block h-full origin-left rounded-pill bg-fg" style={{ transform: `scaleX(${Math.max(0.04, c.progress)})` }} />
                      </span>
                      <span className="text-small text-fg-muted">{c.hint}</span>
                    </div>
                  ) : c.isNew ? (
                    <span className="text-small font-bold text-success">New!</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <Dialog open={open !== null} onClose={() => setOpen(null)} title={open?.owned ? open.name : 'Not earned yet'} size="md" footer={<Button onClick={() => setOpen(null)}>Close</Button>}>
        {open ? (
          <div className="flex flex-col items-center gap-3.5">
            <div className="w-56 max-w-full">
              <CollectCard card={open} total={data.total} back={!open.owned} big />
            </div>
            {open.owned && open.fact ? (
              <>
                <RarityMark rarity={open.rarity} />
                <p className="m-0 text-center text-body-lg">{open.fact}</p>
                <ReadAloudButton text={`${open.name}. ${open.fact}`} subject="science" />
              </>
            ) : (
              <p className="m-0 text-center text-body-lg">How to earn it: {open.hint}.</p>
            )}
          </div>
        ) : null}
      </Dialog>
    </LearnerFrame>
  )
}
