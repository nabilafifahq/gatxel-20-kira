'use client'

import type { ReactElement } from 'react'
import { SiteFooter } from '@/components/ui/SiteFooter'
import type { DoneTodayDTO } from '@/lib/dto'
import { ButtonLink, IconLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { KiraStar } from '@/components/ui/KiraStar'
import { UiIcon } from '@/components/ui/icons'
import { LEARNER_ROUTES } from '@/components/learner/routes'
import { StreakChain } from '@/components/learner/StreakChain'
import { SubjectIcon } from '@/components/learner/SubjectIcon'
import { SUBJECT_STYLE, subjectName } from '@/components/learner/subject'
import { XpPill } from '@/components/learner/XpPill'
import { useT } from '@/lib/i18n/client'

/**
 * L14 Selesai hari ini (papan SelesaiHariIni, SelesaiBatasWaktu). Ringkasan hari ini dan
 * rencana besok. Quest yang berhenti di tengah dikenali dari skornya yang bukan "x of y"
 * karena DTO belum membawa penanda berhenti; nama hari diambil dari rantai streak.
 */

const SCORE = /^(\d+ ((out )?of|dari) \d+|Done|Selesai)$/

export function DoneTodayScreen({ data, todayHref = LEARNER_ROUTES.today }: { data: DoneTodayDTO; todayHref?: string }): ReactElement {
  const t = useT()
  const limit = data.variant === 'time-limit'
  const day = data.streak.week.find((d) => d.isToday)?.longLabel ?? t.shell.nav.today
  return (
    <div data-jenjang={data.shell.jenjang} className="flex min-h-svh flex-col bg-bg text-fg">
      <header className="flex h-18 flex-none items-center gap-4 px-4 md:h-22 md:px-8">
        <IconLink href={todayHref} icon="close" label={t.shell.done.closeLabel} />
        <span className="text-body-lg font-bold">{day}</span>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-4 pb-6 md:px-12 lg:flex-row lg:items-center lg:gap-12">
        <section aria-labelledby="done-title" className="flex min-w-0 flex-1 flex-col items-start gap-4.5">
          {limit ? (
            <span className="flex h-24 w-24 items-center justify-center rounded-card bg-lavender md:h-28 md:w-28">
              <UiIcon name="clock" size={60} strokeWidth={1.75} className="h-12 w-12 md:h-15 md:w-15" />
            </span>
          ) : (
            <KiraStar size={112} />
          )}
          <h1 id="done-title" className="m-0 font-display text-h1 font-semibold md:text-display">
            {data.title}
          </h1>
          <p className="m-0 max-w-[460px] text-h3 font-normal">{data.line}</p>
          <div className="mt-1 hidden sm:block">
            <StreakChain streak={data.streak} size="M" animate={data.variant === 'all-done'} />
          </div>
          <div className="mt-1 w-full sm:hidden">
            <StreakChain streak={data.streak} size="S" animate={data.variant === 'all-done'} />
          </div>
          <div className="flex flex-wrap gap-3">
            <XpPill xp={data.xpToday} size="L" />
            <span className="inline-flex h-11 items-center gap-2 rounded-pill border-2 border-border bg-surface pr-4 pl-3 text-body-lg font-bold tabular-nums">
              <UiIcon name="clock" size={22} />
              {t.shell.minutes(data.minutesToday)}
            </span>
          </div>
        </section>

        <section aria-labelledby="done-quests" className="flex min-w-0 flex-col gap-2 rounded-card bg-surface shadow-soft p-5 md:p-8 lg:flex-[1.05]">
          <h2 id="done-quests" className="m-0 mb-2 text-h2 font-bold">
            {t.shell.done.sessionsTitle}
          </h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {data.quests.map((q, i) => {
              const style = SUBJECT_STYLE[q.subject]
              const done = SCORE.test(q.score)
              return (
                <li key={`${q.subject}-${q.session}-${i}`} className="flex min-h-21 items-center gap-4 border-b border-divider py-2 max-sm:flex-wrap max-sm:gap-y-1">
                  <span className={cx('flex h-14 w-14 flex-none items-center justify-center rounded-control border-3', style.border, style.tint)}>
                    <SubjectIcon subject={q.subject} size={32} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col max-sm:basis-40">
                    <span className="text-body-lg font-bold">
                      {t.shell.sessionName(subjectName(q.subject, t), q.session)}
                      {q.required ? '' : t.shell.done.extra}
                    </span>
                    <span lang="en-GB" className="text-body text-fg-muted">{q.title}</span>
                  </div>
                  {done ? (
                    <span className="inline-flex flex-none items-center gap-2 text-body-lg font-bold tabular-nums max-sm:ml-18">
                      {q.score}
                      <UiIcon name="check-circle" size={24} strokeWidth={2.5} className="text-success" />
                    </span>
                  ) : (
                    <span className="max-w-[190px] flex-none text-right text-body font-bold text-warn max-sm:ml-18 max-sm:text-left">{q.score}</span>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="mt-3 flex items-start gap-3 rounded-control bg-lavender px-4 py-3.5">
            <UiIcon name="sun" size={24} className="mt-0.5 flex-none" />
            <p className="m-0 text-body-lg">{data.tomorrow}</p>
          </div>
        </section>
      </main>

      <footer className="flex flex-none flex-wrap items-center gap-3 px-4 py-5 md:h-24 md:px-8 md:py-0">
        {data.answersHref ? (
          <ButtonLink href={data.answersHref} variant="secondary">
            {t.shell.done.seeAnswers}
          </ButtonLink>
        ) : null}
        <ButtonLink href={todayHref} iconAfter="arrow-right" className="ml-auto">
          {t.shell.backToToday}
        </ButtonLink>
      </footer>
      <SiteFooter area="learner" />
    </div>
  )
}
