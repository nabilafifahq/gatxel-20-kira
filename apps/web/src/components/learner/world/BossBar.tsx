'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { BOSSES, bossById, bossEnergy, bossLine, bossWinAt } from '@kira/core'
import { BossArt, Kira } from '@kira/figures'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { playSfx } from '../sfx'

type Fx = { kind: 'hit' | 'taunt'; n: number; line: string }

/**
 * Barisan lawan di atas runner tantangan bos: Kira di kiri, lawan di kanan dengan bar tenaga bersegmen. Satu segmen
 * untuk satu pukulan, dan tenaga habis tepat saat jawaban benar cukup untuk menang. Jawaban benar memicu bintang yang
 * terbang, lawan terguncang, dan bunyi. Jawaban salah hanya membuat lawan bercanda: tidak ada yang berkurang.
 */
export function BossBar({ bossId, right, wrong, total }: { bossId: string; right: number; wrong: number; total: number }): ReactElement {
  const def = bossById(bossId) ?? BOSSES[0]!
  const hitsToWin = bossWinAt(total)
  const energy = bossEnergy(right, total)
  const down = energy === 0
  const prevRight = useRef(right)
  const prevWrong = useRef(wrong)
  const [fx, setFx] = useState<Fx | null>(null)
  const count = useRef(0)
  useEffect(() => {
    if (right > prevRight.current) {
      count.current += 1
      setFx({ kind: 'hit', n: count.current, line: bossLine(def.hits, right - 1) })
      const left = hitsToWin - right
      if (left === 0) playSfx('levelup')
      else playSfx('combo', { level: left === 1 ? 3 : right >= 2 ? 2 : 1 })
    } else if (wrong > prevWrong.current) {
      count.current += 1
      setFx({ kind: 'taunt', n: count.current, line: bossLine(def.attacks, wrong - 1) })
    }
    prevRight.current = right
    prevWrong.current = wrong
  }, [right, wrong, def, hitsToWin])
  const pct = Math.round(energy * 100)
  const line = down
    ? `${def.name} has no energy left! Finish your last questions to see your prize.`
    : fx
      ? fx.line
      : `${def.intro} Right answers power your attacks. A wrong answer costs nothing.`
  return (
    <div className="kw-animate mx-4 mt-2 mb-1 flex items-center gap-3 rounded-card border-2 border-fg bg-surface px-3 py-2 md:mx-8">
      <svg width="58" height="64" viewBox="0 0 80 90" aria-hidden className="flex-none">
        <Kira x={40} y={84} s={1} />
      </svg>
      <div className="relative flex min-w-0 flex-1 flex-col gap-1.5">
        {fx?.kind === 'hit' ? (
          <span key={`z${fx.n}`} aria-hidden className="kw-zap pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end">
            <UiIcon name="star" size={26} className="text-star" />
          </span>
        ) : null}
        <div className="flex items-baseline justify-between gap-2 text-small font-bold">
          <span className="min-w-0 truncate">{def.name}</span>
          <span className="flex-none tabular-nums">
            {pct}%<span className="visually-hidden"> energy</span>
          </span>
        </div>
        <div role="progressbar" aria-label={`${def.name} energy`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="flex h-4 gap-0.5 overflow-hidden rounded-pill border-2 border-fg bg-divider">
          {Array.from({ length: hitsToWin }, (_, i) => (
            <span key={i} className={cx('h-full flex-1 transition-opacity duration-300', i < hitsToWin - right ? (energy <= 0.34 ? 'bg-danger' : energy <= 0.67 ? 'bg-star' : 'bg-success') : 'opacity-0')} />
          ))}
        </div>
        <p className="m-0 text-small text-fg-muted" aria-live="polite">
          {line}
        </p>
      </div>
      <div className="relative flex-none">
        {fx?.kind === 'hit' ? <span key={`r${fx.n}`} aria-hidden className="kw-flash-ring absolute inset-0 rounded-pill bg-star/40" /> : null}
        <span key={`h${fx?.n ?? 0}`} className={cx('block', fx?.kind === 'hit' && 'kw-hit', fx?.kind === 'taunt' && 'kw-hop', down && 'kw-ko')}>
          <BossArt id={def.id} size={72} energy={energy} hurt={down || fx?.kind === 'hit'} />
        </span>
      </div>
    </div>
  )
}
