'use client'

import { useRef, useState, type ReactElement } from 'react'
import type { AlbumDTO, CardDTO } from '@/lib/dto-world'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { Dialog } from '@/components/ui/Dialog'
import { UiIcon } from '@/components/ui/icons'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { ReadAloudButton } from '@/components/learner/ReadAloudButton'
import { playSfx } from '@/components/learner/sfx'
import { CollectCard, RarityMark, WorldTabs, scrollMotion } from '@/components/learner/world/parts'
import { CARD_SETS } from '@kira/core'
import type { Dict } from '@/lib/i18n'
import { useT } from '@/lib/i18n/client'
import { cardHintOf, setTextOf } from '@/lib/i18n/world-text'

function Meter({ value, label }: { value: number; label?: string }): ReactElement {
  return (
    <span {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })} className="block h-2 overflow-hidden rounded-pill bg-divider">
      <span className="block h-full origin-left rounded-pill bg-fg" style={{ transform: `scaleX(${value})` }} />
    </span>
  )
}

function countText(c: CardDTO, t: Dict): string | null {
  if (!c.count) return null
  return c.count.unit === 'percent' ? t.world.album.countPercent(c.count.have, c.count.need) : t.world.album.countOf(c.count.have, c.count.need)
}

export function AlbumScreen({ data }: { data: AlbumDTO }): ReactElement {
  const t = useT()
  const a = t.world.album
  const setText = (s: AlbumDTO['sets'][number]) => setTextOf(t, s, CARD_SETS.find((x) => x.id === s.id)?.reward)
  const [open, setOpen] = useState<CardDTO | null>(null)
  const firstNew = data.sets.find((s) => s.cards.some((c) => c.isNew))?.id
  const [setId, setSetId] = useState(firstNew ?? data.sets[0]?.id ?? '')
  const current = data.sets.find((s) => s.id === setId) ?? data.sets[0]
  const shelf = useRef<HTMLElement>(null)
  const pick = (c: CardDTO) => {
    playSfx(c.owned ? (c.rarity === 'common' ? 'tap' : 'badge') : 'tap')
    setOpen(c)
  }
  const tile = (s: AlbumDTO['sets'][number]) => {
    const have = s.cards.filter((c) => c.owned).length
    return (
      <li key={s.id}>
        <button
          type="button"
          aria-pressed={s.id === current?.id}
          onClick={() => {
            playSfx('tap')
            setSetId(s.id)
            // Di HP kartu ada jauh di bawah daftar set, jadi layar ikut turun ke set yang dipilih.
            requestAnimationFrame(() => shelf.current?.scrollIntoView({ behavior: scrollMotion(), block: 'start' }))
          }}
          className={cx('flex min-h-14 w-full cursor-pointer flex-col gap-1.5 rounded-card border-2 p-3 text-left', s.id === current?.id ? 'border-fg bg-knowledge-50' : 'border-border bg-surface hover:border-fg')}
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 text-body font-bold">{setText(s).name}</span>
            <span className="flex-none text-small font-bold tabular-nums">
              {have}/{s.cards.length}
            </span>
          </span>
          <Meter value={s.cards.length > 0 ? have / s.cards.length : 0} />
        </button>
      </li>
    )
  }
  const rareSets = data.sets.filter((s) => s.rare)
  const learnSets = data.sets.filter((s) => !s.rare)
  return (
    <LearnerFrame shell={data.shell} current="world" className="flex flex-col gap-4 md:gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-h1 font-bold">{a.title}</h1>
        <p className="m-0 text-body-lg text-fg-muted">{a.intro(data.owned, data.total)}</p>
      </header>
      <WorldTabs current="cards" />
      <section aria-label={a.byRarity} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {data.rarities.map((r) => (
          <div key={r.rarity} className="flex flex-col gap-1.5 rounded-card border-2 border-divider bg-surface p-3">
            <span className="flex flex-wrap items-baseline justify-between gap-x-2">
              <RarityMark rarity={r.rarity} />
              <span className="text-small font-bold tabular-nums">
                {r.owned}/{r.total}
              </span>
            </span>
            <Meter value={r.total > 0 ? r.owned / r.total : 0} />
          </div>
        ))}
      </section>
      {rareSets.length > 0 ? (
        <section aria-label={a.rareSets} className="flex flex-col gap-2">
          <h2 className="m-0 text-h3 font-bold">{a.rareSetsTitle}</h2>
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4">{rareSets.map(tile)}</ul>
        </section>
      ) : null}
      <section aria-label={a.learningSets} className="flex flex-col gap-2">
        <h2 className="m-0 text-h3 font-bold">{a.learningSetsTitle}</h2>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4">{learnSets.map(tile)}</ul>
      </section>
      {current ? (
        <section ref={shelf} aria-label={a.setLabel(setText(current).name)} className="flex scroll-mt-4 flex-col gap-3 rounded-card border-2 border-divider bg-surface p-3.5 md:p-5">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="m-0 text-h2 font-bold">{setText(current).name}</h2>
              <span className="text-body font-bold tabular-nums">
                {current.cards.filter((c) => c.owned).length} / {current.cards.length}
              </span>
            </div>
            <p className="m-0 text-body text-fg-muted">
              {setText(current).blurb} {setText(current).earnedBy}.
            </p>
            {current.complete ? (
              <span className="inline-flex w-fit items-center gap-1 rounded-pill bg-success-50 px-3 py-1 text-small font-bold text-success">
                <UiIcon name="check" size={14} strokeWidth={3} /> {a.setComplete(setText(current).reward)}
              </span>
            ) : (
              <span className="text-small text-fg-muted">{a.setReward(setText(current).reward)}</span>
            )}
          </div>
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4">
            {current.cards.map((c) => (
              <li key={c.id} className="flex flex-col gap-1.5">
                <button type="button" onClick={() => pick(c)} aria-label={c.owned ? a.cardLabel(c.name, a.rarityWord[c.rarity], c.no) : a.cardLabelNotEarned(c.no)} className="cursor-pointer border-0 bg-transparent p-0 text-left">
                  <span className={c.owned && c.isNew ? 'kw-flip block' : 'block'}>
                    <CollectCard card={c} total={data.total} back={!c.owned} />
                  </span>
                </button>
                {!c.owned ? (
                  <div className="flex flex-col gap-1">
                    <Meter value={c.progress} />
                    <span className="text-small text-fg-muted">
                      {cardHintOf(t, c.id, c.hint)}
                      {countText(c, t) ? ` (${countText(c, t)})` : ''}
                    </span>
                  </div>
                ) : c.isNew ? (
                  <span className="text-small font-bold text-success">{a.isNew}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Dialog open={open !== null} onClose={() => setOpen(null)} title={open?.owned ? open.name : a.notEarned} size="md" footer={<Button onClick={() => setOpen(null)}>{t.world.story.close}</Button>}>
        {open ? (
          <div className="flex flex-col items-center gap-3.5">
            <div className="w-56 max-w-full">
              <CollectCard card={open} total={data.total} back={!open.owned} big />
            </div>
            {open.owned && open.fact ? (
              <>
                <p lang="en-GB" className="m-0 text-center text-body-lg">{open.fact}</p>
                <ReadAloudButton text={`${open.name}. ${open.fact}`} subject="science" />
              </>
            ) : (
              <p className="m-0 text-center text-body-lg">{a.howToEarn(cardHintOf(t, open.id, open.hint))}</p>
            )}
          </div>
        ) : null}
      </Dialog>
    </LearnerFrame>
  )
}
