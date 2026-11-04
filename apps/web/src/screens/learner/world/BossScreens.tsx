'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { BossArt, CardArt, Kira } from '@kira/figures'
import { CARD_COUNT, bossEnergy } from '@kira/core'
import type { BossDTO, BossResultDTO, BossRowDTO } from '@/lib/dto-world'
import { ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { Confetti } from '@/components/learner/Confetti'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { playSfx } from '@/components/learner/sfx'
import { CollectCard, RarityMark, WorldTabs, scrollMotion } from '@/components/learner/world/parts'
import { useT } from '@/lib/i18n/client'
import { bossText } from '@/lib/i18n/dict/bosses'

function LevelMark({ level }: { level: 1 | 2 | 3 }): ReactElement {
  const t = useT()
  return (
    <span className="inline-flex items-center gap-1 text-small font-bold">
      <span aria-hidden className="inline-flex">
        {Array.from({ length: level }, (_, i) => (
          <UiIcon key={i} name="bolt" size={14} />
        ))}
      </span>
      {t.world.boss.level(level)}
    </span>
  )
}

/** Papan lawan: Kira dan lawan masuk dari dua sisi, kelemahan dan hadiah terlihat, lalu tombol mulai. */
function FaceOff({ boss: row, name, wonThisWeek, winStars }: { boss: BossRowDTO; name: string; wonThisWeek: boolean; winStars: number }): ReactElement {
  const t = useT()
  const b = t.world.boss
  const boss = bossText(t.bosses, row.id, row)
  return (
    <section aria-label={b.faceOff} className="kw-animate overflow-hidden rounded-card border-2 border-fg bg-knowledge-50">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 px-3 pt-6 pb-4 md:px-10">
        <div className="kw-enter-left flex flex-col items-center gap-2">
          <svg viewBox="0 0 80 90" className="w-24 md:w-36" aria-label="Kira">
            <Kira x={40} y={84} s={1.2} />
          </svg>
          <span className="rounded-pill border-2 border-fg bg-surface px-3 py-1 text-body font-bold">{name}</span>
        </div>
        <span aria-hidden className="mb-14 font-display text-h1 font-bold">
          VS
        </span>
        <div key={boss.id} className="kw-enter-right flex flex-col items-center gap-2">
          <BossArt id={boss.id} size={160} title={boss.name} className="w-28 md:w-40" />
          <span className="rounded-pill border-2 border-fg bg-surface px-3 py-1 text-center text-body font-bold">{boss.name}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t-2 border-fg bg-surface p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="m-0 text-h2 font-bold">{boss.epithet}</h2>
          <LevelMark level={boss.level} />
        </div>
        <p className="m-0 rounded-card border-2 border-fg bg-bg px-3.5 py-2 font-reading text-body-lg">{boss.intro}</p>
        <p className="m-0 text-body-lg">{boss.personality}</p>
        <p className="m-0 inline-flex flex-wrap items-center gap-2 text-body-lg">
          <span className="rounded-pill bg-danger-50 px-3 py-1 text-small font-bold text-danger">{b.weakAgainst}</span>
          <strong>{boss.weakness}</strong>
        </p>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-body-lg">
          <li>{b.ruleHits(boss.winAt, boss.questions)}</li>
          <li>{b.ruleSafe}</li>
          <li>{wonThisWeek ? b.alreadyEarned : b.firstWinStars(winStars)}</li>
        </ul>
        {boss.prize ? (
          <div className="flex items-center gap-3 rounded-card border-2 border-dashed border-border p-3">
            <span className="flex h-16 w-16 flex-none items-center justify-center rounded-control border-2 border-fg bg-mental-50">
              <CardArt art={boss.prize.art} size={48} />
            </span>
            <span className="flex flex-col">
              <span className="text-body font-bold">{b.firstWinPrize(boss.prize.name)}</span>
              <RarityMark rarity={boss.prize.rarity} />
            </span>
          </div>
        ) : null}
        <ButtonLink href={`/world/boss/start?b=${boss.id}`} prefetch={false} iconAfter="arrow-right" className="w-full md:w-auto md:self-start">
          {boss.wins > 0 ? b.rematchName(boss.name) : b.start}
        </ButtonLink>
      </div>
    </section>
  )
}

export function BossScreen({ data }: { data: BossDTO }): ReactElement {
  const t = useT()
  const copy = t.world.boss
  const openBosses = data.bosses.filter((b) => b.open)
  const [picked, setPicked] = useState(data.spotlight ?? openBosses[0]?.id ?? null)
  const boss = openBosses.find((b) => b.id === picked) ?? openBosses[0] ?? null
  useEffect(() => {
    playSfx('whoosh')
  }, [])
  const pick = (id: string) => {
    playSfx('whoosh')
    setPicked(id)
    window.scrollTo({ top: 0, behavior: scrollMotion() })
  }
  return (
    <LearnerFrame shell={data.shell} current="world" className="flex flex-col gap-4 md:gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-h1 font-bold">{copy.title}</h1>
        <p className="m-0 text-body-lg text-fg-muted">{copy.intro(data.beaten, data.bosses.length)}</p>
      </header>
      <WorldTabs current="boss" />
      {boss ? <FaceOff boss={boss} name={data.shell.name} wonThisWeek={data.wonThisWeek} winStars={data.winStars} /> : <p className="m-0 text-body-lg">{copy.resting}</p>}
      {data.bosses.length > 0 ? (
        <section aria-label={copy.allBosses} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="m-0 text-h2 font-bold">{copy.challengers}</h2>
            {data.nextIn !== null ? (
              <span className="text-body text-fg-muted">{copy.nextIn(data.nextIn)}</span>
            ) : null}
          </div>
          <ul className="kw-animate m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4">
            {data.bosses.map((b) => (
              <li key={b.id}>
                {b.open ? (
                  <button
                    type="button"
                    onClick={() => pick(b.id)}
                    aria-pressed={b.id === boss?.id}
                    className={cx('flex min-h-14 w-full cursor-pointer flex-col items-center gap-1.5 rounded-card border-2 p-3 text-center', b.id === boss?.id ? 'border-fg bg-knowledge-50' : 'border-border bg-surface hover:border-fg')}
                  >
                    <BossArt id={b.id} size={84} hurt={false} />
                    <span className="text-body font-bold">{b.name}</span>
                    <span className="text-small text-fg-muted">{bossText(t.bosses, b.id, b).weakness}</span>
                    {b.wins > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-success-50 px-2.5 py-0.5 text-small font-bold text-success">
                        <UiIcon name="check" size={13} strokeWidth={3} /> {copy.beaten(b.wins)}
                      </span>
                    ) : (
                      <LevelMark level={b.level} />
                    )}
                  </button>
                ) : (
                  <div className="flex w-full flex-col items-center gap-1.5 rounded-card border-2 border-dashed border-border bg-surface p-3 text-center">
                    <span aria-hidden className="opacity-30 brightness-0">
                      <BossArt id={b.id} size={84} />
                    </span>
                    <span className="text-body font-bold text-fg-muted">{copy.newChallenger}</span>
                    <LevelMark level={b.level} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </LearnerFrame>
  )
}

/** Hasil: bar tenaga turun, lawan tumbang, lalu kartu langka berbalik dengan kilau holografik. Kalah tidak mengurangi apa pun. */
export function BossResultScreen({ data }: { data: BossResultDTO }): ReactElement {
  const t = useT()
  const copy = t.world.boss
  const bossLines = bossText(t.bosses, data.boss.id, data.boss)
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => {
      setStage(1)
      playSfx('combo', { level: 3 })
    }, 500)
    const t2 = setTimeout(() => {
      setStage(2)
      playSfx(data.won ? 'levelup' : 'tap')
    }, 1500)
    const t3 = setTimeout(() => {
      setStage(3)
      if (data.card) playSfx('chest')
    }, 2800)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [data.won, data.card])
  const left = bossEnergy(data.correct, data.total)
  const energy = stage >= 1 ? left : 1
  const pct = Math.round(energy * 100)
  const line = data.won ? bossLines.defeat : bossLines.rematch
  return (
    <LearnerFrame shell={data.shell} current="world" className="flex flex-col gap-4 md:gap-5">
      {data.won && stage >= 2 ? <Confetti /> : null}
      <section aria-label={copy.result} className="kw-animate flex flex-col items-center gap-4 rounded-card border-2 border-fg bg-knowledge-50 p-5 text-center md:p-8">
        <div className={cx(stage >= 1 && !data.won && 'kw-hit', stage >= 2 && data.won && 'kw-ko')} key={`s${stage >= 1}${stage >= 2}`}>
          <BossArt id={data.boss.id} size={170} energy={energy} hurt={stage >= 1 && data.won} title={data.boss.name} />
        </div>
        <div className="w-full max-w-[420px]">
          <div className="mb-1 flex justify-between text-small font-bold">
            <span>{data.boss.name}</span>
            <span className="tabular-nums">{copy.energy(pct)}</span>
          </div>
          <div role="progressbar" aria-label={copy.energyOf(data.boss.name)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-5 overflow-hidden rounded-pill border-2 border-fg bg-divider">
            <span className="block h-full w-full origin-left bg-success transition-transform duration-[1200ms] ease-kira" style={{ transform: `scaleX(${energy})` }} />
          </div>
        </div>
        <h1 className="m-0 text-h1 font-bold">{data.won ? copy.youBeat(data.boss.name) : copy.soClose}</h1>
        <p className="m-0 max-w-[520px] rounded-card border-2 border-fg bg-surface px-3.5 py-2 font-reading text-body-lg">{line}</p>
        <p className="m-0 max-w-[520px] text-body-lg">
          {copy.score(data.correct, data.total)}{' '}
          {data.won ? (data.stars > 0 ? copy.earned(data.stars) : data.card ? copy.earnedCard : copy.playedAgain) : copy.needToWin(data.winAt)}
        </p>
      </section>
      {data.won && data.card && stage >= 3 ? (
        <section aria-label={copy.newCardLabel} className="flex flex-col items-center gap-3 rounded-card border-2 border-fg bg-surface p-5 text-center">
          <h2 className="m-0 text-h2 font-bold">{copy.newRareCard}</h2>
          <div className="kw-flip w-56 max-w-full">
            <CollectCard card={{ ...data.card, tone: 'mental' }} total={CARD_COUNT} big />
          </div>
          <RarityMark rarity={data.card.rarity} />
          <p lang="en-GB" className="m-0 max-w-[460px] text-body-lg">{data.card.fact}</p>
        </section>
      ) : null}
      {data.won && data.stars > 0 ? (
        <p className="m-0 inline-flex items-center justify-center gap-2 text-h3 font-bold">
          <UiIcon name="star" size={26} className="text-star" /> {t.world.plusStars(data.stars)}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href={`/world/boss/start?b=${data.boss.id}`} prefetch={false} variant={data.won ? 'secondary' : 'primary'}>
          {data.won ? copy.playAgain : copy.friendlyRematch}
        </ButtonLink>
        <ButtonLink href="/world/boss" variant="secondary">
          {copy.allBosses}
        </ButtonLink>
        <ButtonLink href="/world/cards" variant="secondary">
          {copy.seeCards}
        </ButtonLink>
        <ButtonLink href="/today" iconAfter="arrow-right" variant="secondary">
          {copy.backToToday}
        </ButtonLink>
      </div>
    </LearnerFrame>
  )
}
