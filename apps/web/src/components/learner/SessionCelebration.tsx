'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { Avatar } from '@kira/figures'
import type { AvatarName, XpBarDTO } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { confettiFor, starsFor, xpBarView } from './celebration-logic'
import { Confetti } from './Confetti'
import { useReducedMotion } from './hooks'
import { playSfx, primeSfx } from './sfx'
import { StarGlyph } from './StreakChain'

/**
 * Perayaan akhir sesi di halaman hasil: bintang 1 sampai 3, bar XP yang terisi, dan avatar yang
 * ikut bereaksi. Confetti, bunyi, dan lompatan avatar hanya muncul sekali untuk tiap sesi di tab
 * ini (sessionStorage), jadi membuka hasil lagi dari pembahasan tidak merayakan ulang. Bukan per
 * jawaban benar. Reduced motion: tanpa confetti, tanpa lompatan, bar langsung penuh.
 */

const SEEN_PREFIX = 'kira.celebrated.'

function firstView(attemptId: string): boolean {
  try {
    const key = `${SEEN_PREFIX}${attemptId}`
    if (sessionStorage.getItem(key)) return false
    sessionStorage.setItem(key, '1')
    return true
  } catch {
    return true
  }
}

export function SessionCelebration({
  attemptId,
  avatar,
  right,
  total,
  pending,
  xpBar,
  hasNewBadge = false,
  className,
}: {
  attemptId: string
  avatar: AvatarName
  right: number
  total: number
  pending: number
  xpBar?: XpBarDTO
  hasNewBadge?: boolean
  className?: string
}): ReactElement | null {
  const stars = starsFor({ right, total, pending })
  const bar = xpBar ? xpBarView(xpBar) : null
  const reduce = useReducedMotion()
  const [play, setPlay] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [shown, setShown] = useState(bar?.from ?? 0)
  const decided = useRef(false)

  useEffect(() => {
    primeSfx()
    if (decided.current) return
    decided.current = true
    if (!firstView(attemptId)) return
    setPlay(true)
    if (confettiFor(stars)) setConfetti(true)
    playSfx('complete')
    let at = 700
    if (bar?.leveledUp) {
      window.setTimeout(() => playSfx('levelup'), at)
      at += 1100
    }
    if (hasNewBadge) window.setTimeout(() => playSfx('badge'), at)
    // Satu kali per sesi: efek ini sengaja tidak dibersihkan atau dijalankan ulang.
  }, [])

  // Bar terisi setelah jeda singkat supaya anak sempat melihatnya mulai dari posisi lama.
  const target = bar?.to ?? 0
  useEffect(() => {
    const id = window.setTimeout(() => setShown(target), reduce ? 0 : 450)
    return () => window.clearTimeout(id)
  }, [target, reduce])

  if (stars === null) return null

  const label = `${stars} of 3 stars`
  return (
    <div className={cx('flex flex-wrap items-center gap-x-5 gap-y-3 rounded-control border border-divider bg-bg p-4', className)}>
      {confetti ? <Confetti onDone={() => setConfetti(false)} /> : null}
      <div
        aria-hidden="true"
        className={cx('flex-none', play && !reduce && 'kira-hop')}
        style={{ '--kira-count': stars === 3 ? 2 : 1, '--kira-delay': '400ms' } as CSSProperties}
      >
        <Avatar name={avatar} size={72} className="h-16 w-16 md:h-18 md:w-18" />
      </div>
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-3">
        <div role="img" aria-label={label} className="flex gap-1.5">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={cx('inline-flex', n <= stars && 'kira-rise')}
              style={{ '--kira-delay': `${(n - 1) * 250}ms` } as CSSProperties}
            >
              <StarGlyph filled={n <= stars} size={44} />
            </span>
          ))}
        </div>
        {bar ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-body font-semibold">
              <span>{bar.leveledUp ? `Level ${bar.level}. You levelled up!` : `Level ${bar.level}`}</span>
              <span className="tabular-nums text-fg-muted">{bar.line}</span>
            </div>
            <span role="img" aria-label={bar.line} className="flex h-3 overflow-hidden rounded-control bg-divider">
              <span
                className="h-full w-full origin-left bg-star transition-transform duration-(--duration-celebrate) ease-kira"
                style={{ transform: `scaleX(${shown})` }}
              />
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
