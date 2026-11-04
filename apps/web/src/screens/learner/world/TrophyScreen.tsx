import type { ReactElement } from 'react'
import { BossArt, CupArt, MedalArt, SealArt } from '@kira/figures'
import type { TrophyDTO } from '@/lib/dto-world'
import { ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { WorldTabs } from '@/components/learner/world/parts'

const MEDAL_WORD = { gold: 'Gold medal', silver: 'Silver medal', bronze: 'Bronze medal', honour: 'Honourable mention', participant: 'Participant' } as const

function Shelf({ title, children }: { title: string; children: React.ReactNode }): ReactElement {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-card border-2 border-divider bg-surface p-4 md:p-5">
      <h2 className="m-0 text-h2 font-bold">{title}</h2>
      {children}
    </section>
  )
}

export function TrophyScreen({ data }: { data: TrophyDTO }): ReactElement {
  return (
    <LearnerFrame shell={data.shell} current="world" className="flex flex-col gap-4 md:gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-h1 font-bold">Trophy room</h1>
        <p className="m-0 text-body-lg text-fg-muted">Everything you have earned, in one shiny place.</p>
      </header>
      <WorldTabs current="trophies" />

      <Shelf title="Streak milestones">
        <ul className="m-0 grid list-none grid-cols-3 gap-3 p-0">
          {data.milestones.map((m) => (
            <li key={m.days} className={cx('flex flex-col items-center gap-2 rounded-card border-2 p-3 text-center', m.reached ? 'kw-animate border-fg' : 'border-dashed border-border')}>
              <div className={m.reached ? 'kw-shine-medal' : 'opacity-40 grayscale'}>
                <SealArt days={m.days} size={88} />
              </div>
              <span className="text-body font-bold">{m.days} days</span>
              {m.certificate ? (
                <ButtonLink href={`/world/certificate/${m.days}`} prefetch={false} variant="secondary" size="M">
                  Certificate (PDF)
                </ButtonLink>
              ) : (
                <span className="text-small text-fg-muted">Best streak so far: {data.bestStreak}</span>
              )}
            </li>
          ))}
        </ul>
      </Shelf>

      <Shelf title="Badges and wins">
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3">
          <li className="flex items-center gap-3 rounded-card border-2 border-divider p-3">
            <CupArt size={56} />
            <span className="flex flex-col"><span className="text-h3 font-bold tabular-nums">{data.badgeCount}</span><span className="text-small text-fg-muted">Badges earned</span></span>
          </li>
          <li className="flex items-center gap-3 rounded-card border-2 border-divider p-3">
            <CupArt size={56} tone="var(--color-mental)" />
            <span className="flex flex-col"><span className="text-h3 font-bold tabular-nums">{data.bossWins}</span><span className="text-small text-fg-muted">Boss wins</span></span>
          </li>
          <li className="flex items-center gap-3 rounded-card border-2 border-divider p-3">
            <CupArt size={56} tone="var(--color-science)" />
            <span className="flex flex-col"><span className="text-h3 font-bold tabular-nums">{data.setsComplete.length}</span><span className="text-small text-fg-muted">Card sets complete</span></span>
          </li>
        </ul>
        {data.setsComplete.length > 0 ? <p className="m-0 text-body">Complete sets: {data.setsComplete.map((s) => s.name).join(', ')}.</p> : null}
      </Shelf>

      <Shelf title="Boss hall">
        {data.bossesBeaten.length === 0 ? (
          <p className="m-0 text-body-lg text-fg-muted">Every boss you beat comes to stand here.</p>
        ) : (
          <ul className="kw-animate m-0 grid list-none grid-cols-3 gap-3 p-0 md:grid-cols-6">
            {data.bossesBeaten.map((b) => (
              <li key={b.id} className="flex flex-col items-center gap-1 text-center">
                <BossArt id={b.id} size={72} title={b.name} />
                <span className="text-small font-bold">{b.name}</span>
                <span className="text-small text-fg-muted tabular-nums">{b.wins} {b.wins === 1 ? 'win' : 'wins'}</span>
              </li>
            ))}
          </ul>
        )}
      </Shelf>

      <Shelf title="Contest medals">
        {data.medals.length === 0 ? (
          <p className="m-0 text-body-lg text-fg-muted">When a grown-up adds a real contest medal, it will shine here.</p>
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
            {data.medals.map((m) => (
              <li key={m.id} className="kw-animate flex items-center gap-3 rounded-card border-2 border-fg p-3">
                <MedalArt kind={m.medal} size={64} title={MEDAL_WORD[m.medal]} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-body-lg font-bold">{m.title}</span>
                  <span className="text-small text-fg-muted">{MEDAL_WORD[m.medal]} · {m.earnedOn}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Shelf>
    </LearnerFrame>
  )
}
