'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { checkAnswer } from '@kira/content/check'
import { answerXp } from '@kira/core'
import type { RunnerActions, RunnerDTO } from '@/lib/dto'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { useOnline, useTicker } from '@/components/learner/hooks'
import { OfflineBanner } from '@/components/learner/OfflineBanner'
import { SubjectChip } from '@/components/learner/SubjectChip'
import { Timer } from '@/components/learner/Timer'
import { XpPill } from '@/components/learner/XpPill'
import { isAnswerComplete } from '@/components/widgets/answers'
import { QuestionView } from '@/components/widgets/QuestionView'
import { Widget } from '@/components/widgets/Widget'
import { ExitControl } from './parts'
import { savedByPosition, sortedItems } from './shared'
import { newClientId, useAnswerQueue } from './useAnswerQueue'

/**
 * Runner kilat: 60 detik, soal angka, maju otomatis setelah setiap jawaban,
 * menghitung jawaban benar. Tanpa hint dan tanpa coba lagi.
 */

const FLASH_MS = 700

export function SprintRunner({ data, actions }: { data: RunnerDTO; actions: RunnerActions }): ReactElement {
  const router = useRouter()
  const items = useMemo(() => sortedItems(data), [data])
  const saved = useMemo(() => savedByPosition(data.saved), [data.saved])
  const [index, setIndex] = useState(() => {
    const first = items.findIndex((it) => !saved.has(it.position))
    return first >= 0 ? first : items.length
  })
  const [value, setValue] = useState<unknown | null>(null)
  const [flash, setFlash] = useState<'correct' | 'not-yet' | null>(null)
  const [right, setRight] = useState(() => data.saved.filter((s) => s.status === 'correct').length)
  const [xp, setXp] = useState(0)
  const [submit, setSubmit] = useState<{ state: 'idle' | 'busy' | 'done' | 'error'; redirectTo?: string; message?: string; reference?: string }>({ state: 'idle' })
  const queue = useAnswerQueue(actions.saveAnswer)
  const online = useOnline()
  const loadedAt = useRef(Date.now())
  const startedAt = useRef(Date.now())
  const submitClientId = useRef(newClientId())
  const limit = data.timeLimitSec ?? 60
  const over = index >= items.length
  const now = useTicker(!over && submit.state === 'idle', 250)
  const elapsed = data.elapsedSec + Math.floor((now - loadedAt.current) / 1000)
  const remaining = Math.max(0, limit - elapsed)
  const finished = over || remaining === 0
  const item = items[index]

  const finish = useCallback(async () => {
    setSubmit({ state: 'busy' })
    await queue.flush(4000)
    try {
      const res = await actions.submitAttempt(data.attemptId, submitClientId.current)
      if (res.ok) setSubmit({ state: 'done', redirectTo: res.data.redirectTo || data.doneHref })
      else setSubmit({ state: 'error', message: res.message, reference: res.reference })
    } catch {
      setSubmit({ state: 'error', message: 'Your sprint could not be handed in yet.', reference: 'KRA-RUN-NET' })
    }
  }, [actions, data.attemptId, data.doneHref, queue])

  const done = useRef(false)
  useEffect(() => {
    if (finished && !done.current) {
      done.current = true
      void finish()
    }
  }, [finished, finish])

  const check = useCallback(() => {
    if (!item || flash || finished || !isAnswerComplete(item, value)) return
    const ok = item.key ? checkAnswer(item.key, value).status === 'correct' : null
    void queue.enqueue({
      attemptId: data.attemptId,
      position: item.position,
      answer: value,
      hintsUsed: 0,
      attemptNo: 1,
      timeMs: Date.now() - startedAt.current,
      flagged: false,
      clientId: newClientId(),
      answeredAt: new Date().toISOString(),
    })
    if (ok) {
      setRight((n) => n + 1)
      setXp((n) => n + answerXp({ difficulty: item.difficulty, correct: true, hintsUsed: 0 }))
    }
    setFlash(ok === null ? null : ok ? 'correct' : 'not-yet')
    window.setTimeout(
      () => {
        setFlash(null)
        setValue(null)
        startedAt.current = Date.now()
        setIndex((i) => i + 1)
      },
      ok === null ? 0 : FLASH_MS,
    )
  }, [data.attemptId, finished, flash, item, queue, value])

  // Enter untuk memeriksa (keypad juga menerima keyboard fisik).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        check()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [check])

  const syncState = !online ? 'offline' : queue.stuck && queue.pending > 0 ? 'pending' : null

  return (
    <div data-jenjang={data.shell.jenjang} className="flex min-h-svh flex-col bg-bg text-fg">
      <header className="flex h-18 flex-none items-center gap-3 px-4 md:h-22 md:gap-4 md:px-8">
        <ExitControl exitHref={data.exitHref} title="Stop the sprint?" body="Your answers so far are saved." stayLabel="Keep going" leaveLabel="Stop" beforeLeave={() => queue.flush(1500)} />
        <span className="hidden md:inline-flex"><SubjectChip subject={data.subject} size="M" /></span>
        <div className="hidden min-w-0 flex-1 flex-col sm:flex">
          <span className="truncate text-body-lg font-bold">{data.title}</span>
          <span className="truncate text-body text-fg-muted">Answer as many as you can</span>
        </div>
        {syncState ? (
          <span className="hidden md:inline-flex">
            <OfflineBanner state={syncState} pendingCount={queue.pending} />
          </span>
        ) : null}
        <span className="ml-auto inline-flex flex-none items-center gap-2 text-body-lg font-bold tabular-nums sm:ml-0">
          <UiIcon name="check-circle" size={24} className="text-success" />
          {right} right
        </span>
        <Timer mode="countdown" seconds={remaining} compact warnAt={10} />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-8 md:items-center md:px-8">
        {finished ? (
          <section aria-label="Sprint done" className="flex w-full max-w-[560px] flex-col items-center gap-4 rounded-card border border-divider bg-surface px-8 py-10 text-center">
            <h1 className="m-0 font-display text-display font-semibold">{remaining === 0 ? "Time's up" : 'All done'}</h1>
            <p className="m-0 text-body-lg">
              You got {right} right in {limit} seconds.
            </p>
            {xp > 0 ? <XpPill xp={xp} size="L" /> : null}
            {submit.state === 'error' ? (
              <div role="alert" className="flex flex-col items-center gap-2">
                <p className="m-0 text-body-lg">{submit.message}</p>
                <p className="m-0 text-body text-fg-muted tabular-nums">Reference {submit.reference}</p>
                <Button variant="secondary" onClick={() => void finish()}>
                  Try again
                </Button>
              </div>
            ) : (
              <Button iconAfter="arrow-right" loading={submit.state === 'busy'} onClick={() => submit.redirectTo && router.push(submit.redirectTo)}>
                See my results
              </Button>
            )}
          </section>
        ) : item ? (
          <section aria-label="Question" className="relative flex w-full max-w-[760px] flex-col gap-6 rounded-card border border-divider bg-surface p-5 md:flex-row md:items-center md:p-8">
            <div className="flex-1">
              {item.type === 'numeric' && !item.figure ? (
                <p lang={item.lang} aria-live="polite" className="m-0 text-center font-display text-display font-semibold tabular-nums">
                  {item.prompt}
                </p>
              ) : (
                <QuestionView key={item.ref} item={item} number={item.position} subject={data.subject} hideTools answer={{ value, onChange: setValue, disabled: !!flash }} />
              )}
            </div>
            <div className="relative flex flex-1 flex-col items-center gap-4">
              <Widget item={item} value={value} onChange={(v) => !flash && setValue(v)} disabled={!!flash} feedback={flash} subject={data.subject} />
              <Button onClick={check} disabled={!isAnswerComplete(item, value) || !!flash} className="w-full max-w-[360px]">
                Check
              </Button>
              <span role="status" className="flex h-7 items-center">
                {flash ? (
                  <span className={cx('inline-flex h-7 items-center gap-1 rounded-pill px-2.5 text-body font-bold text-white', flash === 'correct' ? 'bg-success' : 'bg-warn')}>
                    <UiIcon name={flash === 'correct' ? 'check' : 'not-yet'} size={16} />
                    {flash === 'correct' ? 'Correct' : 'Not yet'}
                  </span>
                ) : null}
              </span>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}
