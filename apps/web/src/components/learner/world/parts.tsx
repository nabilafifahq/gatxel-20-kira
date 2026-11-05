'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { CardArt, PetArt, PetHomeArt, type PetArtKind } from '@kira/figures'
import type { CardDTO, Rarity, StarsDTO } from '@/lib/dto-world'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { playSfx } from '../sfx'
import { useT } from '@/lib/i18n/client'

/** Bagian bersama layar Kira World. */

/** Cara gulir yang menghormati prefers-reduced-motion. */
export function scrollMotion(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

const TABS = [
  { href: '/world', key: 'home' },
  { href: '/world/friend', key: 'friend' },
  { href: '/world/shop', key: 'shop' },
  { href: '/world/cards', key: 'cards' },
  { href: '/world/story', key: 'story' },
  { href: '/world/boss', key: 'boss' },
  { href: '/world/trophies', key: 'trophies' },
] as const
export type WorldTab = (typeof TABS)[number]['key']

export function WorldTabs({ current }: { current: WorldTab }): ReactElement {
  const w = useT().world
  return (
    <nav aria-label={w.name} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          prefetch={false}
          aria-current={t.key === current ? 'page' : undefined}
          className={cx(
            'inline-flex h-11 flex-none items-center rounded-pill border-2 px-4 text-body font-bold no-underline',
            t.key === current ? 'border-fg bg-fg text-white' : 'border-border bg-surface text-fg hover:border-fg',
          )}
        >
          {w.tabs[t.key]}
        </Link>
      ))}
    </nav>
  )
}

export function StarCount({ stars, className }: { stars: StarsDTO; className?: string }): ReactElement {
  const w = useT().world
  return (
    <span className={cx('inline-flex h-11 items-center gap-2 rounded-pill border-2 border-fg bg-surface px-4 text-body-lg font-bold tabular-nums', className)}>
      <UiIcon name="star" size={22} className="text-star" />
      <span>
        {stars.balance}
        <span className="visually-hidden"> {w.starsToSpend}</span>
      </span>
    </span>
  )
}

const TONE_BG: Record<CardDTO['tone'], string> = {
  math: 'bg-math-50',
  english: 'bg-english-50',
  science: 'bg-science-50',
  mental: 'bg-mental-50',
  knowledge: 'bg-knowledge-50',
  warn: 'bg-warn-50',
}
const RARITY_STARS: Record<Rarity, number> = { common: 1, rare: 2, epic: 3, legendary: 4 }

export function RarityMark({ rarity }: { rarity: Rarity }): ReactElement {
  const w = useT().world
  return (
    <span className="inline-flex items-center gap-1 text-small font-bold">
      <span aria-hidden className="inline-flex">
        {Array.from({ length: RARITY_STARS[rarity] }, (_, i) => (
          <UiIcon key={i} name="star" size={14} className="text-fg" />
        ))}
      </span>
      {w.rarity[rarity]}
    </span>
  )
}

export type CardFace = Pick<CardDTO, 'id' | 'no' | 'name' | 'rarity' | 'art' | 'tone'> & { fact?: string | null }

/** Kartu koleksi. Epic dan legendary berkilau holografik. `back` menampilkan sisi belakang bernomor. */
export function CollectCard({ card, total, back = false, big = false, className }: { card: CardFace; total: number; back?: boolean; big?: boolean; className?: string }): ReactElement {
  const w = useT().world
  const no = `${String(card.no).padStart(3, '0')} / ${total}`
  const shiny = !back && (card.rarity === 'epic' || card.rarity === 'legendary')
  if (back) {
    return (
      <div className={cx('kw-card flex aspect-[5/7] w-full flex-col items-center justify-between rounded-card border-2 border-fg bg-fg p-3 text-white', className)} data-rarity="common">
        <span className="text-small font-bold tracking-wide uppercase">{w.album.cardBack}</span>
        <span className="flex flex-col items-center gap-1">
          <UiIcon name="cards" size={big ? 56 : 40} strokeWidth={2} />
          <span className="font-display text-h1 leading-none font-bold tabular-nums">{String(card.no).padStart(3, '0')}</span>
        </span>
        <span className="text-small font-bold tabular-nums">{no}</span>
      </div>
    )
  }
  return (
    <div
      data-rarity={card.rarity}
      className={cx('kw-card flex aspect-[5/7] min-h-fit w-full flex-col rounded-card border-2 border-fg bg-surface', shiny && 'kw-holo', card.rarity === 'legendary' && 'kw-sheen', className)}
    >
      <div className="relative z-10 flex items-center justify-between px-3 pt-2 text-small font-bold tabular-nums">
        <span>{w.album.cardNo(no)}</span>
      </div>
      <div className={cx('mx-2.5 mt-1 flex flex-1 items-center justify-center rounded-control border-2 border-fg', TONE_BG[card.tone])}>
        <CardArt art={card.art} size={big ? 148 : 84} className="h-auto w-3/4" />
      </div>
      <div className="relative z-10 flex flex-col gap-0.5 px-3 pt-2 pb-2.5">
        <span lang="en-GB" className={cx('font-bold', big ? 'text-h3' : 'text-body leading-5')}>{card.name}</span>
        <RarityMark rarity={card.rarity} />
      </div>
    </div>
  )
}

/** Teman dengan rumahnya. Ketuk teman untuk membuatnya melompat dan mengeluarkan hati. */
export function PetStage({ kind, stage, costume, home, name, line, happy, onPat, size = 190 }: { kind: string; stage: 1 | 2 | 3; costume: string | null; home: string; name: string; line?: string; happy?: boolean; onPat?: () => void; size?: number }): ReactElement {
  const w = useT().world
  const [hop, setHop] = useState(0)
  const [hearts, setHearts] = useState<number[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])
  const pat = () => {
    playSfx('tap')
    setHop((n) => n + 1)
    setHearts((h) => [...h.slice(-2), Date.now()])
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setHearts([]), 1300)
    onPat?.()
  }
  return (
    <div className="relative mx-auto w-full max-w-[560px] overflow-hidden rounded-card border-2 border-fg">
      {/* Teman menempel di dasar gambar, bukan di dasar kotak: di ponsel ucapan ada di bawah gambar dan tidak boleh tertutup. */}
      <div className="relative">
      <PetHomeArt id={home} width={560} className="block h-auto w-full" />
      <div className="absolute inset-x-0 bottom-0 flex justify-center pb-1">
        <button type="button" onClick={pat} aria-label={w.pet.patLabel(name)} className="relative flex min-h-14 min-w-14 cursor-pointer items-end justify-center border-0 bg-transparent p-0">
          <span key={hop} className={cx('kw-animate block', hop > 0 && 'kw-hop')}>
            <PetArt kind={kind as PetArtKind} stage={stage} costume={costume} size={size} {...(happy ? { happy: true } : {})} />
          </span>
          {hearts.map((h, i) => (
            <span key={h} aria-hidden className="kw-heart pointer-events-none absolute top-2 text-english" style={{ left: `${30 + i * 22}%` }}>
              <UiIcon name="star" size={22} className="text-star" />
            </span>
          ))}
        </button>
      </div>
      </div>
      {line ? (
        <p role="status" className="m-0 rounded-card border-2 border-fg bg-surface px-3.5 py-2 text-body font-bold max-sm:mt-2 sm:absolute sm:top-3 sm:left-3 sm:max-w-[70%]">
          {line}
        </p>
      ) : null}
    </div>
  )
}
