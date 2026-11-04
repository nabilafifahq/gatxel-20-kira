'use client'

import Link from 'next/link'
import type { ReactElement } from 'react'
import { EggArt, PetArt, type PetArtKind } from '@kira/figures'
import type { WorldHubDTO } from '@/lib/dto-world'
import { UiIcon, type UiIconName } from '@/components/ui/icons'
import { useT } from '@/lib/i18n/client'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { WorldTabs } from '@/components/learner/world/parts'

function Tile({ href, icon, title, line }: { href: string; icon: UiIconName; title: string; line: string }): ReactElement {
  return (
    <Link href={href} prefetch={false} className="flex min-h-20 items-center gap-3.5 rounded-card border-2 border-fg bg-surface p-4 text-fg no-underline hover:bg-bg">
      <span className="flex h-12 w-12 flex-none items-center justify-center rounded-pill bg-fg text-white">
        <UiIcon name={icon} size={24} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-h3 font-bold">{title}</span>
        <span className="text-body text-fg-muted">{line}</span>
      </span>
      <UiIcon name="arrow-right" size={20} />
    </Link>
  )
}

export function HubScreen({ data }: { data: WorldHubDTO }): ReactElement {
  const t = useT()
  return (
    <LearnerFrame shell={data.shell} current="world" className="flex flex-col gap-4 md:gap-5">
      <header className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="m-0 text-h1 font-bold">{t.world.name}</h1>
          <p className="m-0 text-body-lg text-fg-muted">{t.world.hub.intro}</p>
        </div>
        <p className="m-0 inline-flex items-center gap-2 rounded-pill border-2 border-fg bg-surface px-5 py-2 text-h2 font-bold tabular-nums">
          <UiIcon name="star" size={30} className="text-star" />
          {data.stars.balance}
          <span className="visually-hidden"> {t.world.starsToSpend}</span>
        </p>
      </header>
      <WorldTabs current="home" />
      <Link href="/world/friend" prefetch={false} className="kw-animate flex items-center gap-4 rounded-card border-2 border-fg bg-science-50 p-4 text-fg no-underline">
        {data.pet ? <PetArt kind={data.pet.kind as PetArtKind} stage={data.pet.stage} costume={data.pet.costume} size={110} /> : <EggArt cracked={data.petState === 'ready'} size={110} />}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-h2 font-bold">{data.pet ? data.pet.name : data.petState === 'ready' ? t.world.hub.eggReady : t.world.pet.mysteryEgg}</span>
          <span className="text-body-lg">
            {data.pet ? data.pet.greeting : data.petState === 'ready' ? t.world.hub.tapToHatch : t.world.hub.earnToHatch(data.hatchAt)}
          </span>
        </span>
        <UiIcon name="arrow-right" size={22} />
      </Link>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Tile href="/world/shop" icon="gift" title={t.world.shopName} line={t.world.hub.shopLine} />
        <Tile href="/world/cards" icon="cards" title={t.world.hub.albumTitle} line={t.world.hub.cardsEarned(data.cards.owned, data.cards.total)} />
        <Tile href="/world/story" icon="book" title={t.world.hub.storyTitle} line={t.world.hub.chaptersOpen(data.story.open, data.story.total)} />
        <Tile href="/world/boss" icon="bolt" title={t.world.bossName} line={data.boss.wonThisWeek ? t.world.hub.bossWon : t.world.hub.bossLine} />
        <Tile href="/world/trophies" icon="trophy" title={t.world.hub.trophyTitle} line={t.world.hub.trophyLine} />
      </div>
      <p className="m-0 text-small text-fg-muted">{t.world.hub.starsFrom}</p>
    </LearnerFrame>
  )
}
