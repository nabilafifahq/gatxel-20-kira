'use client'

import { useState, type ReactElement, type ReactNode } from 'react'
import type { SolutionStep } from '@kira/content/schema'
import type { FigureSpec } from '@kira/figures'
import type { RemedialLessonDTO, Subject } from '@/lib/dto'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { Dialog } from '@/components/ui/Dialog'
import { UiIcon } from '@/components/ui/icons'
import { KiraStar } from '@/components/ui/KiraStar'
import { SolutionPlayer } from './SolutionPlayer'
import { XpPill } from './XpPill'

/**
 * Lembar umpan balik (papan FeedbackSheet). Di tablet mendatar menempel di kolom jawaban
 * dan tidak menutupi teks soal; di HP menjadi lembar bawah. Masuk dari bawah dalam 240 ms.
 * Varian: correct (dengan XP), not-yet (dengan hint dan Try again), revealed (jawaban,
 * penjelasan, Show me how), sent (jawaban buatan dikirim ke tutor), saved (jawaban tersimpan
 * tetapi belum bisa diperiksa di perangkat, misalnya kunci tidak ikut dan server belum menjawab).
 */

export type FeedbackKind = 'correct' | 'not-yet' | 'revealed' | 'sent' | 'saved'

type Action = { label: string; onClick: () => void; icon?: 'arrow-right' }

/**
 * Putaran perbaikan setelah jawaban salah di Latihan: tonton pembahasan, satu langkah pelajaran, lalu satu
 * soal serupa. Tiap langkah muncul setelah yang sebelumnya, dan Next selalu ada, jadi tidak memaksa.
 * lesson: undefined belum dimuat, null skill belum punya pelajaran.
 */
export type RemedialProps = {
  watched: boolean
  lessonDone: boolean
  lesson: RemedialLessonDTO | null | undefined
  loading: boolean
  /** Ada soal serupa untuk dicoba. */
  canTry: boolean
  onWatched: () => void
  onLessonOpen: () => void
  onLessonDone: () => void
  onTry: () => void
}

export function FeedbackSheet({
  kind,
  subject,
  xp = 0,
  hintsUsed = 0,
  secondTry = false,
  explanation,
  hint,
  onShowHint,
  showHintLabel,
  answerText,
  solution,
  savedLine,
  primary,
  className,
  remedial,
  prompt,
  figure,
  fixItNote = false,
  hasSolution = false,
  onLoadSolution,
}: {
  kind: FeedbackKind
  subject: Subject
  xp?: number
  hintsUsed?: number
  secondTry?: boolean
  explanation?: string
  /** Hint yang sudah dibuka untuk ditampilkan di lembar not-yet. */
  hint?: { label: string; text: string } | null
  /** Tawarkan hint berikutnya tanpa membukanya otomatis. */
  onShowHint?: () => void
  showHintLabel?: string
  answerText?: string
  solution?: SolutionStep[] | null
  /** Kalimat simpan offline, misalnya "Saved on this tablet. It will sync when you are back online." */
  savedLine?: string | null
  primary: Action
  className?: string
  remedial?: RemedialProps
  prompt?: string
  figure?: FigureSpec
  /** Soal serupa juga salah: skill masuk Fix-it. */
  fixItNote?: boolean
  /** Pembahasan ada tetapi belum dimuat (dimuat malas). */
  hasSolution?: boolean
  onLoadSolution?: () => void
}): ReactElement {
  const canWatch = (solution?.length ?? 0) > 0 || hasSolution
  const [howOpen, setHowOpen] = useState(false)
  const [lessonOpen, setLessonOpen] = useState(false)
  const good = kind === 'correct' || kind === 'sent' || kind === 'saved'

  let title: ReactNode = 'Correct'
  if (kind === 'not-yet' || kind === 'revealed') title = 'Not yet'
  if (kind === 'sent') title = 'Sent to your tutor'
  if (kind === 'saved') title = 'Saved'

  return (
    <div
      role="status"
      className={cx(
        'motion-fade flex flex-col gap-4 rounded-xl p-5 starting:translate-y-4 starting:opacity-0 md:p-6',
        good ? 'bg-surface shadow-soft' : 'bg-lavender',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3.5">
        <span className={cx('inline-flex h-12 w-12 flex-none items-center justify-center rounded-pill', good ? 'bg-success text-white' : 'border-2 border-fg bg-surface text-fg')}>
          <UiIcon name={good ? 'check' : 'not-yet'} size={28} />
        </span>
        <h2 className="m-0 font-display text-h1 font-semibold">{title}</h2>
        <KiraStar size={56} mood={good ? 'happy' : 'calm'} className="ml-auto max-sm:hidden" />
        {kind === 'correct' && xp > 0 ? <XpPill xp={xp} className="max-sm:ml-auto" /> : null}
      </div>

      {kind === 'correct' && (hintsUsed > 0 || secondTry) ? (
        <p className="m-0 text-body text-fg-muted">
          {hintsUsed > 0
            ? `You used ${hintsUsed} ${hintsUsed === 1 ? 'hint' : 'hints'} on this one.`
            : 'Right on the second try.'}
        </p>
      ) : null}

      {kind === 'sent' ? <p className="m-0 text-body-lg">Your tutor will look at it and give you stars. Keep going with your quest.</p> : null}
      {kind === 'saved' ? <p className="m-0 text-body-lg">Your answer is saved. You will see if it is right on the results page.</p> : null}

      {kind === 'not-yet' && hint ? (
        <div className="flex items-start gap-3 rounded-control bg-sky p-4">
          <UiIcon name="hint" size={24} className="mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <div className="text-body font-bold">{hint.label}</div>
            <p className="m-0 font-reading text-h3">{hint.text}</p>
          </div>
        </div>
      ) : null}

      {kind === 'not-yet' && !hint ? <p className="m-0 text-body-lg">Look at the question again, then try once more.</p> : null}

      {kind === 'revealed' && answerText ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-body font-semibold text-fg-muted">The answer</span>
          <span className="font-reading text-h2 font-bold">{answerText}</span>
        </div>
      ) : null}

      {kind === 'correct' && explanation ? <p className="m-0 font-reading text-h3">{explanation}</p> : null}

      {kind === 'revealed' && explanation ? (
        <div className={cx('flex flex-col gap-0.5 rounded-control px-4 py-3.5', 'bg-lavender')}>
          <div className="text-body font-bold">How to solve it</div>
          <p className="m-0 font-reading text-h3">{explanation}</p>
        </div>
      ) : null}

      {kind === 'revealed' && fixItNote ? (
        <p className="m-0 rounded-control bg-bg px-4 py-3 text-body font-semibold">This one is tricky. It is now in Fix-it, so you can practise it again later.</p>
      ) : null}

      {kind === 'revealed' && remedial ? (
        <div className="flex flex-col gap-2.5 rounded-control border border-divider bg-bg p-4" data-testid="remedial-panel">
          <div className="text-body font-bold">Let us fix this one</div>
          {!remedial.watched && canWatch ? (
            <Button
              variant="secondary"
              icon="play"
              onClick={() => {
                onLoadSolution?.()
                setHowOpen(true)
              }}
            >
              Watch how it works
            </Button>
          ) : null}
          {remedial.watched && remedial.lesson === undefined ? (
            <Button variant="secondary" icon="hint" loading disabled>
              Getting a quick lesson
            </Button>
          ) : null}
          {remedial.watched && !remedial.lessonDone && remedial.lesson ? (
            <Button
              variant="secondary"
              icon="hint"
              loading={remedial.loading}
              onClick={() => {
                remedial.onLessonOpen()
                setLessonOpen(true)
              }}
            >
              One quick lesson
            </Button>
          ) : null}
          {(remedial.watched && (remedial.lessonDone || remedial.lesson === null)) || (!canWatch && !remedial.watched) ? (
            remedial.canTry ? (
              <Button loading={remedial.loading} onClick={remedial.onTry}>
                Try one like it
              </Button>
            ) : (
              <p className="m-0 text-body text-fg-muted">Great, you have seen how it works. Keep going.</p>
            )
          ) : null}
        </div>
      ) : null}

      {savedLine ? (
        <div className="flex items-center gap-2 text-body font-semibold">
          <UiIcon name="offline" size={20} />
          {savedLine}
        </div>
      ) : null}

      <div className={cx('sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-wrap justify-end gap-3 rounded-b-xl px-5 pb-5 pt-2 md:-mx-6 md:-mb-6 md:px-6 md:pb-6', good ? 'bg-surface' : 'bg-lavender')}>
        {kind === 'not-yet' && onShowHint ? (
          <Button variant="secondary" icon="hint" onClick={onShowHint}>
            {showHintLabel ?? 'Show hint'}
          </Button>
        ) : null}
        {kind === 'revealed' && canWatch && !remedial ? (
          <Button
            variant="secondary"
            onClick={() => {
              onLoadSolution?.()
              setHowOpen(true)
            }}
          >
            Show me how
          </Button>
        ) : null}
        <Button autoFocus iconAfter={primary.icon} onClick={primary.onClick}>
          {primary.label}
        </Button>
      </div>

      {canWatch ? (
        <Dialog
          open={howOpen}
          onClose={() => {
            setHowOpen(false)
            remedial?.onWatched()
          }}
          title="Show me how"
          size="lg"
          footer={
            <Button
              variant="secondary"
              onClick={() => {
                setHowOpen(false)
                remedial?.onWatched()
              }}
            >
              Close
            </Button>
          }
        >
          {solution && solution.length > 0 ? (
            <SolutionPlayer steps={solution} subject={subject} prompt={prompt} figure={figure} />
          ) : (
            <p className="m-0 text-body-lg" role="status">
              Getting the steps ready.
            </p>
          )}
        </Dialog>
      ) : null}
      {remedial?.lesson ? (
        <Dialog
          open={lessonOpen}
          onClose={() => {
            setLessonOpen(false)
            remedial.onLessonDone()
          }}
          title={remedial.lesson.title}
          size="lg"
          footer={
            <Button
              variant="secondary"
              onClick={() => {
                setLessonOpen(false)
                remedial.onLessonDone()
              }}
            >
              Close
            </Button>
          }
        >
          <SolutionPlayer steps={remedial.lesson.steps} subject={subject} label="Quick lesson" />
        </Dialog>
      ) : null}
    </div>
  )
}
