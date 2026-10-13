'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { digitsToNumber, type QmPrompt, type QmReviewRow } from '@kira/core'
import type { QmActions, QmAnswerResult, QmResultDTO, QmRoundDTO } from '@/lib/dto-arena'
import { Button, ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { useOnline, useReducedMotion, useTicker } from '@/components/learner/hooks'
import { OfflineBanner } from '@/components/learner/OfflineBanner'
import { Timer } from '@/components/learner/Timer'
import { ArenaKeypad } from '@/components/learner/arena/ArenaKeypad'
import { RewardPanel } from '@/components/learner/arena/RewardPanel'
import { Soroban } from '@/components/learner/arena/Soroban'
import { ExitControl } from '@/screens/learner/runner/parts'
import { ActionError } from '@/screens/learner/common'

/**
 * Ronde Quick Maths: latihan, sprint, target, tabel, Flash Anzan, dan sempoa. Jawaban diperiksa di server;
 * di mode berwaktu client hanya menerima benar atau salah, tidak pernah kunci.
 */

type Feedback = { ok: boolean; answer?: number; hint?: { title: string; steps: string[] } } | null

const NEXT_DELAY_MS = 800

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms))
}

function Prompt({ prompt, shown, flashIndex, flashing }: { prompt: QmPrompt; shown: boolean; flashIndex: number; flashing: boolean }): ReactElement {
  if (prompt.kind === 'arith') {
    return (
      <p lang="en-GB" aria-live="polite" className="m-0 text-center font-display text-display font-semibold tabular-nums">
        {prompt.text}
      </p>
    )
  }
  if (prompt.kind === 'flash') {
    const term = prompt.terms[flashIndex]
    const text = term === undefined ? '' : flashIndex === 0 ? String(term) : term < 0 ? `− ${-term}` : `+ ${term}`
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
        {flashing ? (
          <p aria-hidden="true" className="m-0 font-display text-[120px] leading-none font-semibold tabular-nums">
            {text}
          </p>
        ) : shown ? (
          <>
            <p className="m-0 text-h2 font-bold">What is the total?</p>
            <p className="m-0 text-body-lg text-fg-muted">Type it in.</p>
          </>
        ) : (
          <p className="m-0 text-h2 font-bold">{prompt.terms.length} numbers will flash by</p>
        )}
      </div>
    )
  }
  return <p className="m-0 text-center text-h2 font-bold">Soroban</p>
}

function ReviewList({ rows }: { rows: QmReviewRow[] }): ReactElement {
  return (
    <details className="w-full rounded-control border border-divider bg-surface">
      <summary className="flex min-h-12 cursor-pointer items-center px-4 text-body-lg font-bold">See my answers</summary>
      <ol className="m-0 flex list-none flex-col gap-1.5 p-4 pt-1">
        {rows.map((r) => (
          <li key={r.i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-body tabular-nums">
            <UiIcon name={r.ok ? 'check' : 'not-yet'} size={18} className={r.ok ? 'text-success' : 'text-warn'} />
            <span className="font-bold">{r.text}</span>
            <span className="text-fg-muted">{r.yours === null ? 'skipped' : `you said ${r.yours}`}</span>
            {!r.ok ? <span className="font-bold">answer {r.answer}</span> : null}
          </li>
        ))}
      </ol>
    </details>
  )
}

function ResultView({ data, result, actions }: { data: QmRoundDTO; result: QmResultDTO; actions: QmActions }): ReactElement {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; reference: string } | null>(null)
  const again = async () => {
    if (!data.again) return
    setBusy(true)
    setError(null)
    try {
      const res = await actions.start(data.again)
      if (res.ok) router.push(res.data.redirectTo)
      else setError({ message: res.message, reference: res.reference })
    } catch {
      setError({ message: 'Your next round could not start. Check the internet and try again.', reference: 'KRA-QM-NET' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section aria-label="Round done" className="flex w-full max-w-[640px] flex-col items-center gap-4 rounded-card border border-divider bg-surface px-5 py-8 text-center md:px-8">
      <h1 className="m-0 font-display text-display font-semibold">{result.title}</h1>
      {result.strategyDone ? <p className="m-0 text-body-lg font-bold text-mental">{result.strategyDone.title}: you have the hang of it.</p> : null}
      {result.lines.map((l) => (
        <p key={l} className="m-0 text-body-lg">
          {l}
        </p>
      ))}
      {result.mission ? (
        <p role="status" className="m-0 rounded-card border-2 border-mental bg-mental-50 px-4 py-2 text-body-lg font-bold text-mental">
          {result.mission.complete
            ? `Daily mission done!${result.mission.bonusXp > 0 ? ` Bonus ${result.mission.bonusXp} XP.` : ''}`
            : `Mission step ${result.mission.stepsDone} of ${result.mission.stepsTotal} done.`}
        </p>
      ) : null}
      {result.levelNotes.map((n) => (
        <p key={n} className="m-0 text-body text-fg-muted">
          {n}
        </p>
      ))}
      <RewardPanel reward={result.reward} track="hitung" shell={data.shell} />
      {error ? <ActionError message={error.message} reference={error.reference} /> : null}
      <div className="flex flex-wrap justify-center gap-3">
        {data.again ? (
          <Button iconAfter="replay" loading={busy} onClick={() => void again()}>
            Play again
          </Button>
        ) : null}
        <ButtonLink href={result.nextHref} variant={data.again ? 'secondary' : 'primary'} iconAfter="arrow-right">
          {data.mission ? 'Back to the mission' : 'Back to Quick Maths'}
        </ButtonLink>
        {data.focus ? (
          <ButtonLink href={`/quick-maths/lessons/${data.focus.id}`} variant="secondary">
            Lesson again
          </ButtonLink>
        ) : null}
      </div>
      {result.review.length > 0 ? <ReviewList rows={result.review} /> : null}
    </section>
  )
}

export function QuickMathsRoundScreen({ data, actions }: { data: QmRoundDTO; actions: QmActions }): ReactElement {
  const online = useOnline()
  const reduced = useReducedMotion()
  const total = data.prompts.length
  const [index, setIndex] = useState(data.done.length)
  const [value, setValue] = useState('')
  const [beads, setBeads] = useState<number[]>([])
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [busy, setBusy] = useState(false)
  const [right, setRight] = useState(data.right)
  const [hint, setHint] = useState<{ title: string; steps: string[] } | null>(null)
  const [hintBusy, setHintBusy] = useState(false)
  const [result, setResult] = useState<QmResultDTO | null>(data.finished)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<{ message: string; reference: string } | null>(null)
  const [syncFailed, setSyncFailed] = useState(false)
  // Flash Anzan dan sempoa anzan: tahap tampil
  const [stage, setStage] = useState<'ready' | 'showing' | 'answer'>('ready')
  const [flashIndex, setFlashIndex] = useState(0)

  const loadedAt = useRef(Date.now())
  const questionStart = useRef(Date.now())
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const finishCalled = useRef(false)

  const prompt = data.prompts[index]
  const timed = data.timed
  const limit = data.limitSec
  const running = !result && !finishing
  const now = useTicker(running && (timed || data.mode === 'target20'), 250)
  const elapsed = data.elapsedSec + Math.floor((now - loadedAt.current) / 1000)
  const remaining = limit ? Math.max(0, limit - elapsed) : null
  const timeUp = timed && limit !== null && remaining === 0
  const over = index >= total
  const stopwatch = data.mode === 'target20'

  const kind = prompt?.kind
  const needsStart = kind === 'flash' || kind === 'bead-anzan'

  // Reset tahap setiap soal baru
  useEffect(() => {
    questionStart.current = Date.now()
    setValue('')
    setFeedback(null)
    setHint(null)
    setFlashIndex(0)
    setStage(needsStart ? 'ready' : 'answer')
    const p = data.prompts[index]
    if (p?.kind === 'bead-set') setBeads(Array.from({ length: p.rods }, () => 0))
  }, [index])

  const finish = useCallback(async () => {
    if (finishCalled.current) return
    finishCalled.current = true
    setFinishing(true)
    setError(null)
    await chain.current.catch(() => undefined)
    try {
      const res = await actions.finish(data.id)
      if (res.ok) {
        // sfx: complete, then levelup or badge when result.reward has them
        setResult(res.data)
      } else {
        finishCalled.current = false
        setError({ message: res.message, reference: res.reference })
      }
    } catch {
      finishCalled.current = false
      setError({ message: 'Your round could not be handed in yet. Check the internet and try again.', reference: 'KRA-QM-NET' })
    } finally {
      setFinishing(false)
    }
  }, [actions, data.id])

  useEffect(() => {
    if (!result && (over || timeUp) && !finishCalled.current) void finish()
  }, [over, timeUp, result, finish])

  // Flash Anzan dan anzan sempoa: jalankan urutan tampil
  useEffect(() => {
    if (stage !== 'showing' || !prompt) return
    let cancelled = false
    const run = async () => {
      if (prompt.kind === 'flash') {
        await sleep(450)
        for (let k = 0; k < prompt.terms.length; k++) {
          if (cancelled) return
          setFlashIndex(k)
          await sleep(prompt.intervalMs)
          if (cancelled) return
          setFlashIndex(-1)
          await sleep(reduced ? 200 : 140)
        }
      } else if (prompt.kind === 'bead-anzan') {
        await sleep(prompt.showMs)
      }
      if (!cancelled) {
        questionStart.current = Date.now()
        setStage('answer')
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [stage, prompt, reduced])

  const advance = useCallback(() => setIndex((i) => i + 1), [])

  const sendAnswer = useCallback(
    async (answer: number | null, ms: number): Promise<QmAnswerResult | null> => {
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
    async (answer: number | null) => {
      if (!prompt || busy || feedback || over || timeUp) return
      const ms = Date.now() - questionStart.current
      if (timed) {
        // Mode berwaktu: maju dulu, hasil benar atau salah menyusul dari server.
        const call = chain.current.then(() => sendAnswer(answer, ms))
        chain.current = call
        void call.then((res) => {
          // sfx: correct or notyet (timed rounds play it when the server answers)
          if (res?.correct) setRight((n) => n + 1)
        })
        advance()
        return
      }
      setBusy(true)
      const res = await sendAnswer(answer, ms)
      setBusy(false)
      if (!res) return
      if (res.correct) setRight((n) => n + 1)
      // sfx: correct or notyet
      setFeedback({ ok: res.correct, ...(res.answer !== undefined ? { answer: res.answer } : {}), ...(res.hint ? { hint: res.hint } : {}) })
      if (res.correct) {
        await sleep(reduced ? 500 : NEXT_DELAY_MS)
        advance()
      }
    },
    [advance, busy, feedback, index, over, prompt, reduced, sendAnswer, timeUp, timed],
  )

  const check = () => {
    if (!prompt) return
    if (prompt.kind === 'bead-set') void submit(digitsToNumber(beads))
    else if (value !== '') void submit(Number(value))
  }

  const askHint = async () => {
    if (hintBusy || hint || !data.hints) return
    setHintBusy(true)
    try {
      const res = await actions.hint({ roundId: data.id, index })
      if (res.ok) setHint(res.data)
    } finally {
      setHintBusy(false)
    }
  }

  const answered = Math.min(index, total)
  const progress = useMemo(() => (timed ? null : `Question ${Math.min(answered + 1, total)} of ${total}`), [answered, timed, total])
  const syncState = !online ? 'offline' : syncFailed ? 'pending' : null

  return (
    <div data-jenjang={data.shell.jenjang} className="flex min-h-svh flex-col bg-bg text-fg">
      <header className="flex h-18 flex-none items-center gap-3 px-4 md:h-22 md:gap-4 md:px-8">
        <ExitControl
          exitHref={data.exitHref}
          title="Leave this round?"
          body={timed ? 'Your answers so far are saved, but this round will not count.' : 'Your answers so far are saved.'}
          stayLabel="Keep going"
          leaveLabel="Leave"
          ariaLabel="Exit round"
          beforeLeave={() => chain.current.catch(() => undefined)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-lg font-bold">{data.mission ? `Daily mission: ${data.mission.title}` : data.title}</span>
          <span className="truncate text-body text-fg-muted">{progress ?? data.subtitle}</span>
        </div>
        {syncState ? (
          <span className="hidden md:inline-flex">
            <OfflineBanner state={syncState} pendingCount={0} />
          </span>
        ) : null}
        {(timed || stopwatch) && !result ? (
          <span className="inline-flex flex-none items-center gap-2 text-body-lg font-bold tabular-nums">
            <UiIcon name="check-circle" size={24} className="text-success" />
            {right} right
          </span>
        ) : null}
        {!result && timed && remaining !== null ? <Timer mode="countdown" seconds={remaining} compact warnAt={10} /> : !result && stopwatch ? <Timer mode="stopwatch" seconds={elapsed} compact /> : null}
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
        ) : prompt ? (
          <section aria-label="Question" className="flex w-full max-w-[980px] flex-col gap-5 rounded-card border border-divider bg-surface p-5 md:p-8">
            {!online ? (
              <p role="alert" className="m-0 flex items-center gap-2 self-center rounded-control border-2 border-warn px-3 py-2 text-body font-bold">
                <UiIcon name="offline" size={20} />
                You are offline. Quick Maths needs the internet.
              </p>
            ) : null}
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-4">
                <Prompt prompt={prompt} shown={stage === 'answer'} flashIndex={flashIndex} flashing={stage === 'showing' && kind === 'flash'} />

                {prompt.kind === 'bead-read' || prompt.kind === 'bead-set' ? (
                  <p className="m-0 max-w-[520px] text-center text-body text-fg-muted">The upper bead is worth 5. Each lower bead is worth 1. Beads that touch the middle bar count.</p>
                ) : null}
                {prompt.kind === 'bead-read' ? <Soroban digits={prompt.digits} labels showValues={prompt.rods === 1} /> : null}
                {prompt.kind === 'bead-set' ? (
                  <div className="flex w-full flex-col items-center gap-3">
                    <p lang="en-GB" className="m-0 text-center font-display text-display font-semibold tabular-nums">
                      Show {prompt.target}
                    </p>
                    <Soroban digits={beads} onChange={setBeads} labels showValues={prompt.rods === 1} disabled={Boolean(feedback) || busy} />
                  </div>
                ) : null}
                {prompt.kind === 'bead-anzan' ? (
                  <div className="flex w-full flex-col items-center gap-3">
                    <Soroban digits={prompt.digits} hidden={stage !== 'showing'} labels={false} />
                    {stage === 'showing' ? <p className="m-0 text-body-lg font-bold">Look carefully, then it hides.</p> : null}
                    {stage === 'answer' ? <p className="m-0 text-h3 font-bold">{prompt.add === null ? 'What number was it?' : `Now add ${prompt.add}. What is the total?`}</p> : null}
                  </div>
                ) : null}

                {stage === 'ready' ? (
                  <Button
                    onClick={() => {
                      setStage('showing')
                      if (kind === 'flash') setFlashIndex(-1)
                    }}
                  >
                    {kind === 'flash' ? 'Start' : 'Show me'}
                  </Button>
                ) : null}

                {hint && !feedback ? (
                  <div role="note" className="w-full max-w-[560px] rounded-control border-2 border-mental bg-mental-50 p-4 text-left">
                    <p className="m-0 text-body font-bold text-mental">Hint: {hint.title}</p>
                    {hint.steps.map((st) => (
                      <p key={st} className="m-0 text-body-lg">
                        {st}
                      </p>
                    ))}
                  </div>
                ) : null}

                {feedback ? (
                  <div role="status" className="flex w-full max-w-[560px] flex-col items-center gap-3 text-center">
                    <span className={cx('inline-flex h-8 items-center gap-1 rounded-pill px-3 text-body font-bold text-white', feedback.ok ? 'bg-success' : 'bg-warn')}>
                      <UiIcon name={feedback.ok ? 'check' : 'not-yet'} size={16} />
                      {feedback.ok ? 'Correct' : 'Not yet'}
                    </span>
                    {!feedback.ok && feedback.answer !== undefined ? <p className="m-0 text-h2 font-bold tabular-nums">The answer is {feedback.answer}</p> : null}
                    {!feedback.ok && feedback.hint ? (
                      <div className="w-full rounded-control border-2 border-mental bg-mental-50 p-4 text-left">
                        <p className="m-0 text-body font-bold text-mental">{feedback.hint.title}</p>
                        {feedback.hint.steps.map((st) => (
                          <p key={st} className="m-0 text-body-lg">
                            {st}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className={cx('min-w-0 flex-1 flex-col items-center gap-4', needsStart && stage !== 'answer' ? 'hidden' : 'flex')}>
                {stage === 'answer' && prompt.kind !== 'bead-set' ? (
                  <ArenaKeypad value={value} onChange={setValue} onSubmit={check} disabled={Boolean(feedback) || busy} feedback={feedback ? (feedback.ok ? 'correct' : 'not-yet') : null} />
                ) : null}

                {feedback && !feedback.ok ? (
                  <Button iconAfter="arrow-right" onClick={advance} data-autofocus className="w-full max-w-[360px]">
                    Next
                  </Button>
                ) : !feedback && stage === 'answer' ? (
                  <div className="flex w-full max-w-[360px] flex-col gap-2.5">
                    <Button onClick={check} loading={busy} disabled={(prompt.kind !== 'bead-set' && value === '') || !online} className="w-full">
                      Check
                    </Button>
                    {data.hints && prompt.kind === 'arith' ? (
                      <Button variant="secondary" icon="hint" onClick={() => void askHint()} loading={hintBusy} disabled={Boolean(hint)} className="w-full">
                        Show a hint
                      </Button>
                    ) : null}
                    {timed ? (
                      <Button variant="quiet" onClick={() => void submit(null)} className="w-full">
                        Skip
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            {error ? <ActionError message={error.message} reference={error.reference} /> : null}
          </section>
        ) : null}
      </main>
    </div>
  )
}
