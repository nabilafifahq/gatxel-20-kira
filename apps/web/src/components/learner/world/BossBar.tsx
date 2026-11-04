'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Kira, RobotArt } from '@kira/figures'
import { cx } from '@/components/ui/cx'
import { useT } from '@/lib/i18n/client'
import { playSfx } from '../sfx'

/**
 * Barisan lawan di atas runner tantangan bos: Kira di kiri, Puzzle Robot di kanan dengan bar energi.
 * Setiap jawaban benar menurunkan energi robot dan memicu efek pukulan. Jawaban salah tidak mengubah apa pun.
 */
export function BossBar({ right, total }: { right: number; total: number }): ReactElement {
  const t = useT()
  const prev = useRef(right)
  const [hits, setHits] = useState(0)
  const [ring, setRing] = useState(0)
  useEffect(() => {
    if (right > prev.current) {
      setHits((n) => n + 1)
      setRing((n) => n + 1)
      playSfx(right >= total ? 'levelup' : 'combo', { level: 2 })
    }
    prev.current = right
  }, [right, total])
  const energy = Math.max(0, 1 - right / Math.max(1, total))
  const down = energy === 0
  return (
    <div className="kw-animate mx-4 mt-2 mb-1 flex items-center gap-3 rounded-card border-2 border-fg bg-surface px-3 py-2 md:mx-8">
      <svg width="64" height="64" viewBox="0 0 80 90" aria-hidden className="flex-none">
        <Kira x={40} y={84} s={1} />
      </svg>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-small font-bold">
          <span>{t.world.bossName}</span>
          <span className="tabular-nums">{t.world.boss.energyLeft(Math.round(energy * 100))}</span>
        </div>
        <div role="progressbar" aria-label={t.world.boss.energy} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(energy * 100)} className="h-4 overflow-hidden rounded-pill border-2 border-fg bg-divider">
          <span className="block h-full w-full origin-left bg-science transition-transform duration-500 ease-kira" style={{ transform: `scaleX(${energy})` }} />
        </div>
        <p className="m-0 text-small text-fg-muted" aria-live="polite">
          {down ? t.world.boss.poweredDown : right === 0 ? t.world.boss.answerToStart : t.world.boss.hits(right)}
        </p>
      </div>
      <div className="relative flex-none">
        <span key={`r${ring}`} aria-hidden className={cx('absolute inset-0 rounded-pill bg-star/40', ring > 0 && 'kw-flash-ring')} />
        <span key={`h${hits}`} className={cx('block', hits > 0 && 'kw-hit')}>
          <RobotArt size={72} energy={energy} hurt={down} />
        </span>
      </div>
    </div>
  )
}
