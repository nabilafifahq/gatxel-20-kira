import Link from 'next/link'
import type { ReactElement } from 'react'
import type { ResultQuestion, ResultsDTO } from '@/lib/dto'
import { ButtonLink, IconLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { TryAgainButton } from '@/components/runtime/TryAgainButton'
import { BadgeMedal } from '@/components/learner/BadgeTile'
import { minutesSeconds, plural } from '@/components/learner/format'
import { SessionCelebration } from '@/components/learner/SessionCelebration'
import { BadgeReveal } from '@/components/learner/BadgeReveal'
import { CountUp } from '@/components/learner/CountUp'
import { SubjectChip } from '@/components/learner/SubjectChip'
import { SUBJECT_NAME } from '@/components/learner/subject'
import { XpPill } from '@/components/learner/XpPill'

/**
 * L07 Hasil dan L17 Hasil ESMO (papan Hasil, HasilPenuh, HasilRendah, HasilEsmo,
 * HasilEsmoBawah70). Satu keputusan kuat: skor dalam Mohave 64 px.
 * Hasil ESMO (`scaled` terisi) memakai skala 100 dengan garis target dan daftar per topik.
 * Nomor soal membuka pembahasan di `${reviewHref}?q=nomor` karena DTO belum membawa tautan per soal.
 */

function questionHref(reviewHref: string, position: number): string {
  return `${reviewHref}${reviewHref.includes('?') ? '&' : '?'}q=${position}`
}

const MARK_WORD: Record<ResultQuestion['status'], string> = {
  correct: 'correct',
  wrong: 'not yet',
  blank: 'no answer',
  pending: 'waiting for your tutor',
}

function QuestionMarks({ data }: { data: ResultsDTO }): ReactElement {
  const many = data.questions.length > 20
  return (
    <ol className={cx('m-0 grid list-none gap-3 p-0', many ? 'grid-cols-5 sm:grid-cols-8' : 'grid-cols-5')}>
      {data.questions.map((q) => {
        const ok = q.status === 'correct'
        const pending = q.status === 'pending'
        return (
          <li key={q.position} className="flex">
            <Link
              href={questionHref(data.reviewHref, q.position)}
              aria-label={`Question ${q.position}, ${MARK_WORD[q.status]}. See the steps.`}
              className={cx(
                'flex w-full items-center justify-center gap-1.5 rounded-control text-h3 font-bold tabular-nums no-underline transition-transform duration-150 ease-kira active:scale-97',
                many ? 'h-14' : 'h-16',
                ok && 'border-2 border-success bg-success text-white hover:text-white',
                pending && 'border-2 border-border bg-bg text-fg hover:border-fg',
                !ok && !pending && 'border-3 border-warn bg-surface text-fg hover:bg-warn-50',
                q.status === 'blank' && 'border-dashed',
              )}
            >
              <UiIcon name={ok ? 'check' : pending ? 'clock' : 'not-yet'} size={16} strokeWidth={3} />
              <span>{q.position}</span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

function TopicRows({ data }: { data: ResultsDTO }): ReactElement {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {data.byTopic.map((t) => (
        <li
          key={t.label}
          aria-label={`${t.label}, ${t.right} of ${t.total} right`}
          className="grid min-h-13.5 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-divider py-2 sm:grid-cols-[176px_minmax(0,1fr)_72px]"
        >
          <span className="text-body-lg font-bold">{t.label}</span>
          <span aria-hidden="true" className="col-span-2 row-start-2 flex flex-wrap gap-1 sm:col-span-1 sm:row-start-auto">
            {Array.from({ length: t.total }, (_, k) =>
              k < t.right ? (
                <span key={k} className="inline-flex h-5.5 w-5.5 items-center justify-center rounded-pill bg-success text-white">
                  <UiIcon name="check" size={14} strokeWidth={3} />
                </span>
              ) : (
                <span key={k} className="inline-flex h-5.5 w-5.5 rounded-pill border-2 border-warn bg-surface" />
              ),
            )}
          </span>
          <span className="text-right text-body-lg font-bold tabular-nums">
            {t.right} of {t.total}
          </span>
        </li>
      ))}
    </ul>
  )
}

function ScaledBar({ value, target }: { value: number; target: number }): ReactElement {
  const v = Math.max(0, Math.min(100, value))
  const t = Math.max(0, Math.min(100, target))
  return (
    <div role="img" aria-label={`Score ${v} out of 100. Target ${t}.`} className="relative pt-8">
      <span className="absolute top-0 -translate-x-1/2 text-body font-bold whitespace-nowrap" style={{ left: `${t}%` }}>
        Target {t}
      </span>
      <div className="flex h-6 overflow-hidden rounded-control bg-divider">
        <div className="bg-math" style={{ width: `${v}%` }} />
      </div>
      <span className="absolute top-6.5 -ml-0.5 h-9 w-1 rounded-control bg-fg" style={{ left: `${t}%` }} />
      <div className="mt-2.5 flex justify-between text-body text-fg-muted tabular-nums">
        <span>0</span>
        <span>100</span>
      </div>
    </div>
  )
}

function NoteBox({ children }: { children: string }): ReactElement {
  return (
    <div className="flex items-start gap-3 rounded-control border border-divider bg-bg px-4 py-3.5">
      <UiIcon name="info" size={24} className="mt-0.5 flex-none" />
      <p className="m-0 text-body-lg">{children}</p>
    </div>
  )
}

export function ResultsScreen({ data }: { data: ResultsDTO }): ReactElement {
  const esmo = data.scaled !== null
  const badge = data.newBadges[0] ?? null
  const weakLabel = data.tone === 'full' ? 'Next step' : 'Needs practice'
  const usedMin = Math.round(data.timeUsedSec / 60)
  const limitMin = data.timeLimitSec ? Math.round(data.timeLimitSec / 60) : null
  const timeLine = esmo ? (
    <>
      <span className="font-display text-h1 font-semibold tabular-nums">{usedMin}</span>
      <span className="text-body font-semibold">{limitMin ? `of ${limitMin} minutes` : usedMin === 1 ? 'minute' : 'minutes'}</span>
    </>
  ) : (
    <>
      <span className="font-display text-h1 font-semibold tabular-nums">{minutesSeconds(data.timeUsedSec)}</span>
      <span className="text-body font-semibold">{data.timeLimitSec ? `of ${minutesSeconds(data.timeLimitSec)}` : 'time used'}</span>
    </>
  )
  const timeAria = esmo
    ? `${plural(usedMin, 'minute', 'minutes')} used${limitMin ? ` of ${limitMin}` : ''}`
    : `Time used ${minutesSeconds(data.timeUsedSec)}${data.timeLimitSec ? ` of ${minutesSeconds(data.timeLimitSec)}` : ''}`

  return (
    <div data-jenjang={data.shell.jenjang} className="flex min-h-svh flex-col bg-bg text-fg">
      <header className="flex min-h-18 flex-none flex-wrap items-center gap-3 px-4 py-2 md:h-22 md:gap-4 md:px-8 md:py-0">
        <IconLink href={data.backHref} icon="close" label={`Close. ${data.backLabel}`} />
        <SubjectChip subject={data.subject} size="M" label={esmo ? `ESMO ${SUBJECT_NAME[data.subject]}` : undefined} />
        <div className="flex min-w-0 flex-col">
          <h1 className="m-0 text-body-lg font-bold">{data.title}</h1>
          <span className="text-body text-fg-muted">{data.meta}</span>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 px-4 md:gap-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <section aria-labelledby="score-label" className="flex min-w-0 flex-col gap-4.5 rounded-card border border-divider bg-surface p-5 md:p-8">
          <span id="score-label" className="text-body-lg font-bold">
            {data.scoreLabel}
          </span>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-display font-semibold tabular-nums">
              <CountUp value={esmo && data.scaled ? data.scaled.value : data.scoreValue} />
            </span>
            <span className="text-body-lg text-fg-muted">out of {esmo ? 100 : data.scoreMax}</span>
          </div>
          {esmo && data.scaled ? <ScaledBar value={data.scaled.value} target={data.scaled.target} /> : null}
          <div className="flex flex-col gap-1">
            <p className="m-0 text-h3 font-bold">{data.headline}</p>
            {esmo ? <p className="m-0 text-body-lg">{data.detail}</p> : null}
          </div>
          <SessionCelebration
            attemptId={data.attemptId}
            avatar={data.shell.avatar}
            accessory={data.shell.accessory ?? null}
            background={data.shell.background ?? null}
            right={data.questions.filter((q) => q.status === 'correct').length}
            total={data.questions.length}
            pending={data.questions.filter((q) => q.status === 'pending').length}
            xpBar={data.xpBar}
            hasNewBadge={badge !== null}
          />
          {esmo ? null : (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <div role="img" aria-label={timeAria} className="flex items-center gap-2.5">
                <UiIcon name="stopwatch" size={24} />
                {timeLine}
              </div>
              <XpPill xp={data.xp} size="L" countUp />
            </div>
          )}
          <div className={cx('mt-auto flex border-t border-divider pt-5', esmo ? 'flex-wrap items-center gap-6' : 'flex-col gap-4')}>
            {esmo ? (
              <>
                <div role="img" aria-label={timeAria} className="flex items-center gap-2.5">
                  <UiIcon name="stopwatch" size={24} />
                  {timeLine}
                </div>
                <XpPill xp={data.xp} size="L" className="ml-auto" />
              </>
            ) : badge ? (
              <BadgeReveal className="flex items-center gap-4">
                <BadgeMedal id={badge.id} title={badge.title} />
                <div className="flex min-w-0 flex-col">
                  <span className="text-body font-semibold text-fg-muted">New badge</span>
                  <span className="text-h3 font-bold">{badge.title}</span>
                  <span className="text-body">{badge.description}</span>
                </div>
              </BadgeReveal>
            ) : (
              <div className="flex items-start gap-3">
                <UiIcon name="book" size={24} className="mt-0.5 flex-none" />
                <p className="m-0 text-body-lg">
                  Every question has steps to look at.
                  {data.weakest && data.weakest.line ? ` You will see ${data.weakest.topic} again in your next quests.` : ''}
                </p>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="questions-title" className="flex min-w-0 flex-col gap-5 rounded-card border border-divider bg-surface p-5 md:p-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h2 id="questions-title" className="m-0 text-h2 font-bold">
              {esmo ? 'By topic' : 'Questions'}
            </h2>
            {esmo ? (
              <div aria-hidden="true" className="ml-auto flex gap-4 text-body font-semibold text-fg-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-4.5 w-4.5 rounded-pill bg-success" />
                  Right
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-4.5 w-4.5 rounded-pill border-2 border-warn bg-surface" />
                  Not yet
                </span>
              </div>
            ) : (
              <span className="text-body text-fg-muted sm:ml-auto">Tap a number to see the steps</span>
            )}
          </div>
          {esmo ? (
            <TopicRows data={data} />
          ) : (
            <>
              <QuestionMarks data={data} />
              {data.strongest || data.weakest ? (
                <dl className="m-0 flex flex-col">
                  {data.strongest ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-t border-divider py-3.5 sm:grid-cols-[168px_minmax(0,1fr)_auto]">
                      <dt className="col-span-2 text-body font-semibold text-fg-muted sm:col-span-1">Strongest</dt>
                      <dd className="m-0 text-h3 font-bold">{data.strongest.topic}</dd>
                      <dd className="m-0 text-body-lg font-bold tabular-nums">{data.strongest.line}</dd>
                    </div>
                  ) : null}
                  {data.weakest ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-y border-divider py-3.5 sm:grid-cols-[168px_minmax(0,1fr)_auto]">
                      <dt className="col-span-2 text-body font-semibold text-fg-muted sm:col-span-1">{weakLabel}</dt>
                      <dd className="m-0 text-h3 font-bold">{data.weakest.topic}</dd>
                      <dd className="m-0 text-body-lg font-bold tabular-nums">{data.weakest.line}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </>
          )}
          <div className="mt-auto">
            <NoteBox>{esmo ? (data.weakest?.line ?? data.detail) : data.detail}</NoteBox>
          </div>
        </section>
      </div>

      {data.retry ? (
        <section aria-label="Try again" className="mx-4 mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-divider bg-surface p-5 md:mx-8 md:mt-6">
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
            <p className="m-0 text-body-lg font-bold">
              {data.retry.isRetry ? `Try ${data.retry.retryNo + 1}. Your first try counts for your report: ${data.retry.official}.` : data.retry.best ? `Your best so far: ${data.retry.best}.` : 'You can try this session again.'}
            </p>
            <p className="m-0 text-body text-fg-muted">
              {data.retry.isRetry && data.retry.best ? `Best so far: ${data.retry.best}. ` : ''}
              {data.retry.xpNote}
            </p>
          </div>
          <TryAgainButton attemptId={data.attemptId} label={data.retry.continueOpen ? 'Continue your retry' : 'Try again'} />
        </section>
      ) : null}

      <footer className="flex flex-none flex-wrap items-center gap-3 px-4 py-5 md:h-24 md:px-8 md:py-0">
        <ButtonLink href={data.backHref} variant="secondary">
          {data.backLabel}
        </ButtonLink>
        <ButtonLink href={data.reviewHref} iconAfter="arrow-right" className="ml-auto">
          See the answers
        </ButtonLink>
      </footer>
    </div>
  )
}
