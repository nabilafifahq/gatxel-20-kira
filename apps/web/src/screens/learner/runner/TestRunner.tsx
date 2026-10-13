'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { RunnerActions, RunnerDTO } from '@/lib/dto'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { Dialog } from '@/components/ui/Dialog'
import { UiIcon } from '@/components/ui/icons'
import { joinAnd } from '@/components/learner/format'
import { useMediaQuery, useOnline, useTicker } from '@/components/learner/hooks'
import { OfflineBanner } from '@/components/learner/OfflineBanner'
import { ReadAloudButton } from '@/components/learner/ReadAloudButton'
import { SubjectChip } from '@/components/learner/SubjectChip'
import { SUBJECT_STYLE } from '@/components/learner/subject'
import { Timer } from '@/components/learner/Timer'
import { isAnswerComplete } from '@/components/widgets/answers'
import { WidgetDensityContext } from '@/components/widgets/density'
import { QuestionView, TermsPanel } from '@/components/widgets/QuestionView'
import { speakableText } from '@/components/widgets/speakable'
import { Widget } from '@/components/widgets/Widget'
import { ExitControl, ReportControl } from './parts'
import { savedByPosition, sortedItems, testWord, type RunnerUpload } from './shared'
import { newClientId, useAnswerQueue } from './useAnswerQueue'

/**
 * Runner tes berwaktu dan simulasi (papan RunnerMingguan, RunnerEsmo, RunnerTes):
 * palet nomor untuk lompat antarsoal, tanda Look again per soal, jawaban disimpan saat
 * berubah tanpa menampilkan benar atau salah, peringatan sisa 1 menit, konfirmasi kumpul
 * yang menyebut soal kosong dan bertanda, dan kumpul otomatis saat waktu habis.
 */

type Answer = { value: unknown | null; flagged: boolean; startedAt: number; spentMs: number }

const SAVE_DELAY = 800

export function TestRunner({ data, actions, onUpload }: { data: RunnerDTO; actions: RunnerActions; onUpload?: RunnerUpload }): ReactElement {
  const router = useRouter()
  const items = useMemo(() => sortedItems(data), [data])
  const [answers, setAnswers] = useState<Answer[]>(() => {
    const saved = savedByPosition(data.saved)
    return items.map((it) => {
      const s = saved.get(it.position)
      return { value: s && s.status !== 'blank' ? (s.answer ?? null) : null, flagged: s?.flagged ?? false, startedAt: 0, spentMs: 0 }
    })
  })
  const [index, setIndex] = useState(() => {
    const first = answers.findIndex((a) => a.value === null)
    return first >= 0 ? first : 0
  })
  const [phase, setPhase] = useState<'answer' | 'confirm' | 'timeup'>('answer')
  const [submit, setSubmit] = useState<{ state: 'idle' | 'busy' | 'done' | 'error'; redirectTo?: string; message?: string; reference?: string }>({ state: 'idle' })
  const [termsOpen, setTermsOpen] = useState(false)
  const queue = useAnswerQueue(actions.saveAnswer)
  const online = useOnline()
  const wide = useMediaQuery('(min-width: 1024px)')
  const narrow = useMediaQuery('(max-width: 639px)')
  const loadedAt = useRef(Date.now())
  const now = useTicker(submit.state !== 'done')
  const submitClientId = useRef(newClientId())
  const timers = useRef(new Map<number, number>())

  const elapsed = data.elapsedSec + Math.max(0, Math.floor((now - loadedAt.current) / 1000))
  const remaining = data.timeLimitSec !== null ? Math.max(0, data.timeLimitSec - elapsed) : null
  const item = items[index]
  const cur = answers[index]
  const subject = data.subject
  const style = SUBJECT_STYLE[subject]
  const locked = phase === 'timeup' || submit.state === 'busy' || submit.state === 'done'

  // Catat waktu per soal (dipakai sebagai timeMs).
  useEffect(() => {
    setAnswers((list) => list.map((a, k) => (k === index ? { ...a, startedAt: Date.now() } : a)))
  }, [index])

  const save = useCallback(
    (i: number, a: Answer) => {
      const it = items[i]
      if (!it) return
      void queue.enqueue({
        attemptId: data.attemptId,
        position: it.position,
        answer: a.value,
        hintsUsed: 0,
        attemptNo: 1,
        timeMs: Math.max(0, a.spentMs + (a.startedAt ? Date.now() - a.startedAt : 0)),
        flagged: a.flagged,
        clientId: newClientId(),
        answeredAt: new Date().toISOString(),
      })
    },
    [data.attemptId, items, queue],
  )

  const scheduleSave = useCallback(
    (i: number, a: Answer) => {
      const t = timers.current.get(i)
      if (t) window.clearTimeout(t)
      timers.current.set(
        i,
        window.setTimeout(() => {
          timers.current.delete(i)
          save(i, a)
        }, SAVE_DELAY),
      )
    },
    [save],
  )

  const flushSaves = useCallback(() => {
    timers.current.forEach((t, i) => {
      window.clearTimeout(t)
      const a = answers[i]
      if (a) save(i, a)
    })
    timers.current.clear()
  }, [answers, save])

  const setValue = (v: unknown | null) => {
    if (locked || !cur) return
    const a = { ...cur, value: v }
    setAnswers((list) => list.map((x, k) => (k === index ? { ...x, value: v } : x)))
    scheduleSave(index, a)
  }

  const toggleFlag = () => {
    if (locked || !cur) return
    const a = { ...cur, flagged: !cur.flagged }
    setAnswers((list) => list.map((x, k) => (k === index ? a : x)))
    // Tanda tanpa jawaban hanya disimpan di perangkat; tanda dengan jawaban ikut tersimpan.
    if (a.value !== null) scheduleSave(index, a)
  }

  const go = (i: number) => {
    if (i < 0 || i >= items.length || locked) return
    setAnswers((list) => list.map((a, k) => (k === index && a.startedAt ? { ...a, spentMs: a.spentMs + (Date.now() - a.startedAt), startedAt: 0 } : a)))
    setTermsOpen(false)
    setIndex(i)
  }

  const handIn = useCallback(async () => {
    setSubmit({ state: 'busy' })
    flushSaves()
    await queue.flush(5000)
    try {
      const res = await actions.submitAttempt(data.attemptId, submitClientId.current)
      if (res.ok) setSubmit({ state: 'done', redirectTo: res.data.redirectTo || data.doneHref })
      else setSubmit({ state: 'error', message: res.message, reference: res.reference })
    } catch {
      setSubmit({ state: 'error', message: 'Your answers could not be handed in yet.', reference: 'KRA-RUN-NET' })
    }
  }, [actions, data.attemptId, data.doneHref, flushSaves, queue])

  // Waktu habis: kumpulkan otomatis.
  const timeUpHandled = useRef(false)
  useEffect(() => {
    if (remaining === 0 && !timeUpHandled.current) {
      timeUpHandled.current = true
      setPhase('timeup')
      setTermsOpen(false)
      void handIn()
    }
  }, [remaining, handIn])

  // Setelah kumpul manual berhasil, langsung ke halaman hasil.
  useEffect(() => {
    if (submit.state === 'done' && phase !== 'timeup' && submit.redirectTo) router.push(submit.redirectTo)
  }, [submit, phase, router])

  if (!item || !cur) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-bg p-8 text-body-lg">
        This {testWord(data.kind)} has no questions yet.
      </div>
    )
  }

  const unanswered = answers.map((a, k) => (a.value === null || !isAnswerComplete(items[k] ?? item, a.value) ? (items[k]?.position ?? k + 1) : -1)).filter((n) => n >= 0)
  const flagged = answers.map((a, k) => (a.flagged ? (items[k]?.position ?? k + 1) : -1)).filter((n) => n >= 0)
  const answeredN = items.length - unanswered.length
  const low = remaining !== null && remaining > 0 && remaining <= 60
  const isLast = index >= items.length - 1
  const word = testWord(data.kind)
  const many = items.length > 20
  const showTermsBtn = data.showTerms && !!item.terms && item.terms.length > 0
  const syncState = !online ? 'offline' : queue.stuck && queue.pending > 0 ? 'pending' : queue.justSynced ? 'synced' : null
  const upload = onUpload ? (blob: Blob, kind: 'audio' | 'drawing' | 'image') => onUpload(blob, kind, { attemptId: data.attemptId, position: item.position }) : undefined

  return (
    <div data-jenjang={data.shell.jenjang} className="flex min-h-svh flex-col bg-bg text-fg lg:h-svh lg:overflow-hidden">
      <header className="flex min-h-18 flex-none flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 md:h-22 md:flex-nowrap md:px-8 md:py-0">
        <ExitControl
          exitHref={data.exitHref}
          ariaLabel="Exit and save"
          title={`Leave this ${word}?`}
          body={data.timeLimitSec ? 'Your answers are saved. The clock keeps going while you are away.' : 'Your answers are saved. You can carry on later.'}
          beforeLeave={async () => {
            flushSaves()
            await queue.flush(1500)
          }}
        />
        <span className="hidden md:inline-flex"><SubjectChip subject={subject} size="M" /></span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-lg font-bold">{data.title}</span>
          <span className="text-body text-fg-muted tabular-nums">
            Question {index + 1} of {items.length}
          </span>
        </div>
        {syncState ? (
          <span className="hidden md:inline-flex">
            <OfflineBanner state={syncState} pendingCount={queue.pending} />
          </span>
        ) : null}
        {showTermsBtn ? (
          <Button
            variant="secondary"
            icon="book"
            aria-expanded={termsOpen}
            onClick={() => setTermsOpen((o) => !o)}
            className={cx('px-4.5 aria-expanded:border-fg', subject === 'math' ? 'aria-expanded:bg-math-50' : subject === 'english' ? 'aria-expanded:bg-english-50' : 'aria-expanded:bg-science-50')}
          >
            Terms
          </Button>
        ) : null}
        {remaining !== null ? <Timer mode="countdown" seconds={remaining} compact={narrow} /> : <Timer mode="stopwatch" seconds={elapsed} compact={narrow} />}
      </header>

      <nav aria-label="Questions" className={cx('flex flex-none flex-wrap items-center gap-6 px-4 md:px-8', many ? 'pb-3' : 'pb-4')}>
        <ol className={cx('m-0 flex list-none flex-wrap p-0', many ? 'gap-1.5' : 'gap-2')}>
          {items.map((it, k) => {
            const a = answers[k]
            const done = !!a && isAnswerComplete(it, a.value)
            const now = k === index
            return (
              <li key={it.ref} className="flex">
                <button
                  type="button"
                  onClick={() => go(k)}
                  disabled={locked}
                  aria-current={now ? 'step' : undefined}
                  aria-label={`Question ${it.position}${done ? ', answered' : ', no answer yet'}${a?.flagged ? ', look again' : ''}${now ? ', now' : ''}`}
                  className={cx(
                    'relative cursor-pointer rounded-control p-0 font-bold tabular-nums',
                    many ? 'h-11 w-11 text-body' : 'h-12 w-12 text-body-lg',
                    done ? cx(style.solid, 'text-white') : 'bg-surface text-fg',
                    now ? 'border-3 border-fg' : done ? cx('border-2', style.border) : 'border-2 border-border',
                  )}
                >
                  {it.position}
                  {a?.flagged ? (
                    <span className="absolute -top-2 -right-2 flex h-5.5 w-5.5 items-center justify-center rounded-pill border-2 border-white bg-warn text-white">
                      <UiIcon name="flag-filled" size={12} strokeWidth={2.5} />
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ol>
        {!many ? (
          <div aria-hidden="true" className="ml-auto hidden items-center gap-5 text-body font-semibold text-fg-muted lg:flex">
            <span className="inline-flex items-center gap-2">
              <span className={cx('h-5 w-5 rounded-control', style.solid)} />
              Answered
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="flex h-5.5 w-5.5 items-center justify-center rounded-pill bg-warn text-white">
                <UiIcon name="flag-filled" size={12} />
              </span>
              Look again
            </span>
          </div>
        ) : null}
      </nav>

      {syncState ? <OfflineBanner state={syncState} pendingCount={queue.pending} variant="banner" className="mx-4 mb-2.5 md:hidden" /> : null}

      {phase === 'answer' && low && unanswered.length > 0 ? (
        <div role="status" className="mx-4 mb-3 flex flex-none items-center gap-2.5 text-body-lg font-bold text-warn md:mx-8">
          <UiIcon name="alert-circle" size={22} />
          No answer yet: {joinAnd(unanswered.slice(0, 6))}
          {unanswered.length > 6 ? ' and more' : ''}.
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col gap-4 px-4 md:px-8 lg:flex-row lg:gap-6">
        <section aria-label="Question" className="min-h-0 overflow-y-auto rounded-card border border-divider bg-surface p-4 md:p-8 lg:flex-[1.15]">
          <QuestionView
            key={item.ref}
            item={item}
            number={item.position}
            subject={subject}
            hideTools
            answer={{ value: cur.value, onChange: setValue, disabled: locked }}
          />
        </section>
        <section aria-label="Answers" className="flex min-h-0 flex-col overflow-y-auto py-1 lg:flex-1">
          <div className="m-auto flex w-full flex-col gap-3.5">
            <WidgetDensityContext.Provider value="exam">
              <Widget item={item} value={cur.value} onChange={setValue} disabled={locked} feedback={null} subject={subject} onUpload={upload} />
            </WidgetDensityContext.Provider>
          </div>
        </section>
        {termsOpen && showTermsBtn && item.terms ? (
          <TermsPanel
            terms={item.terms}
            onClose={() => setTermsOpen(false)}
            className={cx('z-20', wide ? 'absolute top-1 right-8 w-[452px]' : 'order-first')}
          />
        ) : null}
      </div>

      <footer className="sticky bottom-0 z-10 flex min-h-21 flex-none flex-wrap items-center gap-3 bg-bg px-4 py-3 md:min-h-24 md:px-8">
        <Button
          variant="secondary"
          aria-pressed={cur.flagged}
          onClick={toggleFlag}
          disabled={locked}
          className="aria-pressed:border-3 aria-pressed:border-warn"
        >
          <UiIcon name={cur.flagged ? 'flag-filled' : 'flag'} size={22} className={cur.flagged ? 'text-warn' : undefined} />
          Look again
        </Button>
        <ReadAloudButton text={speakableText(item)} lang={item.lang} subject={subject} showNote={false} compact={narrow} />
        <ReportControl itemRef={item.ref} reportProblem={actions.reportProblem} className="max-md:hidden" />
        <div className="ml-auto flex gap-3">
          <Button variant="secondary" icon="arrow-left" disabled={index === 0 || locked} onClick={() => go(index - 1)} className="max-sm:px-3">
            <span className="max-sm:sr-only">Previous</span>
          </Button>
          <Button
            iconAfter={isLast ? undefined : 'arrow-right'}
            disabled={locked}
            onClick={() => (isLast ? setPhase('confirm') : go(index + 1))}
            className="min-w-36 lg:min-w-45"
          >
            {isLast ? 'Hand in' : 'Next'}
          </Button>
        </div>
      </footer>

      <Dialog
        open={phase === 'confirm'}
        onClose={() => submit.state !== 'busy' && setPhase('answer')}
        title={`Hand in your ${word}?`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPhase('answer')} disabled={submit.state === 'busy'} data-autofocus>
              Go back
            </Button>
            <Button iconAfter="arrow-right" loading={submit.state === 'busy'} onClick={() => void handIn()}>
              Hand in
            </Button>
          </>
        }
      >
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          <li className="flex items-start gap-3 text-body-lg">
            <UiIcon name="check-circle" size={24} className="mt-0.5 text-success" />
            <span>
              You answered {answeredN} of {items.length}.
            </span>
          </li>
          {unanswered.length > 0 ? (
            <li className="flex items-start gap-3 text-body-lg">
              <UiIcon name="alert-circle" size={24} className="mt-0.5 text-warn" />
              <span>
                {unanswered.length === 1 ? `Question ${unanswered[0]} has no answer yet.` : `Questions ${joinAnd(unanswered)} have no answer yet.`}
              </span>
            </li>
          ) : null}
          {flagged.length > 0 ? (
            <li className="flex items-start gap-3 text-body-lg">
              <UiIcon name="flag-filled" size={24} className="mt-0.5 text-warn" />
              <span>
                {flagged.length === 1 ? `Question ${flagged[0]} is marked to look again.` : `Questions ${joinAnd(flagged)} are marked to look again.`}
              </span>
            </li>
          ) : null}
          {unanswered.length > 0 ? (
            <li className="flex items-start gap-3 text-body-lg">
              <UiIcon name="hint" size={24} className="mt-0.5" />
              <span>Wrong answers do not take points off, so a guess is better than a blank.</span>
            </li>
          ) : null}
        </ul>
        {submit.state === 'error' ? <SubmitError message={submit.message} reference={submit.reference} online={online} /> : null}
      </Dialog>

      <Dialog
        open={phase === 'timeup'}
        onClose={() => undefined}
        dismissible={false}
        role="alertdialog"
        align="center"
        size="sm"
        title={
          <span className="flex flex-col items-center gap-3.5">
            <span className="flex h-28 w-28 items-center justify-center rounded-card border-2 border-fg bg-bg">
              <UiIcon name="clock" size={60} />
            </span>
            Time&apos;s up
          </span>
        }
      >
        <div className="flex flex-col items-center gap-3.5 text-center">
          <p className="m-0 text-body-lg">
            Your answers are saved. You answered {answeredN} of {items.length}.
          </p>
          {submit.state === 'error' ? (
            <>
              <SubmitError message={submit.message} reference={submit.reference} online={online} />
              <Button variant="secondary" onClick={() => void handIn()}>
                Try again
              </Button>
            </>
          ) : (
            <Button
              iconAfter="arrow-right"
              loading={submit.state === 'busy'}
              onClick={() => submit.redirectTo && router.push(submit.redirectTo)}
              data-autofocus
            >
              See my score
            </Button>
          )}
        </div>
      </Dialog>
    </div>
  )
}

function SubmitError({ message, reference, online }: { message?: string; reference?: string; online: boolean }): ReactElement {
  return (
    <div role="alert" className="flex flex-col gap-1 rounded-control border-2 border-danger bg-danger-50 px-4 py-3">
      <p className="m-0 text-body-lg">
        {message ?? 'Your answers could not be handed in yet.'} {online ? 'Try again in a moment.' : 'Connect to the internet, then try again. Your answers are safe here.'}
      </p>
      {reference ? <p className="m-0 text-body text-fg-muted tabular-nums">Reference {reference}</p> : null}
    </div>
  )
}
