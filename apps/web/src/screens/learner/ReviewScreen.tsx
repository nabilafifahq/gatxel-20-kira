'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { ReviewDTO, ReviewQuestionDTO } from '@/lib/dto'
import { Button, ButtonLink, IconLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { FigureFrame } from '@/components/learner/FigureFrame'
import { ReadAloudButton } from '@/components/learner/ReadAloudButton'
import { SolutionPlayer } from '@/components/learner/SolutionPlayer'
import { SubjectChip } from '@/components/learner/SubjectChip'
import { SUBJECT_STYLE } from '@/components/learner/subject'
import { isManualType, letterAt } from '@/components/widgets/answers'

/**
 * L08 Pembahasan (papan Pembahasan, PembahasanDiputar, PembahasanReduced). Daftar soal di kiri,
 * pembahasan soal terpilih di kanan: jawaban learner, kunci, alasan, cara menyelesaikan, tip,
 * dan SolutionPlayer bila soal punya langkah. Pemutar tidak pernah berjalan sendiri.
 *
 * Halaman membuka soal `openPosition`; tautan nomor dari halaman hasil (`?q=`) dipetakan
 * pembungkus halaman ke `openPosition`. DTO belum membawa nama topik per soal, jadi daftar
 * memakai potongan teks soal.
 */

const STATUS_WORD: Record<ReviewQuestionDTO['status'], string> = {
  correct: 'correct',
  wrong: 'not yet',
  blank: 'no answer',
  pending: 'waiting for your tutor',
}

/** Pisahkan "B. 4" menjadi huruf dan teks. Huruf mengikuti urutan opsi di layar. */
function splitAnswer(text: string, q: ReviewQuestionDTO): { letter: string | null; text: string } {
  const m = /^([A-F])\.\s+(.+)$/.exec(text)
  if (!m || (q.item.type !== 'mcq' && q.item.type !== 'multi')) return { letter: null, text }
  const body = m[2] ?? ''
  const idx = (q.item.options ?? []).findIndex((o) => o.text === body)
  return { letter: idx >= 0 ? letterAt(idx) : (m[1] ?? null), text: body }
}

function StatusIcon({ status, size = 22 }: { status: ReviewQuestionDTO['status']; size?: number }): ReactElement {
  if (status === 'correct') return <UiIcon name="check-circle" size={size} strokeWidth={2.5} className="flex-none text-success" />
  if (status === 'pending') return <UiIcon name="clock" size={size} className="flex-none text-fg-muted" />
  return <UiIcon name="not-yet" size={size} strokeWidth={2.5} className="flex-none text-warn" />
}

function AnswerRow({
  label,
  answer,
  tone,
  badge,
}: {
  label: string
  answer: { letter: string | null; text: string }
  tone: 'correct' | 'not-yet' | 'plain'
  badge?: 'correct' | 'not-yet'
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="w-26 flex-none text-body font-semibold text-fg-muted">{label}</span>
      {answer.letter ? (
        <span
          aria-hidden="true"
          className={cx(
            'inline-flex h-8 w-8 flex-none items-center justify-center rounded-pill text-body font-bold text-white',
            tone === 'correct' ? 'bg-success' : tone === 'not-yet' ? 'bg-warn' : 'bg-fg',
          )}
        >
          {answer.letter}
        </span>
      ) : null}
      <span className="font-reading text-h3 font-bold break-words">
        {answer.letter ? <span className="visually-hidden">{answer.letter}. </span> : null}
        {answer.text}
      </span>
      {badge ? (
        <span className={cx('inline-flex h-7 items-center gap-1 rounded-pill px-2.5 text-body font-bold text-white', badge === 'correct' ? 'bg-success' : 'bg-warn')}>
          <UiIcon name={badge === 'correct' ? 'check' : 'not-yet'} size={16} />
          {badge === 'correct' ? 'Correct' : 'Not yet'}
        </span>
      ) : null}
    </div>
  )
}

function QuestionDetail({ q, data, onNext, isLast }: { q: ReviewQuestionDTO; data: ReviewDTO; onNext: () => void; isLast: boolean }): ReactElement {
  const style = SUBJECT_STYLE[data.subject]
  const manual = isManualType(q.item.type)
  const ok = q.status === 'correct'
  const yours = q.status === 'blank' ? { letter: null, text: 'No answer' } : splitAnswer(q.yourAnswerText, q)
  const key = splitAnswer(q.correctAnswerText, q)
  const player = q.solution && q.solution.length > 0 ? q.solution : null
  const showFigure = !player && q.item.figure
  return (
    <section aria-labelledby={`review-q-${q.position}`} className="flex min-w-0 flex-1 flex-col gap-5 rounded-card border border-divider bg-surface p-5 md:p-7">
      <div className="flex items-start gap-3.5">
        <span className={cx('mt-px inline-flex h-8.5 min-w-11 flex-none items-center justify-center rounded-pill px-3 text-body-lg font-bold text-white tabular-nums', style.solid)}>
          {q.position}
        </span>
        <h2 id={`review-q-${q.position}`} tabIndex={-1} className="m-0 min-w-0 flex-1 text-question font-normal focus:outline-none">
          <span className="visually-hidden">Question {q.position}. </span>
          {q.item.prompt}
        </h2>
        <ReadAloudButton text={q.item.prompt} lang={q.item.lang} subject={data.subject} showNote={false} compact />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        {player ? (
          <SolutionPlayer key={q.position} steps={player} subject={data.subject} figure={q.item.figure} className="w-full flex-none lg:w-90" lang={q.item.lang} />
        ) : showFigure && q.item.figure ? (
          <div className="w-full flex-none lg:w-90">
            <FigureFrame spec={q.item.figure} paper={data.subject === 'math'} />
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <div className="flex flex-col gap-2.5">
            {manual ? (
              <p className="m-0 text-body-lg">{q.status === 'pending' ? 'Your tutor has not marked this one yet.' : 'Your tutor marked this one.'}</p>
            ) : (
              <>
                <AnswerRow label="Your answer" answer={yours} tone={ok ? 'correct' : 'not-yet'} badge={ok ? 'correct' : 'not-yet'} />
                {ok ? null : <AnswerRow label="Answer" answer={key} tone="correct" />}
              </>
            )}
          </div>
          {q.tutorFeedback ? (
            <div className="flex flex-col gap-1 rounded-control border-2 border-fg bg-surface px-4 py-3">
              <h3 className="m-0 text-body-lg font-bold">From your tutor</h3>
              <p className="m-0 font-reading text-body-lg">{q.tutorFeedback}</p>
            </div>
          ) : null}
          {!ok && q.whyYourAnswer ? (
            <div className="flex flex-col gap-1">
              <h3 className="m-0 text-body-lg font-bold">Why {yours.text} is not right</h3>
              <p className="m-0 font-reading text-body-lg">{q.whyYourAnswer}</p>
            </div>
          ) : null}
          {q.explanation ? (
            <div className="flex flex-col gap-1">
              <h3 className="m-0 text-body-lg font-bold">How to solve it</h3>
              <p className="m-0 font-reading text-body-lg">{q.explanation}</p>
            </div>
          ) : null}
          {q.tip ? (
            <div className="flex items-start gap-2.5 rounded-control border border-divider bg-bg px-3.5 py-3">
              <UiIcon name="hint" size={22} className="mt-0.5 flex-none" />
              <div className="flex flex-col">
                <span className="text-body font-bold">Tip</span>
                <span className="text-body">{q.tip}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-none flex-wrap items-center gap-3">
        {q.similarHref && !ok ? (
          <ButtonLink href={q.similarHref} prefetch={false} variant="secondary" icon="replay">
            Try a similar one
          </ButtonLink>
        ) : null}
        <Button onClick={onNext} iconAfter="arrow-right" className="ml-auto">
          {isLast ? 'Back to question 1' : 'Next question'}
        </Button>
      </div>
    </section>
  )
}

export function ReviewScreen({ data }: { data: ReviewDTO }): ReactElement {
  const questions = data.questions
  const start = Math.max(
    0,
    questions.findIndex((q) => q.position === data.openPosition),
  )
  const [sel, setSel] = useState(start)
  const listRef = useRef<HTMLDivElement>(null)
  const q = questions[sel]
  const right = questions.filter((x) => x.status === 'correct').length
  const style = SUBJECT_STYLE[data.subject]

  // Soal terpilih tetap terlihat di daftar.
  useEffect(() => {
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const pick = (i: number) => {
    setSel(i)
    // Fokus pindah ke judul soal supaya pembaca layar langsung membaca pembahasannya.
    window.setTimeout(() => document.getElementById(`review-q-${questions[i]?.position}`)?.focus(), 0)
  }

  return (
    <div data-jenjang={data.shell.jenjang} className="flex min-h-svh flex-col bg-bg text-fg lg:h-svh lg:overflow-hidden">
      <header className="flex min-h-18 flex-none flex-wrap items-center gap-3 px-4 py-2 md:h-22 md:gap-4 md:px-8 md:py-0">
        <IconLink href={data.backHref} icon="arrow-left" label="Back to the score" />
        <SubjectChip subject={data.subject} size="M" />
        <div className="flex min-w-0 flex-col">
          <h1 className="m-0 text-body-lg font-bold">{data.title}</h1>
          <span className="text-body text-fg-muted">
            {right} of {questions.length} right
          </span>
        </div>
      </header>

      {questions.length === 0 || !q ? (
        <main className="flex flex-1 items-center justify-center px-4 pb-10">
          <p className="m-0 text-body-lg">The answers for this paper are not ready yet. Try again after your tutor has marked it.</p>
        </main>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-6 md:px-8 md:pb-8 lg:flex-row lg:gap-6">
          <nav aria-label="Questions" className="lg:w-72 lg:flex-none">
            <div ref={listRef} className="flex flex-wrap gap-2 lg:h-full lg:flex-col lg:flex-nowrap lg:gap-1.5 lg:overflow-y-auto lg:pr-1">
              {questions.map((x, i) => {
                const on = i === sel
                return (
                  <button
                    key={x.position}
                    type="button"
                    aria-current={on ? 'true' : undefined}
                    aria-label={`Question ${x.position}, ${STATUS_WORD[x.status]}`}
                    onClick={() => pick(i)}
                    className={cx(
                      'flex h-14 flex-none cursor-pointer items-center gap-2 rounded-control px-2.5 text-left text-fg lg:h-15 lg:gap-3 lg:px-3.5',
                      on ? cx('border-3', style.border, style.tint) : 'border border-divider bg-surface hover:border-border',
                    )}
                  >
                    <span className={cx('inline-flex h-8 min-w-10 flex-none items-center justify-center rounded-pill px-2.5 text-body font-bold text-white tabular-nums', style.solid)}>
                      {x.position}
                    </span>
                    <span className="hidden min-w-0 flex-1 truncate text-body font-semibold lg:block">{x.item.prompt}</span>
                    <StatusIcon status={x.status} />
                  </button>
                )
              })}
            </div>
          </nav>
          <QuestionDetail key={q.position} q={q} data={data} isLast={sel >= questions.length - 1} onNext={() => pick(sel >= questions.length - 1 ? 0 : sel + 1)} />
        </div>
      )}
    </div>
  )
}
