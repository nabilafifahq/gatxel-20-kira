'use client'

import { useState, type ReactElement } from 'react'
import { CARD_SETS, cardById } from '@kira/core'
import type { AlbumDTO, CardDTO } from '@/lib/dto-world'
import type { Dict } from '@/lib/i18n'
import { useT } from '@/lib/i18n/client'
import { itemName, setName, topicName } from '@/lib/i18n/dict/world'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { UiIcon } from '@/components/ui/icons'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { ReadAloudButton } from '@/components/learner/ReadAloudButton'
import { playSfx } from '@/components/learner/sfx'
import { CollectCard, RarityMark, WorldTabs } from '@/components/learner/world/parts'

/** Cara mendapatkan kartu dari syaratnya di @kira/core. Syarat jenis baru memakai teks Inggris dari server. */
function hintOf(w: Dict['world'], c: CardDTO): string {
  const req = cardById(c.id)?.req
  if (req?.kind === 'quiz') return w.album.hint.quiz(req.pct, topicName(w, req.topic))
  if (req?.kind === 'mastered') return w.album.hint.mastered(req.count)
  if (req?.kind === 'boss') return w.album.hint.boss
  return c.hint
}

export function AlbumScreen({ data }: { data: AlbumDTO }): ReactElement {
  const t = useT()
  const [open, setOpen] = useState<CardDTO | null>(null)
  const pick = (c: CardDTO) => {
    playSfx(c.owned ? (c.rarity === 'common' ? 'tap' : 'badge') : 'tap')
    setOpen(c)
  }
  return (
    <LearnerFrame shell={data.shell} current="world" className="flex flex-col gap-4 md:gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-h1 font-bold">{t.world.album.title}</h1>
        <p className="m-0 text-body-lg text-fg-muted">
          {t.world.album.intro(data.owned, data.total)}
        </p>
      </header>
      <WorldTabs current="cards" />
      {data.sets.map((s) => {
        const have = s.cards.filter((c) => c.owned).length
        const name = setName(t.world, s.id, s.name)
        const reward = itemName(t.world, CARD_SETS.find((x) => x.id === s.id)?.reward ?? '', s.reward)
        return (
          <section key={s.id} aria-label={t.world.album.setLabel(name)} className="flex flex-col gap-3 rounded-card border-2 border-divider bg-surface p-3.5 md:p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="m-0 text-h2 font-bold">{name}</h2>
              <span className="text-body font-bold tabular-nums">{have} / {s.cards.length}</span>
              {s.complete ? (
                <span className="inline-flex items-center gap-1 rounded-pill bg-success-50 px-3 py-1 text-small font-bold text-success">
                  <UiIcon name="check" size={14} strokeWidth={3} /> {t.world.album.setComplete(reward)}
                </span>
              ) : (
                <span className="text-small text-fg-muted">{t.world.album.setReward(reward)}</span>
              )}
            </div>
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4">
              {s.cards.map((c) => (
                <li key={c.id} className="flex flex-col gap-1.5">
                  <button type="button" onClick={() => pick(c)} aria-label={c.owned ? t.world.album.cardLabel(c.name, t.world.album.rarityWord[c.rarity], c.no) : t.world.album.cardLabelNotEarned(c.no)} className="cursor-pointer border-0 bg-transparent p-0 text-left">
                    <span className={c.owned && c.isNew ? 'kw-flip block' : 'block'}>
                      <CollectCard card={c} total={data.total} back={!c.owned} />
                    </span>
                  </button>
                  {!c.owned ? (
                    <div className="flex flex-col gap-1">
                      <span aria-hidden className="block h-2 overflow-hidden rounded-pill bg-divider">
                        <span className="block h-full origin-left rounded-pill bg-fg" style={{ transform: `scaleX(${Math.max(0.04, c.progress)})` }} />
                      </span>
                      <span className="text-small text-fg-muted">{hintOf(t.world, c)}</span>
                    </div>
                  ) : c.isNew ? (
                    <span className="text-small font-bold text-success">{t.world.album.isNew}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <Dialog open={open !== null} onClose={() => setOpen(null)} title={open?.owned ? <span lang="en-GB">{open.name}</span> : t.world.album.notEarned} size="md" footer={<Button onClick={() => setOpen(null)}>{t.common.close}</Button>}>
        {open ? (
          <div className="flex flex-col items-center gap-3.5">
            <div className="w-56 max-w-full">
              <CollectCard card={open} total={data.total} back={!open.owned} big />
            </div>
            {open.owned && open.fact ? (
              <>
                <RarityMark rarity={open.rarity} />
                <p lang="en-GB" className="m-0 text-center text-body-lg">{open.fact}</p>
                <ReadAloudButton text={`${open.name}. ${open.fact}`} subject="science" />
              </>
            ) : (
              <p className="m-0 text-center text-body-lg">{t.world.album.howToEarn(hintOf(t.world, open))}</p>
            )}
          </div>
        ) : null}
      </Dialog>
    </LearnerFrame>
  )
}
