'use client'

import { useState, type ReactElement } from 'react'
import { Avatar, FrameThumb, PetCostumeThumb, PetHomeArt } from '@kira/figures'
import type { ActionResult } from '@/lib/dto'
import type { ShopDTO, ShopItemDTO } from '@/lib/dto-world'
import { useT } from '@/lib/i18n/client'
import { itemName } from '@/lib/i18n/dict/world'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { playSfx } from '@/components/learner/sfx'
import { StarCount, WorldTabs } from '@/components/learner/world/parts'

export type ShopActions = {
  buy: (input: { id: string }) => Promise<ActionResult>
  equip: (input: { kind: ShopItemDTO['kind']; id: string | null }) => Promise<ActionResult>
}

const SECTIONS: ShopItemDTO['kind'][] = ['pethome', 'petcostume', 'outfit', 'frame', 'backdrop']

function Thumb({ item, data }: { item: ShopItemDTO; data: ShopDTO }): ReactElement {
  const { shell } = data
  if (item.kind === 'pethome') return <PetHomeArt id={item.id} width={150} className="h-auto max-w-full rounded-control" />
  if (item.kind === 'petcostume') return <PetCostumeThumb id={item.id} size={80} />
  if (item.kind === 'frame') return <FrameThumb id={item.id} size={80} />
  if (item.kind === 'outfit') return <Avatar name={shell.avatar} size={80} accessory={item.id} />
  return <Avatar name={shell.avatar} size={80} background={item.id} />
}

export function ShopScreen({ data, actions }: { data: ShopDTO; actions: ShopActions }): ReactElement {
  const t = useT()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const run = async (key: string, fn: () => Promise<ActionResult>, sound: 'badge' | 'tap') => {
    setBusy(key)
    setMessage(null)
    try {
      const res = await fn()
      if (res.ok) playSfx(sound)
      else setMessage(res.message)
    } catch {
      setMessage(t.world.internetError)
    } finally {
      setBusy(null)
    }
  }
  return (
    <LearnerFrame shell={data.shell} current="world" className="flex flex-col gap-4 md:gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="m-0 text-h1 font-bold">{t.world.shopName}</h1>
          <p className="m-0 text-body-lg text-fg-muted">{t.world.shop.intro}</p>
        </div>
        <StarCount stars={data.stars} />
      </header>
      <WorldTabs current="shop" />
      {message ? <p role="alert" className="m-0 rounded-card border-2 border-danger bg-danger-50 p-3 text-body font-bold">{message}</p> : null}
      {SECTIONS.map((kind) => {
        const s = t.world.shop.sections[kind]
        const items = data.items.filter((i) => i.kind === kind)
        if (items.length === 0) return null
        return (
          <section key={kind} aria-label={s.title} className="flex flex-col gap-3">
            <div>
              <h2 className="m-0 text-h2 font-bold">{s.title}</h2>
              <p className="m-0 text-body text-fg-muted">{s.blurb}</p>
            </div>
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3 xl:grid-cols-4">
              {items.map((i) => {
                const lacking = i.price - data.stars.balance
                const needsPet = (i.kind === 'petcostume') && !data.petHatched
                const name = itemName(t.world, i.id, i.name)
                return (
                  <li key={i.id} className={cx('flex flex-col items-center gap-2 rounded-card border-2 bg-surface p-3', i.equipped ? 'border-fg' : 'border-divider')}>
                    <div className="flex h-24 w-full items-center justify-center">
                      <Thumb item={i} data={data} />
                    </div>
                    <span className="text-center text-body font-bold">{name}</span>
                    {i.owned ? (
                      <Button
                        size="M"
                        variant={i.equipped ? 'primary' : 'secondary'}
                        aria-pressed={i.equipped}
                        loading={busy === i.id}
                        disabled={needsPet}
                        onClick={() => void run(i.id, () => actions.equip({ kind: i.kind, id: i.equipped && (i.kind !== 'pethome') ? null : i.id }), 'tap')}
                      >
                        {i.equipped ? (i.kind === 'pethome' ? t.world.shop.homeNow : t.world.shop.wearing) : i.kind === 'pethome' ? t.world.shop.moveIn : t.world.shop.wear}
                      </Button>
                    ) : (
                      <Button size="M" variant="primary" loading={busy === i.id} disabled={lacking > 0} aria-label={t.world.shop.buy(name, i.price)} onClick={() => void run(i.id, () => actions.buy({ id: i.id }), 'badge')}>
                        <UiIcon name="star" size={16} className="text-star" />
                        {i.price}
                      </Button>
                    )}
                    {!i.owned && lacking > 0 ? <span className="text-small text-fg-muted">{t.world.shop.lacking(lacking)}</span> : null}
                    {needsPet && i.owned ? <span className="text-small text-fg-muted">{t.world.shop.hatchFirst}</span> : null}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </LearnerFrame>
  )
}
