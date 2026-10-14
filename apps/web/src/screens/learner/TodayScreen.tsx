import Link from 'next/link'
import type { ReactElement } from 'react'
import type { TodayDTO, TodayGroupDTO } from '@/lib/dto'
import { ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { joinAnd } from '@/components/learner/format'
import { LearnerFrame, LearnerHeader } from '@/components/learner/LearnerHeader'
import { QuestStopBig, QuestStopRow } from '@/components/learner/QuestStop'
import { LEARNER_ROUTES } from '@/components/learner/routes'
import { FreezePill, StreakChain, StreakCount } from '@/components/learner/StreakChain'
import { SubjectChip } from '@/components/learner/SubjectChip'
import { SUBJECT_NAME } from '@/components/learner/subject'
import { XpTrackBars } from '@/components/learner/arena/XpTrackBars'
import { DailyChest, type ChestActions } from '@/components/learner/DailyChest'

/**
 * L02 Today (papan TodayA dan variannya, TodayAHP untuk HP). Jalur sesi wajib dikelompokkan per mapel
 * (Practice, Test, Paper), sesi yang sebaiknya dikerjakan sekarang tampil dua kali lebih besar, dan sesi
 * opsional dari tutor ada di bagian "Extra today". Hari istirahat dan batas waktu mengganti jalur dengan catatan besar.
 *
 * `headline` dari DTO menjadi judul bagian sesi (tersembunyi secara visual) karena papan
 * memakai sapaan "Hi, nama" sebagai h1. Tombol "See today's work" memakai `doneHref`
 * karena DTO belum membawa alamat L14.
 */

type Note = { icon: 'moon' | 'clock'; title: string; line: string; cta: { label: string; href: string } | null }

/** Hari istirahat dan batas waktu mengganti jalur dengan catatan besar. */
function noteFor(data: TodayDTO, doneHref: string): Note | null {
  if (data.variant === 'rest-day') return { icon: 'moon', title: 'Rest day', line: 'Your streak is safe.', cta: null }
  if (data.variant === 'time-limit') {
    const left = data.groups.flatMap((g) => g.stops).filter((s) => s.state !== 'done')
    const names = [...new Set(left.map((s) => SUBJECT_NAME[s.subject]))]
    const line = names.length > 0 ? `${joinAnd(names)} ${names.length === 1 ? 'moves' : 'move'} to tomorrow. Your answers are saved.` : 'Your answers are saved.'
    return { icon: 'clock', title: 'Time for a break', line, cta: { label: "See today's work", href: doneHref } }
  }
  return null
}

function NoteStop({ row }: { row: Note }): ReactElement {
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

function Progress({ data }: { data: TodayDTO }): ReactElement {
  const { done, total, extraDone, extraTotal } = data.progress
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-body-lg font-bold">
        {done} of {total} sessions done
        {extraTotal > 0 ? (
          <span className="font-semibold text-fg-muted">
            , extra {extraDone} of {extraTotal}
          </span>
        ) : null}
      </p>
      <div role="img" aria-label={`${done} of ${total} sessions done`} className="flex h-3 overflow-hidden rounded-pill bg-divider">
        <span className="bg-fg" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function GroupHeading({ group }: { group: TodayGroupDTO }): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-3 pl-28 md:pl-36">
      <h3 className="m-0 text-h3 font-bold">
        <SubjectChip subject={group.subject} size="S" label={group.label} />
      </h3>
      <span className="text-body font-semibold text-fg-muted tabular-nums">
        {group.done} of {group.total} done
      </span>
    </div>
  )
}

export function TodayScreen({ data, doneHref = LEARNER_ROUTES.doneToday, chestActions }: { data: TodayDTO; doneHref?: string; chestActions?: ChestActions }): ReactElement {
  const note = noteFor(data, doneHref)
  const streak = data.streak
  // Batas waktu: hanya sesi yang sudah selesai tetap tampil di jalur.
  const groups =
    data.variant === 'time-limit'
      ? data.groups.map((g) => ({ ...g, stops: g.stops.filter((s) => s.state === 'done') })).filter((g) => g.stops.length > 0)
      : data.groups
  const shown = data.variant === 'rest-day' ? [] : groups
  const extras = data.variant === 'rest-day' || data.variant === 'time-limit' ? [] : data.extras
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

        {data.progress.total > 0 && data.variant !== 'rest-day' ? <Progress data={data} /> : null}

        {data.tracks ? (
          <section aria-label="Your levels" className="rounded-card border border-divider bg-surface px-4 py-3.5 md:px-6">
            <XpTrackBars tracks={data.tracks} variant="compact" />
          </section>
        ) : null}

        <section aria-labelledby="today-quests" className="relative flex flex-col gap-6 md:gap-8">
          <h2 id="today-quests" className="visually-hidden">
            {data.headline}
          </h2>
          {note ? <NoteStop row={note} /> : null}
          {shown.length > 0 ? <div aria-hidden="true" className="absolute top-8 bottom-10 left-[54px] w-0 border-l-3 border-dashed border-fg md:left-[70px]" /> : null}
          {shown.length > 0 && data.progress.total > 0 ? (
            <div
              aria-hidden="true"
              className="kira-path-fill absolute top-8 bottom-10 left-[52.5px] w-[6px] rounded-pill bg-success md:left-[68.5px]"
              style={{ transform: `scaleY(${Math.min(1, data.progress.done / data.progress.total)})` }}
            />
          ) : null}
          {shown.map((group) => (
            <div key={group.subject} role="group" aria-label={`${group.label} sessions`} className="relative flex flex-col gap-4 md:gap-5">
              <GroupHeading group={group} />
              {group.stops.map((stop) =>
                stop.questId !== null && stop.questId === data.activeQuestId && data.variant !== 'time-limit' ? (
                  <div key={stop.questId} className="kira-active-glow rounded-card">
                    <QuestStopBig stop={stop} headingLevel={4} />
                  </div>
                ) : (
                  <QuestStopRow key={stop.questId ?? `${group.subject}-${stop.session}`} stop={stop} size="auto" />
                ),
              )}
            </div>
          ))}
        </section>

        {data.chest ? <DailyChest chest={data.chest} avatar={data.shell.avatar} accessory={data.shell.accessory ?? null} background={data.shell.background ?? null} actions={chestActions} /> : null}

        {extras.length > 0 ? (
          <section aria-labelledby="today-extra" className="flex flex-col gap-4 rounded-card border border-divider bg-surface px-4 py-5 md:px-6">
            <div className="flex flex-col gap-1">
              <h2 id="today-extra" className="m-0 text-h2 font-bold">
                Extra today
              </h2>
              <p className="m-0 text-body text-fg-muted">From your tutor. Optional, and your streak does not change.</p>
            </div>
            {extras.map((stop) => (
              <QuestStopRow key={stop.questId ?? stop.href ?? stop.session} stop={stop} size="auto" />
            ))}
          </section>
        ) : null}

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
