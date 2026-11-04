'use client'

import Link from 'next/link'
import type { ReactElement } from 'react'
import { PetArt, type PetArtKind } from '@kira/figures'
import type { ResultsDTO } from '@/lib/dto'
import { UiIcon } from '@/components/ui/icons'
import { useT } from '@/lib/i18n/client'

/** Bintang Kira World dari sesi yang baru selesai, dan teman yang bersorak, di layar hasil bersama perayaan yang sudah ada. */
export function WorldGain({ world }: { world: ResultsDTO['world'] }): ReactElement | null {
  const t = useT()
  if (!world) return null
  const gained = world.stars > 0 || world.cards.length > 0
  if (!gained && !world.pet) return null
  return (
    <span className="kira-pop inline-flex flex-wrap items-center gap-3">
      {world.pet ? (
        <span className="kw-animate inline-flex items-center gap-1" title={t.world.gain.cheering(world.pet.name)}>
          <PetArt kind={world.pet.kind as PetArtKind} stage={world.pet.stage} costume={world.pet.costume} size={56} happy />
          <span className="visually-hidden">{t.world.gain.cheeringForYou(world.pet.name)}</span>
        </span>
      ) : null}
      {world.stars > 0 ? (
        <span className="inline-flex h-11 items-center gap-1.5 rounded-pill border-2 border-fg bg-surface px-4 text-body-lg font-bold tabular-nums">
          <UiIcon name="star" size={22} className="text-star" />{t.world.plusStars(world.stars)}
        </span>
      ) : null}
      {world.cards.length > 0 ? (
        <Link href="/world/cards" prefetch={false} className="inline-flex h-11 items-center gap-1.5 rounded-pill border-2 border-fg bg-star/30 px-4 text-body font-bold text-fg no-underline">
          <UiIcon name="cards" size={20} />
          {t.world.gain.newCards(world.cards.length)}
        </Link>
      ) : null}
    </span>
  )
}
