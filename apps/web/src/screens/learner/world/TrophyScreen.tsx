'use client'

import type { ReactElement } from 'react'
import { BossArt, CupArt, MedalArt, SealArt } from '@kira/figures'
import type { TrophyDTO } from '@/lib/dto-world'
import { ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { WorldTabs } from '@/components/learner/world/parts'
import { useT } from '@/lib/i18n/client'
import { setName } from '@/lib/i18n/dict/world'

function Shelf({ title, children }: { title: string; children: React.ReactNode }): ReactElement {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-card border-2 border-divider bg-surface p-4 md:p-5">
      <h2 className="m-0 text-h2 font-bold">{title}</h2>
      {children}
    </section>
  )
}

export function TrophyScreen({ data }: { data: TrophyDTO }): ReactElement {
  const w = useT().world
  const c = w.trophy
  return (
    <LearnerFrame shell={data.shell} current="world" className="flex flex-col gap-4 md:gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-h1 font-bold">{c.title}</h1>
        <p className="m-0 text-body-lg text-fg-muted">{c.intro}</p>
      </header>
      <WorldTabs current="trophies" />

      <Shelf title={c.streakShelf}>
        <ul className="m-0 grid list-none grid-cols-3 gap-3 p-0">
          {data.milestones.map((m) => (
            <li key={m.days} className={cx('flex flex-col items-center gap-2 rounded-card border-2 p-3 text-center', m.reached ? 'kw-animate border-fg' : 'border-dashed border-border')}>
              <div className={m.reached ? 'kw-shine-medal' : 'opacity-40 grayscale'}>
                <SealArt days={m.days} unit={c.sealUnit} size={88} />
              </div>
              <span className="text-body font-bold">{c.days(m.days)}</span>
              {m.certificate ? (
                <ButtonLink href={`/world/certificate/${m.days}`} prefetch={false} variant="secondary" size="M">
                  {c.certificate}
                </ButtonLink>
              ) : (
                <span className="text-small text-fg-muted">{c.bestStreak(data.bestStreak)}</span>
              )}
            </li>
          ))}
        </ul>
      </Shelf>

      <Shelf title={c.winsShelf}>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3">
          <li className="flex items-center gap-3 rounded-card border-2 border-divider p-3">
            <CupArt size={56} />
            <span className="flex flex-col"><span className="text-h3 font-bold tabular-nums">{data.badgeCount}</span><span className="text-small text-fg-muted">{c.badgesEarned}</span></span>
          </li>
          <li className="flex items-center gap-3 rounded-card border-2 border-divider p-3">
            <CupArt size={56} tone="var(--color-mental)" />
            <span className="flex flex-col"><span className="text-h3 font-bold tabular-nums">{data.bossWins}</span><span className="text-small text-fg-muted">{c.bossWins}</span></span>
          </li>
          <li className="flex items-center gap-3 rounded-card border-2 border-divider p-3">
            <CupArt size={56} tone="var(--color-science)" />
            <span className="flex flex-col"><span className="text-h3 font-bold tabular-nums">{data.setsComplete.length}</span><span className="text-small text-fg-muted">{c.setsDone}</span></span>
          </li>
        </ul>
        {data.setsComplete.length > 0 ? <p className="m-0 text-body">{c.completeSets(data.setsComplete.map((s) => setName(w, s.id, s.name)).join(', '))}</p> : null}
      </Shelf>

      <Shelf title={c.bossHall}>
        {data.bossesBeaten.length === 0 ? (
          <p className="m-0 text-body-lg text-fg-muted">{c.bossHallEmpty}</p>
        ) : (
          <ul className="kw-animate m-0 grid list-none grid-cols-3 gap-3 p-0 md:grid-cols-6">
            {data.bossesBeaten.map((b) => (
              <li key={b.id} className="flex flex-col items-center gap-1 text-center">
                <BossArt id={b.id} size={72} title={b.name} />
                <span className="text-small font-bold">{b.name}</span>
                <span className="text-small text-fg-muted tabular-nums">{c.wins(b.wins)}</span>
              </li>
            ))}
          </ul>
        )}
      </Shelf>

      <Shelf title={c.medalsShelf}>
        {data.medals.length === 0 ? (
          <p className="m-0 text-body-lg text-fg-muted">{c.noMedals}</p>
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
            {data.medals.map((m) => (
              <li key={m.id} className="kw-animate flex items-center gap-3 rounded-card border-2 border-fg p-3">
                <MedalArt kind={m.medal} size={64} title={c.medals[m.medal]} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-body-lg font-bold">{m.title}</span>
                  <span className="text-small text-fg-muted">{c.medals[m.medal]} · {c.earnedOn(m.earnedOn)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Shelf>
    </LearnerFrame>
  )
}
