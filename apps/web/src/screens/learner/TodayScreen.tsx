import Link from 'next/link'
import type { ReactElement } from 'react'
import type { QuestStopDTO, TodayDTO } from '@/lib/dto'
import { ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { joinAnd } from '@/components/learner/format'
import { LearnerFrame, LearnerHeader } from '@/components/learner/LearnerHeader'
import { QuestStopBig, QuestStopRow } from '@/components/learner/QuestStop'
import { LEARNER_ROUTES } from '@/components/learner/routes'
import { FreezePill, StreakChain, StreakCount } from '@/components/learner/StreakChain'
import { SUBJECT_NAME } from '@/components/learner/subject'

/**
 * L02 Today (papan TodayA dan variannya, TodayAHP untuk HP). Satu keputusan kuat:
 * perhentian quest aktif dua kali lebih besar dari yang lain. Hari istirahat dan batas
 * waktu mengganti perhentian aktif dengan catatan besar.
 *
 * `headline` dari DTO menjadi judul bagian quest (tersembunyi secara visual) karena papan
 * memakai sapaan "Hi, nama" sebagai h1. Tombol "See today's work" memakai `doneHref`
 * karena DTO belum membawa alamat L14.
 */

type Row =
  | { kind: 'big'; stop: QuestStopDTO }
  | { kind: 'small'; stop: QuestStopDTO }
  | { kind: 'note'; icon: 'moon' | 'clock'; title: string; line: string; cta: { label: string; href: string } | null }

function buildRows(data: TodayDTO, doneHref: string): Row[] {
  const all = data.bonus ? [...data.stops, data.bonus] : [...data.stops]
  if (data.variant === 'rest-day') {
    const back = data.stops.find((s) => s.meta)?.meta
    return [
      { kind: 'note', icon: 'moon', title: 'Rest day', line: `Your streak is safe.${back ? ` ${back}.` : ''}`, cta: null },
      ...all.map((stop): Row => ({ kind: 'small', stop })),
    ]
  }
  if (data.variant === 'time-limit') {
    const moving = data.stops.filter((s) => s.state !== 'done' && s.state !== 'rest')
    const names = moving.map((s) => SUBJECT_NAME[s.subject])
    const line = names.length > 0 ? `${joinAnd(names)} ${names.length === 1 ? 'moves' : 'move'} to tomorrow. Your answers are saved.` : 'Your answers are saved.'
    const note: Row = { kind: 'note', icon: 'clock', title: 'Time for a break', line, cta: { label: "See today's work", href: doneHref } }
    const rows: Row[] = []
    let placed = false
    for (const stop of all) {
      if (moving.includes(stop)) {
        if (!placed) rows.push(note)
        placed = true
        continue
      }
      rows.push({ kind: 'small', stop })
    }
    if (!placed) rows.push(note)
    return rows
  }
  const active = data.activeIndex !== null ? data.stops[data.activeIndex] : data.bonus && data.bonus.state !== 'locked' && data.bonus.state !== 'done' ? data.bonus : null
  return all.map((stop): Row => ({ kind: stop === active ? 'big' : 'small', stop }))
}

function NoteStop({ row }: { row: Extract<Row, { kind: 'note' }> }): ReactElement {
  return (
    <div className="relative flex items-start gap-4 md:gap-8">
      <span className="flex w-28 flex-none justify-center md:w-36">
        <span
          className={cx(
            'flex h-28 w-28 items-center justify-center rounded-card border-2 bg-bg md:h-36 md:w-36',
            row.icon === 'moon' ? 'border-divider' : 'border-fg',
          )}
        >
          <UiIcon name={row.icon} size={56} strokeWidth={1.75} className="h-11 w-11 md:h-14 md:w-14" />
        </span>
      </span>
      <div className="flex max-w-[520px] min-w-0 flex-col items-start gap-2 md:pt-4">
        <h3 className="m-0 font-display text-h1 font-semibold">{row.title}</h3>
        <p className="m-0 text-body text-fg-muted md:text-body-lg">{row.line}</p>
        {row.cta ? (
          <ButtonLink href={row.cta.href} variant="secondary" className="mt-2 h-auto! min-h-14 max-w-full py-2.5 whitespace-normal!">
            {row.cta.label}
          </ButtonLink>
        ) : null}
      </div>
    </div>
  )
}

export function TodayScreen({ data, doneHref = LEARNER_ROUTES.doneToday }: { data: TodayDTO; doneHref?: string }): ReactElement {
  const rows = buildRows(data, doneHref)
  const first = rows[0]
  const last = rows[rows.length - 1]
  const firstSmall = first?.kind === 'small'
  const lastSmall = last?.kind === 'small'
  const streak = data.streak
  return (
    <LearnerFrame shell={data.shell} current="today" className="md:flex md:flex-col">
      <div className="flex flex-1 flex-col gap-4.5 md:gap-7">
        <LearnerHeader
          shell={data.shell}
          subline={data.subline}
          right={
            <div className="hidden flex-wrap items-center gap-5 md:flex">
              <StreakCount current={streak.current} />
              <StreakChain streak={streak} size="M" />
              <FreezePill count={streak.freezes} />
            </div>
          }
        />

        <section aria-label="Streak" className="flex flex-col gap-2.5 rounded-card border border-divider bg-surface px-3 py-3.5 sm:px-4 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <StreakCount current={streak.current} layout="inline" />
            <FreezePill count={streak.freezes} className="h-8" />
          </div>
          <StreakChain streak={streak} size="S" />
        </section>

        <section aria-labelledby="today-quests" className="relative flex flex-col gap-4 md:gap-6">
          <h2 id="today-quests" className="visually-hidden">
            {data.headline}
          </h2>
          {rows.length > 1 ? (
            <div
              aria-hidden="true"
              className={cx(
                'absolute left-[54px] w-0 border-l-3 border-dashed border-fg md:left-[70px]',
                firstSmall ? 'top-7 md:top-9' : 'top-14 md:top-18',
                lastSmall ? 'bottom-7 md:bottom-9' : 'bottom-20',
              )}
            />
          ) : null}
          {rows.map((row, i) =>
            row.kind === 'note' ? (
              <NoteStop key={`note-${i}`} row={row} />
            ) : row.kind === 'big' ? (
              <QuestStopBig key={row.stop.questId ?? `${row.stop.subject}-${i}`} stop={row.stop} headingLevel={3} />
            ) : (
              <QuestStopRow key={row.stop.questId ?? `${row.stop.subject}-${i}`} stop={row.stop} size="auto" />
            ),
          )}
        </section>

        {data.nextCompetition || data.esmo ? (
          <div className="mt-auto flex flex-col gap-3 pt-2 lg:flex-row">
            {data.nextCompetition ? (
              <section
                aria-label="Next competition"
                className="flex h-16 min-w-0 flex-1 items-center gap-3 rounded-card border border-divider bg-surface px-4 md:h-18 md:gap-4 md:px-6"
              >
                <UiIcon name="trophy" size={28} className="h-6 w-6 flex-none md:h-7 md:w-7" />
                <div className="flex min-w-0 flex-col">
                  <span className="hidden text-body text-fg-muted md:block">Next competition</span>
                  <span className="text-body md:text-body-lg md:font-bold">
                    <span className="md:hidden">Next: </span>
                    <strong className="font-bold">{data.nextCompetition.name}</strong>
                  </span>
                </div>
                <div className="ml-auto flex items-baseline gap-1 md:gap-2">
                  <span className="font-display text-h1 font-semibold tabular-nums">{data.nextCompetition.daysToGo}</span>
                  <span className="text-body font-semibold">
                    {data.nextCompetition.daysToGo === 1 ? 'day' : 'days'}
                    <span className="hidden md:inline"> to go</span>
                  </span>
                </div>
              </section>
            ) : null}
            {data.esmo ? (
              <Link
                href={data.esmo.href}
                className="flex h-16 items-center gap-3 rounded-card border-2 border-border bg-surface px-4 text-body-lg font-bold text-fg no-underline hover:border-fg md:h-18 md:px-6 lg:flex-none"
              >
                <UiIcon name="book" size={26} className="flex-none" />
                <span className="min-w-0 flex-1">{data.esmo.label}</span>
                <UiIcon name="arrow-right" size={22} className="flex-none" />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </LearnerFrame>
  )
}
