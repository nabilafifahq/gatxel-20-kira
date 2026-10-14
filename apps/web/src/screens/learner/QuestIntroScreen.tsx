'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactElement } from 'react'
import type { QuestIntroDTO } from '@/lib/dto'
import { Button, ButtonLink, IconLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { CountdownOverlay } from '@/components/learner/CountdownOverlay'
import { plural } from '@/components/learner/format'
import { useDeviceWord, useOnline } from '@/components/learner/hooks'
import { OfflineBanner } from '@/components/learner/OfflineBanner'
import { LEARNER_ROUTES } from '@/components/learner/routes'
import { SubjectChip } from '@/components/learner/SubjectChip'
import { SubjectIcon } from '@/components/learner/SubjectIcon'
import { SUBJECT_NAME, SUBJECT_STYLE } from '@/components/learner/subject'

/**
 * L03 Pembuka quest (papan PembukaQuest, PembukaQuestBelum). Ringkasan sebelum mulai:
 * jumlah soal, perkiraan waktu, hint, dan skill yang dilatih.
 *
 * DTO belum menyatakan apakah paket quest sudah tersimpan di perangkat. `saved` diisi
 * pembungkus dari cache perangkat; tanpa itu, adanya `alternative` dibaca sebagai
 * "quest ini belum tersimpan". Keadaan belum tersimpan hanya ditampilkan saat offline.
 */

export function QuestIntroScreen({
  data,
  saved,
  online,
  backHref = LEARNER_ROUTES.today,
}: {
  data: QuestIntroDTO
  saved?: boolean
  /** Paksa status jaringan (pratinjau). Default dari navigator.onLine. */
  online?: boolean
  backHref?: string
}): ReactElement {
  const router = useRouter()
  // Sesi berwaktu: hitung mundur 3, 2, 1, Go sebelum soal pertama; jam baru berjalan setelah Go.
  const [counting, setCounting] = useState(false)
  const deviceOnline = useOnline()
  const device = useDeviceWord()
  const isOnline = online ?? deviceOnline
  const isSaved = saved ?? data.alternative === null
  const missing = !isOnline && !isSaved
  const style = SUBJECT_STYLE[data.subject]
  const name = SUBJECT_NAME[data.subject]
  const alt = data.alternative
  const altName = alt ? SUBJECT_NAME[alt.subject] : null

  return (
    <div data-jenjang={data.shell.jenjang} className="flex min-h-svh flex-col bg-bg text-fg">
      {counting ? <CountdownOverlay onGo={() => router.push(data.startHref)} /> : null}
      <header className="flex h-18 flex-none items-center gap-3 px-4 md:h-22 md:gap-4 md:px-8">
        <IconLink href={backHref} icon="arrow-left" label="Back to Today" />
        <span className="min-w-0 text-body-lg font-bold">Today&apos;s {name} session</span>
        {!isOnline ? (
          <span className="ml-auto">
            <OfflineBanner state="offline" />
          </span>
        ) : null}
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-10 md:items-center md:px-8 md:pb-14">
        <section
          aria-labelledby="quest-title"
          className="flex w-full max-w-[960px] flex-col gap-6 rounded-card border border-divider bg-surface p-5 sm:p-8 md:flex-row md:gap-10 md:p-10"
        >
          <span
            aria-hidden="true"
            className={cx('flex h-30 w-30 flex-none items-center justify-center rounded-card border-4 md:h-52 md:w-52', style.border, style.tint)}
          >
            <SubjectIcon subject={data.subject} size={120} className="h-18 w-18 md:h-30 md:w-30" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-4.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <SubjectChip subject={data.subject} size="M" />
              <span className="text-body font-semibold text-fg-muted">{data.modeLabel}</span>
            </div>
            <h1 id="quest-title" className="m-0 text-h1 font-bold break-words">
              {data.title}
            </h1>
            <ul className="m-0 flex list-none flex-wrap gap-x-7 gap-y-3 p-0">
              <li className="flex items-center gap-2 text-body-lg">
                <UiIcon name="list" size={22} className="flex-none" />
                {plural(data.questionCount, 'question', 'questions')}
              </li>
              <li className="flex items-center gap-2 text-body-lg">
                <UiIcon name="clock" size={22} className="flex-none" />
                {data.timeLimitMin ? `${plural(data.timeLimitMin, 'minute', 'minutes')} on the clock` : `About ${plural(data.minutes, 'minute', 'minutes')}`}
              </li>
              <li className="flex items-center gap-2 text-body-lg">
                <UiIcon name="hint" size={22} className="flex-none" />
                {data.hintsPerQuestion > 0 ? `${plural(data.hintsPerQuestion, 'hint', 'hints')} for each question` : 'No hints in this session'}
              </li>
            </ul>
            {data.youWillPractise.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-body font-semibold text-fg-muted">You will practise</span>
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {data.youWillPractise.map((p) => (
                    <li key={p} className="inline-flex min-h-9 items-center rounded-pill border border-border bg-surface px-3.5 text-body font-semibold">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {missing ? (
              <div role="alert" className="flex items-start gap-2.5 rounded-control border-2 border-warn bg-surface px-4 py-3 text-body-lg">
                <UiIcon name="warning" size={22} className="mt-1 flex-none text-warn" />
                <span>
                  This session is not on this {device} yet.{' '}
                  {altName ? `${altName} is saved here, so you can do ${altName} first.` : 'Connect to the internet to start it.'}
                </span>
              </div>
            ) : isSaved ? (
              <p className="m-0 flex items-center gap-2.5 text-body font-semibold">
                <UiIcon name="check-circle" size={22} className="flex-none text-success" />
                Saved on this {device}. It works without the internet.
              </p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-3">
              {missing ? (
                <>
                  <Button disabled>Start</Button>
                  {alt ? (
                    <ButtonLink href={alt.href} variant="secondary">
                      Start {altName} instead
                    </ButtonLink>
                  ) : null}
                </>
              ) : (
                data.timeLimitMin ? (
                  <Button iconAfter="arrow-right" className="px-7" onClick={() => setCounting(true)}>
                    Start
                  </Button>
                ) : (
                  <ButtonLink href={data.startHref} prefetch={false} iconAfter="arrow-right" className="px-7">
                    Start
                  </ButtonLink>
                )
              )}
              {data.lessonHref ? (
                <ButtonLink href={data.lessonHref} variant="quiet" icon="book">
                  See the lesson first
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
