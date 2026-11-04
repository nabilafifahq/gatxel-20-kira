'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { CardArt, PetArt, PetHomeArt, type PetArtKind } from '@kira/figures'
import type { CardDTO, Rarity, StarsDTO } from '@/lib/dto-world'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { playSfx } from '../sfx'

/** Bagian bersama layar Kira World. */

const TABS = [
  { href: '/world', label: 'Home', key: 'home' },
  { href: '/world/friend', label: 'Friend', key: 'friend' },
  { href: '/world/shop', label: 'Star Shop', key: 'shop' },
  { href: '/world/cards', label: 'Cards', key: 'cards' },
  { href: '/world/story', label: 'Story', key: 'story' },
  { href: '/world/boss', label: 'Puzzle Robot', key: 'boss' },
  { href: '/world/trophies', label: 'Trophies', key: 'trophies' },
] as const
export type WorldTab = (typeof TABS)[number]['key']

export function WorldTabs({ current }: { current: WorldTab }): ReactElement {
  return (
    <nav aria-label="Kira World" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

export function StarCount({ stars, className }: { stars: StarsDTO; className?: string }): ReactElement {
  return (
    <span className={cx('inline-flex h-11 items-center gap-2 rounded-pill border-2 border-fg bg-surface px-4 text-body-lg font-bold tabular-nums', className)}>
      <UiIcon name="star" size={22} className="text-star" />
      <span>
        {stars.balance}
        <span className="visually-hidden"> stars to spend</span>
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
const TONE_BACK: Record<CardDTO['tone'], string> = {
  math: 'bg-math',
  english: 'bg-english',
  science: 'bg-science',
  mental: 'bg-mental',
  knowledge: 'bg-knowledge',
  warn: 'bg-warn',
}
const RARITY_STARS: Record<Rarity, number> = { common: 1, rare: 2, epic: 3, legendary: 4 }
export const RARITY_WORD: Record<Rarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }

export function RarityMark({ rarity }: { rarity: Rarity }): ReactElement {
  return (
    <span className="inline-flex items-center gap-1 text-small font-bold">
      <span aria-hidden className="inline-flex">
        {Array.from({ length: RARITY_STARS[rarity] }, (_, i) => (
          <UiIcon key={i} name="star" size={14} className="text-star" />
        ))}
      </span>
      {RARITY_WORD[rarity]}
    </span>
  )
}

export type CardFace = Pick<CardDTO, 'id' | 'no' | 'name' | 'rarity' | 'art' | 'tone'> & { fact?: string | null }

/** Kartu koleksi. Epic dan legendary berkilau holografik. `back` menampilkan sisi belakang bernomor. */
export function CollectCard({ card, total, back = false, big = false, className }: { card: CardFace; total: number; back?: boolean; big?: boolean; className?: string }): ReactElement {
  const no = `${String(card.no).padStart(2, '0')} / ${total}`
  const shiny = !back && (card.rarity === 'epic' || card.rarity === 'legendary')
  if (back) {
    return (
      <div className={cx('kw-card flex aspect-[5/7] w-full flex-col items-center justify-between rounded-card border-2 border-fg p-3 text-white', TONE_BACK[card.tone], className)} data-rarity="common">
        <span className="text-small font-bold tracking-wide uppercase">Kira cards</span>
        <span className="flex flex-col items-center gap-1">
          <UiIcon name="cards" size={big ? 56 : 40} strokeWidth={2} />
          <span className="font-display text-h1 leading-none font-bold tabular-nums">{String(card.no).padStart(2, '0')}</span>
        </span>
        <span className="text-small font-bold tabular-nums">{no}</span>
      </div>
    )
  }
  return (
    <div
      data-rarity={card.rarity}
      className={cx('kw-card flex aspect-[5/7] w-full flex-col rounded-card border-2 border-fg bg-surface', shiny && 'kw-holo', card.rarity === 'legendary' && 'kw-sheen', className)}
    >
      <div className="flex items-center justify-between px-3 pt-2 text-small font-bold tabular-nums">
        <span>No. {no}</span>
      </div>
      <div className={cx('mx-2.5 mt-1 flex flex-1 items-center justify-center rounded-control border-2 border-fg', TONE_BG[card.tone])}>
        <CardArt art={card.art} size={big ? 148 : 84} />
      </div>
      <div className="flex flex-col gap-0.5 px-3 pt-2 pb-2.5">
        <span className={cx('font-bold', big ? 'text-h3' : 'text-body leading-5')}>{card.name}</span>
        <RarityMark rarity={card.rarity} />
      </div>
    </div>
  )
}

/** Teman dengan rumahnya. Ketuk teman untuk membuatnya melompat dan mengeluarkan hati. */
export function PetStage({ kind, stage, costume, home, name, line, happy, onPat, size = 190 }: { kind: string; stage: 1 | 2 | 3; costume: string | null; home: string; name: string; line?: string; happy?: boolean; onPat?: () => void; size?: number }): ReactElement {
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
      <PetHomeArt id={home} width={560} className="block h-auto w-full" />
      <div className="absolute inset-x-0 bottom-0 flex justify-center pb-1">
        <button type="button" onClick={pat} aria-label={`Pet ${name}`} className="relative flex min-h-14 min-w-14 cursor-pointer items-end justify-center border-0 bg-transparent p-0">
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
      {line ? (
        <p role="status" className="absolute top-3 left-3 m-0 max-w-[70%] rounded-card border-2 border-fg bg-surface px-3.5 py-2 text-body font-bold">
          {line}
        </p>
      ) : null}
    </div>
  )
}
