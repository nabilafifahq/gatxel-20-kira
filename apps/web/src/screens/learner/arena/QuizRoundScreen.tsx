'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { KAnswer, KClientQuestion, KOption } from '@kira/content/knowledge'
import type { QuizActions, QuizAnswerResult, QuizResultDTO, QuizRoundDTO } from '@/lib/dto-arena'
import { Button, ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { useOnline, useReducedMotion, useTicker } from '@/components/learner/hooks'
import { OfflineBanner } from '@/components/learner/OfflineBanner'
import { Timer } from '@/components/learner/Timer'
import { ArenaPic } from '@/components/learner/arena/ArenaPic'
import { RewardPanel } from '@/components/learner/arena/RewardPanel'
import { ExitControl } from '@/screens/learner/runner/parts'
import { ActionError } from '@/screens/learner/common'

/**
 * Ronde Quiz Arena: kartu belajar, kuis tanpa waktu, dan speed quiz. Soal dibuat acak di server dengan
 * pilihan yang diacak; jawaban diperiksa di server dan di mode berwaktu client tidak pernah menerima kunci.
 */

type Feedback = { ok: boolean; explain?: string; answerLabel?: string; chosen: KAnswer | null } | null

const AUTO_NEXT_MS = 1500

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms))
}

function Choice({ option, pics, state, onClick, disabled }: { option: KOption; pics: boolean; state: 'idle' | 'right' | 'wrong' | 'dim'; onClick: () => void; disabled: boolean }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={pics ? option.label : undefined}
      className={cx(
        'relative flex min-h-18 w-full items-center justify-center rounded-control border-2 px-4 py-3 text-center font-reading text-h3 transition-transform duration-150 ease-kira enabled:cursor-pointer enabled:active:scale-97',
        state === 'idle' && 'border-border bg-surface text-fg hover:border-fg',
        state === 'right' && 'border-3 border-success bg-success-50 font-bold',
        state === 'wrong' && 'border-3 border-warn bg-surface font-bold',
        state === 'dim' && 'border-divider bg-bg text-fg-muted',
      )}
    >
      {pics && option.pic ? <ArenaPic pic={option.pic} size={pics ? 76 : 48} /> : <span>{option.label}</span>}
      {state === 'right' ? (
        <span className="pointer-events-none absolute -top-3.5 right-2.5 inline-flex h-7 items-center gap-1 rounded-pill bg-success px-2.5 text-body font-bold text-white">
          <UiIcon name="check" size={16} /> Correct
        </span>
      ) : null}
      {state === 'wrong' ? (
        <span className="pointer-events-none absolute -top-3.5 right-2.5 inline-flex h-7 items-center gap-1 rounded-pill bg-warn px-2.5 text-body font-bold text-white">
          <UiIcon name="not-yet" size={16} /> Not yet
        </span>
      ) : null}
    </button>
  )
}

function OrderQuestion({ q, onSubmit, disabled }: { q: Extract<KClientQuestion, { kind: 'order' }>; onSubmit: (ids: string[]) => void; disabled: boolean }): ReactElement {
  const [picked, setPicked] = useState<string[]>([])
  const left = q.items.filter((i) => !picked.includes(i.id))
  return (
    <div className="flex w-full flex-col gap-4">
      <ol aria-label="Your order" className="m-0 grid list-none gap-2 p-0" style={{ gridTemplateColumns: `repeat(${q.items.length}, minmax(0, 1fr))` }}>
        {q.items.map((_, i) => {
          const id = picked[i]
          const item = q.items.find((x) => x.id === id)
          return (
            <li key={i} className="min-w-0">
              <button
                type="button"
                disabled={disabled || !item}
                onClick={() => item && setPicked(picked.filter((p) => p !== item.id))}
                aria-label={item ? `${i + 1}: ${item.label}. Tap to take it back.` : `Place ${i + 1}, empty`}
                className={cx('flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-control border-2 p-1 text-center', item ? 'border-3 border-knowledge bg-knowledge-50' : 'border-dashed border-border bg-bg')}
              >
                <span className="text-body font-bold text-knowledge">{i + 1}</span>
                {item ? (
                  <>
                    {item.pic ? <ArenaPic pic={item.pic} size={36} /> : null}
                    <span className="font-reading text-body leading-5 break-words">{item.label}</span>
                  </>
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>
      <ul aria-label="Tap in order" className="m-0 flex list-none flex-wrap justify-center gap-2 p-0">
        {left.map((item) => (
          <li key={item.id}>
            <button type="button" disabled={disabled} onClick={() => setPicked([...picked, item.id])} className="flex min-h-14 cursor-pointer items-center gap-2 rounded-control border-2 border-border bg-surface px-4 font-reading text-h3 hover:border-fg">
              {item.pic ? <ArenaPic pic={item.pic} size={36} /> : null}
              {item.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-center gap-3">
        <Button variant="secondary" size="M" onClick={() => setPicked([])} disabled={disabled || picked.length === 0}>
          Start again
        </Button>
        <Button size="M" onClick={() => onSubmit(picked)} disabled={disabled || picked.length !== q.items.length}>
          Check
        </Button>
      </div>
    </div>
  )
}

function ResultView({ data, result, actions }: { data: QuizRoundDTO; result: QuizResultDTO; actions: QuizActions }): ReactElement {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; reference: string } | null>(null)
  const run = async (mode: 'learn' | 'quiz' | 'speed') => {
    setBusy(true)
    setError(null)
    try {
      const res = await actions.start({ topic: data.topic, mode })
      if (res.ok) router.push(res.data.redirectTo)
      else setError({ message: res.message, reference: res.reference })
    } catch {
      setError({ message: 'The next round could not start. Check the internet and try again.', reference: 'KRA-QZ-NET' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section aria-label="Round done" className="flex w-full max-w-[640px] flex-col items-center gap-4 rounded-card border border-divider bg-surface px-5 py-8 text-center md:px-8">
      <h1 className="m-0 font-display text-display font-semibold">{result.title}</h1>
      <p className="m-0 text-body-lg text-fg-muted">{result.topicTitle}</p>
      {result.lines.map((l) => (
        <p key={l} className="m-0 text-body-lg">
          {l}
        </p>
      ))}
      <RewardPanel reward={result.reward} track="pengetahuan" shell={data.shell} />
      {error ? <ActionError message={error.message} reference={error.reference} /> : null}
      <div className="flex flex-wrap justify-center gap-3">
        <Button iconAfter={data.mode === 'learn' ? 'arrow-right' : 'replay'} loading={busy} onClick={() => void run(data.mode === 'learn' ? 'quiz' : data.mode)}>
          {data.mode === 'learn' ? 'Try a quiz' : 'Play again'}
        </Button>
        <ButtonLink href={result.nextHref} variant="secondary" iconAfter="arrow-right">
          Back to {data.topic === 'mix' ? 'Quiz Arena' : 'the topic'}
        </ButtonLink>
      </div>
      {result.review.length > 0 ? (
        <details className="w-full rounded-control border border-divider bg-surface text-left">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 text-body-lg font-bold">See my answers</summary>
          <ol className="m-0 flex list-none flex-col gap-3 p-4 pt-1">
            {result.review.map((r) => (
              <li key={r.i} className="flex items-start gap-3 text-body">
                <UiIcon name={r.ok ? 'check' : 'not-yet'} size={20} className={cx('mt-0.5', r.ok ? 'text-success' : 'text-warn')} />
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold break-words">{r.prompt}</span>
                  <span className="text-fg-muted">You said: {r.yours}</span>
                  {!r.ok ? <span className="font-bold">Answer: {r.answer}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  )
}

function Cards({ data, actions, onDone }: { data: QuizRoundDTO; actions: QuizActions; onDone: () => void }): ReactElement {
  const [i, setI] = useState(data.done.length)
  const [flipped, setFlipped] = useState(false)
  const [busy, setBusy] = useState(false)
  const card = data.cards[i]
  useEffect(() => {
    if (!card) onDone()
  }, [card, onDone])
  if (!card) return <p className="m-0 text-body-lg">Counting up your cards</p>
  const next = async () => {
    setBusy(true)
    try {
      await actions.answer({ roundId: data.id, index: i, answer: 1, ms: 2000 })
    } finally {
      setBusy(false)
    }
    setFlipped(false)
    setI(i + 1)
  }
  return (
    <section aria-label={`Card ${i + 1} of ${data.cards.length}`} className="flex w-full max-w-[640px] flex-col items-center gap-5 rounded-card border border-divider bg-surface p-5 md:p-8">
      <p className="m-0 text-body font-bold text-knowledge">
        Card {i + 1} of {data.cards.length}
      </p>
      <button
        type="button"
        onClick={() => setFlipped(true)}
        aria-label={flipped ? 'Answer side' : 'Tap to see the answer'}
        className={cx('flex min-h-64 w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-card border-3 p-6 text-center', flipped ? 'border-knowledge bg-knowledge-50' : 'border-border bg-surface')}
      >
        {!flipped ? (
          <>
            {card.frontPic ? <ArenaPic pic={card.frontPic} size={card.frontPic.t === 'flag' ? 140 : 120} /> : null}
            <span className="text-question font-bold">{card.front}</span>
            <span className="text-body text-fg-muted">Tap to see the answer</span>
          </>
        ) : (
          <>
            {card.frontPic ? <ArenaPic pic={card.frontPic} size={card.frontPic.t === 'flag' ? 100 : 88} /> : null}
            <span className="text-question">{card.back}</span>
          </>
        )}
      </button>
      {flipped ? (
        <Button iconAfter="arrow-right" onClick={() => void next()} loading={busy} data-autofocus>
          {i === data.cards.length - 1 ? 'Finish' : 'Next card'}
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => setFlipped(true)}>
          Show the answer
        </Button>
      )}
    </section>
  )
}

export function QuizRoundScreen({ data, actions }: { data: QuizRoundDTO; actions: QuizActions }): ReactElement {
  const online = useOnline()
  const reduced = useReducedMotion()
  const learn = data.mode === 'learn'
  const total = learn ? data.cards.length : data.questions.length
  const [index, setIndex] = useState(learn ? 0 : data.done.length)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [busy, setBusy] = useState(false)
  const [right, setRight] = useState(data.right)
  const [result, setResult] = useState<QuizResultDTO | null>(data.finished)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<{ message: string; reference: string } | null>(null)
  const [syncFailed, setSyncFailed] = useState(false)
  const loadedAt = useRef(Date.now())
  const questionStart = useRef(Date.now())
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const finishCalled = useRef(false)

  const question = learn ? undefined : data.questions[index]
  const timed = data.timed
  const limit = data.limitSec
  const now = useTicker(!result && !finishing && timed, 250)
  const elapsed = data.elapsedSec + Math.floor((now - loadedAt.current) / 1000)
  const remaining = limit ? Math.max(0, limit - elapsed) : null
  const timeUp = timed && remaining === 0
  const over = !learn && index >= total

  useEffect(() => {
    questionStart.current = Date.now()
    setFeedback(null)
  }, [index])

  const finish = useCallback(async () => {
    if (finishCalled.current) return
    finishCalled.current = true
    setFinishing(true)
    setError(null)
    await chain.current.catch(() => undefined)
    try {
      const res = await actions.finish(data.id)
      if (res.ok) setResult(res.data)
      else {
        finishCalled.current = false
        setError({ message: res.message, reference: res.reference })
      }
    } catch {
      finishCalled.current = false
      setError({ message: 'Your round could not be handed in yet. Check the internet and try again.', reference: 'KRA-QZ-NET' })
    } finally {
      setFinishing(false)
    }
  }, [actions, data.id])

  useEffect(() => {
    if (!result && (over || timeUp) && !finishCalled.current) void finish()
  }, [over, timeUp, result, finish])

  const send = useCallback(
    async (answer: KAnswer | null, ms: number): Promise<QuizAnswerResult | null> => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await actions.answer({ roundId: data.id, index, answer, ms })
          if (res.ok) return res.data
          if (res.message.includes('order') || res.message.includes("Time's up")) return null
        } catch {
          // jaringan: coba lagi
        }
        await sleep(400 * (attempt + 1))
      }
      setSyncFailed(true)
      return null
    },
    [actions, data.id, index],
  )

  const submit = useCallback(
    async (answer: KAnswer | null) => {
      if (!question || busy || feedback || over || timeUp) return
      const ms = Date.now() - questionStart.current
      if (timed) {
        const call = chain.current.then(() => send(answer, ms))
        chain.current = call
        void call.then((res) => {
          if (res?.correct) setRight((n) => n + 1)
        })
        setIndex((i) => i + 1)
        return
      }
      setBusy(true)
      const res = await send(answer, ms)
      setBusy(false)
      if (!res) return
      if (res.correct) setRight((n) => n + 1)
      setFeedback({ ok: res.correct, chosen: answer, ...(res.explain ? { explain: res.explain } : {}), ...(res.answerLabel ? { answerLabel: res.answerLabel } : {}) })
      if (res.correct) {
        await sleep(reduced ? 900 : AUTO_NEXT_MS)
        setIndex((i) => i + 1)
      }
    },
    [busy, feedback, over, question, reduced, send, timeUp, timed],
  )

  const syncState = !online ? 'offline' : syncFailed ? 'pending' : null
  const progress = useMemo(() => (learn ? `Card ${Math.min(index + 1, total)} of ${total}` : timed ? `${right} right` : `Question ${Math.min(index + 1, total)} of ${total}`), [index, learn, right, timed, total])

  const optionState = (o: KOption, i: number): 'idle' | 'right' | 'wrong' | 'dim' => {
    if (!feedback) return 'idle'
    if (feedback.answerLabel === o.label) return 'right'
    if (feedback.chosen === i) return 'wrong'
    return 'dim'
  }

  return (
    <div data-jenjang={data.shell.jenjang} className="flex min-h-svh flex-col bg-bg text-fg">
      <header className="flex h-18 flex-none items-center gap-3 px-4 md:h-22 md:gap-4 md:px-8">
        <ExitControl
          exitHref={data.exitHref}
          title="Leave this round?"
          body={timed ? 'Your answers so far are saved, but this round will not count.' : 'Your answers so far are saved.'}
          ariaLabel="Exit round"
          beforeLeave={() => chain.current.catch(() => undefined)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-lg font-bold">{data.topicTitle}</span>
          <span className="truncate text-body text-fg-muted">{learn ? 'Flashcards' : data.mode === 'speed' ? 'Speed quiz' : 'Quiz'}</span>
        </div>
        {syncState ? (
          <span className="hidden md:inline-flex">
            <OfflineBanner state={syncState} pendingCount={0} />
          </span>
        ) : null}
        <span className="inline-flex flex-none items-center gap-2 text-body-lg font-bold tabular-nums">
          {timed ? <UiIcon name="check-circle" size={24} className="text-success" /> : null}
          {progress}
        </span>
        {timed && remaining !== null ? <Timer mode="countdown" seconds={remaining} compact warnAt={10} /> : null}
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-10 md:items-center md:px-8">
        {result ? (
          <ResultView data={data} result={result} actions={actions} />
        ) : finishing || over || timeUp ? (
          <section aria-label="Finishing" className="flex w-full max-w-[560px] flex-col items-center gap-4 rounded-card border border-divider bg-surface px-8 py-10 text-center">
            <h1 className="m-0 font-display text-display font-semibold">{timeUp ? "Time's up" : 'All done'}</h1>
            {error ? (
              <div role="alert" className="flex flex-col items-center gap-2">
                <p className="m-0 text-body-lg">{error.message}</p>
                <p className="m-0 text-body text-fg-muted tabular-nums">Reference {error.reference}</p>
                <Button variant="secondary" onClick={() => void finish()}>
                  Try again
                </Button>
              </div>
            ) : (
              <p className="m-0 flex items-center gap-2 text-body-lg">
                <UiIcon name="spinner" size={22} /> Counting up your answers
              </p>
            )}
          </section>
        ) : learn ? (
          <Cards data={data} actions={actions} onDone={() => void finish()} />
        ) : question ? (
          <section aria-label="Question" className="flex w-full max-w-[860px] flex-col items-center gap-5 rounded-card border border-divider bg-surface p-5 md:p-8">
            {!online ? (
              <p role="alert" className="m-0 flex items-center gap-2 rounded-control border-2 border-warn px-3 py-2 text-body font-bold">
                <UiIcon name="offline" size={20} />
                You are offline. Quiz Arena needs the internet.
              </p>
            ) : null}
            {question.kind !== 'order' && question.pic ? <ArenaPic pic={question.pic} size={question.pic.t === 'flag' ? 140 : 112} label={undefined} /> : null}
            <h1 lang="en-GB" className="text-question m-0 text-center font-bold">
              {question.prompt}
            </h1>
            {question.kind === 'mc' ? (
              <div className={cx('grid w-full gap-3', question.style === 'pics' ? 'grid-cols-2 sm:grid-cols-2' : 'sm:grid-cols-2')}>
                {question.options.map((o, i) => (
                  <Choice key={`${i}-${o.label}`} option={o} pics={question.style === 'pics'} state={optionState(o, i)} disabled={Boolean(feedback) || busy || !online} onClick={() => void submit(i)} />
                ))}
              </div>
            ) : null}
            {question.kind === 'tf' ? (
              <div className="grid w-full max-w-[560px] grid-cols-2 gap-3">
                {[true, false].map((v) => (
                  <Choice
                    key={String(v)}
                    option={{ label: v ? 'True' : 'False' }}
                    pics={false}
                    state={!feedback ? 'idle' : feedback.answerLabel === (v ? 'True' : 'False') ? 'right' : feedback.chosen === v ? 'wrong' : 'dim'}
                    disabled={Boolean(feedback) || busy || !online}
                    onClick={() => void submit(v)}
                  />
                ))}
              </div>
            ) : null}
            {question.kind === 'order' ? <OrderQuestion key={index} q={question} disabled={Boolean(feedback) || busy || !online} onSubmit={(ids) => void submit(ids)} /> : null}

            {feedback ? (
              <div role="status" className="flex w-full max-w-[640px] flex-col items-center gap-3 text-center">
                {feedback.explain ? <p className="text-question m-0">{feedback.explain}</p> : null}
                {!feedback.ok ? (
                  <Button iconAfter="arrow-right" onClick={() => setIndex((i) => i + 1)} data-autofocus>
                    Next
                  </Button>
                ) : null}
              </div>
            ) : null}
            {timed && !feedback ? (
              <Button variant="quiet" onClick={() => void submit(null)}>
                Skip
              </Button>
            ) : null}
            {error ? <ActionError message={error.message} reference={error.reference} /> : null}
          </section>
        ) : null}
      </main>
    </div>
  )
}
