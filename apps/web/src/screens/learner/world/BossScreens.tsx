'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { CardArt, Kira, RobotArt } from '@kira/figures'
import { CARD_COUNT } from '@kira/core'
import type { BossDTO, BossResultDTO } from '@/lib/dto-world'
import { ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { Confetti } from '@/components/learner/Confetti'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { playSfx } from '@/components/learner/sfx'
import { CollectCard, RarityMark, WorldTabs } from '@/components/learner/world/parts'

/** Layar lawan: Kira dan Puzzle Robot masuk dari dua sisi, lalu tombol mulai. */
export function BossScreen({ data }: { data: BossDTO }): ReactElement {
  useEffect(() => {
    playSfx('whoosh')
  }, [])
  return (
    <LearnerFrame shell={data.shell} current="world" className="flex flex-col gap-4 md:gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-h1 font-bold">Puzzle Robot</h1>
        <p className="m-0 text-body-lg text-fg-muted">A friendly challenge every week. Answer {data.questions} mixed questions at your level and power the robot down.</p>
      </header>
      <WorldTabs current="boss" />
      <section aria-label="Face off" className="kw-animate overflow-hidden rounded-card border-2 border-fg bg-knowledge-50">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 px-3 pt-6 pb-4 md:px-10">
          <div className="kw-enter-left flex flex-col items-center gap-2">
            <svg viewBox="0 0 80 90" className="w-28 md:w-40" aria-label="Kira">
              <Kira x={40} y={84} s={1.2} />
            </svg>
            <span className="rounded-pill border-2 border-fg bg-surface px-3 py-1 text-body font-bold">{data.shell.name}</span>
          </div>
          <span aria-hidden className="mb-14 font-display text-h1 font-bold">VS</span>
          <div className="kw-enter-right flex flex-col items-center gap-2">
            <RobotArt size={160} title="Puzzle Robot" className="w-28 md:w-40" />
            <span className="rounded-pill border-2 border-fg bg-surface px-3 py-1 text-body font-bold">Puzzle Robot</span>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t-2 border-fg bg-surface p-4 md:p-6">
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-body-lg">
            <li>Each right answer drains the robot&rsquo;s energy.</li>
            <li>Get at least {data.winAt} out of every {data.questions} right (70 percent) to win. A wrong answer costs nothing, and you can try as many times as you like.</li>
            <li>
              Win to earn {data.winStars} stars{data.prize ? ' and a collector card' : ''}. {data.wonThisWeek ? 'You already beat the robot this week, so play again just for fun.' : ''}
            </li>
          </ul>
          {data.prize ? (
            <div className="flex items-center gap-3 rounded-card border-2 border-dashed border-border p-3">
              <span className="flex h-16 w-16 flex-none items-center justify-center rounded-control border-2 border-fg bg-mental-50">
                <CardArt art={data.prize.art} size={48} />
              </span>
              <span className="flex flex-col">
                <span className="text-body font-bold">This week&rsquo;s prize card: {data.prize.name}</span>
                <RarityMark rarity={data.prize.rarity} />
              </span>
            </div>
          ) : null}
          <ButtonLink href="/world/boss/start" prefetch={false} iconAfter="arrow-right" className="w-full md:w-auto md:self-start">
            {data.tries > 0 ? 'Challenge the robot again' : 'Start the challenge'}
          </ButtonLink>
        </div>
      </section>
    </LearnerFrame>
  )
}

/** Hasil: bar energi turun, robot padam, lalu kartu langka berbalik dengan kilau holografik. */
export function BossResultScreen({ data }: { data: BossResultDTO }): ReactElement {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => { setStage(1); playSfx('combo', { level: 3 }) }, 500)
    const t2 = setTimeout(() => { setStage(2); playSfx(data.won ? 'levelup' : 'tap') }, 1500)
    const t3 = setTimeout(() => { setStage(3); if (data.card) playSfx('chest') }, 2800)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [data.won, data.card])
  const left = Math.max(0, 1 - data.correct / Math.max(1, data.total))
  const energy = stage >= 1 ? left : 1
  return (
    <LearnerFrame shell={data.shell} current="world" className="flex flex-col gap-4 md:gap-5">
      {data.won && stage >= 2 ? <Confetti /> : null}
      <section aria-label="Result" className="kw-animate flex flex-col items-center gap-4 rounded-card border-2 border-fg bg-knowledge-50 p-5 text-center md:p-8">
        <div className={cx(stage >= 1 && 'kw-hit')} key={`s${stage >= 1}`}>
          <RobotArt size={170} energy={energy} hurt={stage >= 1} title="Puzzle Robot" />
        </div>
        <div className="w-full max-w-[420px]">
          <div className="mb-1 flex justify-between text-small font-bold">
            <span>Robot energy</span>
            <span className="tabular-nums">{Math.round(energy * 100)}%</span>
          </div>
          <div role="progressbar" aria-label="Robot energy" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(energy * 100)} className="h-5 overflow-hidden rounded-pill border-2 border-fg bg-divider">
            <span className="block h-full w-full origin-left bg-science transition-transform duration-[1200ms] ease-kira" style={{ transform: `scaleX(${energy})` }} />
          </div>
        </div>
        <h1 className="m-0 text-h1 font-bold">{data.won ? 'You beat the Puzzle Robot!' : 'So close!'}</h1>
        <p className="m-0 max-w-[520px] text-body-lg">
          {data.correct} of {data.total} right.{' '}
          {data.won ? (data.stars > 0 ? `You earned ${data.stars} stars.` : 'You already earned this week’s prize, and now you have played again for fun.') : `You need ${data.winAt} to win. The robot will wait, and nothing was lost. Try again whenever you like.`}
        </p>
      </section>
      {data.won && data.card && stage >= 3 ? (
        <section aria-label="Your new card" className="flex flex-col items-center gap-3 rounded-card border-2 border-fg bg-surface p-5 text-center">
          <h2 className="m-0 text-h2 font-bold">A new collector card!</h2>
          <div className="kw-flip w-56 max-w-full">
            <CollectCard card={{ ...data.card, tone: 'mental' }} total={CARD_COUNT} big />
          </div>
          <RarityMark rarity={data.card.rarity} />
          <p className="m-0 max-w-[460px] text-body-lg">{data.card.fact}</p>
        </section>
      ) : null}
      {data.won && data.stars > 0 ? (
        <p className="m-0 inline-flex items-center justify-center gap-2 text-h3 font-bold">
          <UiIcon name="star" size={26} className="text-star" /> +{data.stars} stars
        </p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href="/world/boss/start" prefetch={false} variant="secondary">
          Play again
        </ButtonLink>
        <ButtonLink href="/world/cards" variant="secondary">
          See my cards
        </ButtonLink>
        <ButtonLink href="/today" iconAfter="arrow-right">
          Back to Today
        </ButtonLink>
      </div>
    </LearnerFrame>
  )
}
