'use client'

import { useState, type ReactElement } from 'react'
import { Avatar, FrameThumb, PetCostumeThumb, PetHomeArt } from '@kira/figures'
import type { ActionResult } from '@/lib/dto'
import type { ShopDTO, ShopItemDTO } from '@/lib/dto-world'
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

const SECTIONS: { kind: ShopItemDTO['kind']; title: string; blurb: string }[] = [
  { kind: 'pethome', title: 'Homes for your friend', blurb: 'A cosy place for your friend to live.' },
  { kind: 'petcostume', title: 'Friend costumes', blurb: 'Dress up your friend.' },
  { kind: 'outfit', title: 'Avatar outfits', blurb: 'Hats and crowns for your avatar.' },
  { kind: 'frame', title: 'Profile frames', blurb: 'A ring around your picture.' },
  { kind: 'backdrop', title: 'Backgrounds', blurb: 'A colourful backdrop for your avatar.' },
]

function Thumb({ item, data }: { item: ShopItemDTO; data: ShopDTO }): ReactElement {
  const { shell } = data
  if (item.kind === 'pethome') return <PetHomeArt id={item.id} width={150} className="rounded-control" />
  if (item.kind === 'petcostume') return <PetCostumeThumb id={item.id} size={80} />
  if (item.kind === 'frame') return <FrameThumb id={item.id} size={80} />
  if (item.kind === 'outfit') return <Avatar name={shell.avatar} size={80} accessory={item.id} />
  return <Avatar name={shell.avatar} size={80} background={item.id} />
}

export function ShopScreen({ data, actions }: { data: ShopDTO; actions: ShopActions }): ReactElement {
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
      setMessage('That did not work. Check the internet and try again.')
    } finally {
      setBusy(null)
    }
  }
  return (
    <LearnerFrame shell={data.shell} current="world" className="flex flex-col gap-4 md:gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="m-0 text-h1 font-bold">Star Shop</h1>
          <p className="m-0 text-body-lg text-fg-muted">Spend the stars you earned. Prices never change and there is no timer.</p>
        </div>
        <StarCount stars={data.stars} />
      </header>
      <WorldTabs current="shop" />
      {message ? <p role="alert" className="m-0 rounded-card border-2 border-danger bg-danger-50 p-3 text-body font-bold">{message}</p> : null}
      {SECTIONS.map((s) => {
        const items = data.items.filter((i) => i.kind === s.kind)
        if (items.length === 0) return null
        return (
          <section key={s.kind} aria-label={s.title} className="flex flex-col gap-3">
            <div>
              <h2 className="m-0 text-h2 font-bold">{s.title}</h2>
              <p className="m-0 text-body text-fg-muted">{s.blurb}</p>
            </div>
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3 xl:grid-cols-4">
              {items.map((i) => {
                const lacking = i.price - data.stars.balance
                const needsPet = (i.kind === 'petcostume') && !data.petHatched
                return (
                  <li key={i.id} className={cx('flex flex-col items-center gap-2 rounded-card border-2 bg-surface p-3', i.equipped ? 'border-fg' : 'border-divider')}>
                    <div className="flex h-24 items-center justify-center">
                      <Thumb item={i} data={data} />
                    </div>
                    <span className="text-center text-body font-bold">{i.name}</span>
                    {i.owned ? (
                      <Button
                        size="M"
                        variant={i.equipped ? 'primary' : 'secondary'}
                        aria-pressed={i.equipped}
                        loading={busy === i.id}
                        disabled={needsPet}
                        onClick={() => void run(i.id, () => actions.equip({ kind: i.kind, id: i.equipped && (i.kind !== 'pethome') ? null : i.id }), 'tap')}
                      >
                        {i.equipped ? (i.kind === 'pethome' ? 'Home now' : 'Wearing') : i.kind === 'pethome' ? 'Move in' : 'Wear'}
                      </Button>
                    ) : (
                      <Button size="M" variant="primary" loading={busy === i.id} disabled={lacking > 0} aria-label={`Buy ${i.name} for ${i.price} stars`} onClick={() => void run(i.id, () => actions.buy({ id: i.id }), 'badge')}>
                        <UiIcon name="star" size={16} className="text-star" />
                        {i.price}
                      </Button>
                    )}
                    {!i.owned && lacking > 0 ? <span className="text-small text-fg-muted">{lacking} more stars</span> : null}
                    {needsPet && i.owned ? <span className="text-small text-fg-muted">Hatch your friend first</span> : null}
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
