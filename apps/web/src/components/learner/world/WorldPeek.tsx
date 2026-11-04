'use client'

import Link from 'next/link'
import type { ReactElement } from 'react'
import { EggArt, PetArt, type PetArtKind } from '@kira/figures'
import type { WorldPeekDTO } from '@/lib/dto-world'
import { UiIcon } from '@/components/ui/icons'
import { useT } from '@/lib/i18n/client'

/** Kartu kecil di Today: bintang dan teman. Teman selalu menyapa dengan senang, juga setelah libur. */
export function WorldPeek({ world }: { world: WorldPeekDTO }): ReactElement {
  const t = useT()
  const line = world.pet ? world.pet.greeting : world.canHatch ? t.world.peek.eggReady : t.world.peek.earnToHatch
  return (
    <Link href="/world" prefetch={false} aria-label={t.world.peek.label(world.stars.balance, line)} className="kw-animate flex items-center gap-3 rounded-card border-2 border-fg bg-science-50 px-3 py-2 text-fg no-underline">
      {world.pet ? <PetArt kind={world.pet.kind as PetArtKind} stage={world.pet.stage} costume={world.pet.costume} size={64} /> : <EggArt cracked={world.canHatch} size={64} />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body font-bold">{line}</span>
        <span className="inline-flex items-center gap-1 text-small font-bold tabular-nums">
          <UiIcon name="star" size={16} className="text-star" />
          {t.world.peek.starsToSpend(world.stars.balance)}
        </span>
      </span>
      <UiIcon name="arrow-right" size={20} />
    </Link>
  )
}
