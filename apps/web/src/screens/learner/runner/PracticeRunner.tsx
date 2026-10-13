'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { checkAnswer } from '@kira/content/check'
import { TTS_EXAMINER_INTRO } from '@kira/core/tts'
import { answerXp } from '@kira/core'
import type { RunnerActions, RunnerDTO, RunnerItem, SegmentState } from '@/lib/dto'
import { Button, ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { FeedbackSheet } from '@/components/learner/FeedbackSheet'
import { HintButton, HintList } from '@/components/learner/HintStack'
import { useDeviceWord, useMediaQuery, useOnline } from '@/components/learner/hooks'
import { OfflineBanner } from '@/components/learner/OfflineBanner'
import { ProgressSegments } from '@/components/learner/ProgressSegments'
import { ReadAloudButton } from '@/components/learner/ReadAloudButton'
import { useSpeech } from '@/components/learner/speech'
import { SubjectChip } from '@/components/learner/SubjectChip'
import { XpPill } from '@/components/learner/XpPill'
import { isAnswerComplete, isManualType } from '@/components/widgets/answers'
import { QuestionView } from '@/components/widgets/QuestionView'
import { speakableClipParts, speakableStyle } from '@/components/widgets/speakable-parts'
import { Widget } from '@/components/widgets/Widget'
import { ExitControl, ReportControl } from './parts'
import { hintsOf, savedByPosition, sortedItems, type RunnerUpload } from './shared'
import { newClientId, useAnswerQueue } from './useAnswerQueue'

/**
 * Runner mode latihan (belajar, latihan, review): satu soal per layar, Check, lalu
 * lembar umpan balik. Pemeriksaan lokal dengan item.key untuk umpan balik instan;
 * jawaban dikirim lewat antrean tanpa membuat anak menunggu.
 */

type Phase = 'answer' | 'checking' | 'correct' | 'not-yet' | 'revealed' | 'sent' | 'skipped' | 'answered'

type QState = {
  value: unknown | null
  attemptNo: number
  hintsUsed: number
  phase: Phase
  /** Hasil jawaban pertama untuk segmen progres. */
  first: 'correct' | 'not-yet' | 'answered' | null
  xp: number
  startedAt: number
}

const DONE: Phase[] = ['correct', 'revealed', 'sent', 'skipped', 'answered']

function initState(data: RunnerDTO, items: RunnerItem[]): QState[] {
  const saved = savedByPosition(data.saved)
  const now = Date.now()
  return items.map((it) => {
    const s = saved.get(it.position)
    const base: QState = { value: null, attemptNo: 1, hintsUsed: 0, phase: 'answer', first: null, xp: 0, startedAt: now }
    if (!s || s.status === 'blank') return base
    const value = s.answer ?? null
    if (s.status === 'correct') {
      const xp = answerXp({ difficulty: it.difficulty, correct: true, hintsUsed: s.hintsUsed, attemptNo: s.attemptNo })
      return { ...base, value, attemptNo: s.attemptNo, hintsUsed: s.hintsUsed, phase: 'correct', first: s.attemptNo > 1 ? 'not-yet' : 'correct', xp }
    }
    if (s.status === 'wrong') {
      const retry = data.allowRetry && s.attemptNo === 1
      return { ...base, value, attemptNo: s.attemptNo, hintsUsed: s.hintsUsed, phase: retry ? 'not-yet' : 'revealed', first: 'not-yet' }
    }
    if (s.status === 'pending') return { ...base, value, phase: 'sent', first: 'answered' }
    return { ...base, value, phase: 'answered', first: 'answered' }
  })
}

export function PracticeRunner({ data, actions, onUpload }: { data: RunnerDTO; actions: RunnerActions; onUpload?: RunnerUpload }): ReactElement {
  const router = useRouter()
  const items = useMemo(() => sortedItems(data), [data])
  const [states, setStates] = useState<QState[]>(() => initState(data, items))
  const [index, setIndex] = useState(() => {
    const st = initState(data, items)
    const first = st.findIndex((s) => !DONE.includes(s.phase))
    return first >= 0 ? first : Math.max(0, items.length - 1)
  })
  const [finished, setFinished] = useState(() => items.length > 0 && initState(data, items).every((s) => DONE.includes(s.phase)))
  const [submit, setSubmit] = useState<{ state: 'idle' | 'busy' | 'error'; message?: string; reference?: string }>({ state: 'idle' })
  const queue = useAnswerQueue(actions.saveAnswer)
  const online = useOnline()
  const device = useDeviceWord()
  const phone = useMediaQuery('(max-width: 767px)')
  const narrow = useMediaQuery('(max-width: 639px)')
  const submitClientId = useRef(newClientId())

  const item = items[index]
  const st = states[index]
  const subject = data.subject
  const englishArea = data.englishArea

  // Penguji (speaking): soal dibacakan begitu muncul. Browser boleh memblokir pemutaran otomatis; tombol baca tetap ada.
  const examiner = useSpeech('en-GB')
  const examinerRef = useRef(examiner)
  useEffect(() => {
    examinerRef.current = examiner
  })
  const itemRef = item?.ref
  useEffect(() => {
    if (englishArea !== 'speaking' || !item || item.lang !== 'en-GB') return
    // Soal pertama diawali perkenalan penguji.
    const ask = speakableClipParts(item).slice(0, 1)
    examinerRef.current.speak(index === 0 ? [TTS_EXAMINER_INTRO, ...ask] : ask, undefined, { style: speakableStyle(item) })
  }, [englishArea, itemRef])

  const patch = useCallback((i: number, p: Partial<QState>) => {
    setStates((list) => list.map((s, k) => (k === i ? { ...s, ...p } : s)))
  }, [])

  // Waktu mulai soal di-reset saat soal tampil.
  useEffect(() => {
    patch(index, { startedAt: Date.now() })
  }, [index, patch])

  const send = useCallback(
    (i: number, s: QState) => {
      const it = items[i]
      if (!it) return Promise.resolve(null)
      return queue.enqueue({
        attemptId: data.attemptId,
        position: it.position,
        answer: s.value,
        hintsUsed: s.hintsUsed,
        attemptNo: s.attemptNo,
        timeMs: Math.max(0, Date.now() - s.startedAt),
        flagged: false,
        clientId: newClientId(),
        answeredAt: new Date().toISOString(),
      })
    },
    [data.attemptId, items, queue],
  )

  const check = useCallback(async () => {
    if (!item || !st || st.phase !== 'answer' || !isAnswerComplete(item, st.value)) return
    if (isManualType(item.type)) {
      void send(index, st)
      patch(index, { phase: 'sent', first: st.first ?? 'answered' })
      return
    }
    let correct: boolean | null = null
    if (item.key) {
      correct = checkAnswer(item.key, st.value).status === 'correct'
      void send(index, st)
    } else {
      // Tanpa kunci di perangkat: tunggu server sebentar.
      patch(index, { phase: 'checking' })
      const res = await send(index, st)
      if (res && res.ok && (res.data.status === 'correct' || res.data.status === 'wrong')) correct = res.data.status === 'correct'
    }
    if (correct === null) {
      patch(index, { phase: 'answered', first: st.first ?? 'answered' })
      return
    }
    if (correct) {
      const xp = answerXp({ difficulty: item.difficulty, correct: true, hintsUsed: st.hintsUsed, attemptNo: st.attemptNo })
      patch(index, { phase: 'correct', xp, first: st.first ?? 'correct' })
    } else {
      const retry = data.allowRetry && st.attemptNo === 1
      patch(index, { phase: retry ? 'not-yet' : 'revealed', first: st.first ?? 'not-yet' })
    }
  }, [data.allowRetry, index, item, patch, send, st])

  // Soal bicara dan gambar terkirim dari widgetnya sendiri: begitu ada mediaId, simpan.
  useEffect(() => {
    if (!item || !st) return
    if ((item.type === 'speak' || item.type === 'draw') && st.phase === 'answer' && isAnswerComplete(item, st.value)) void check()
  }, [item, st, check])

  const finish = useCallback(async () => {
    setFinished(true)
    setSubmit({ state: 'busy' })
    await queue.flush(4000)
    try {
      const res = await actions.submitAttempt(data.attemptId, submitClientId.current)
      if (res.ok) {
        router.push(res.data.redirectTo || data.doneHref)
        return
      }
      setSubmit({ state: 'error', message: res.message, reference: res.reference })
    } catch {
      setSubmit({ state: 'error', message: 'Your quest could not be handed in yet.', reference: 'KRA-RUN-NET' })
    }
  }, [actions, data.attemptId, data.doneHref, queue, router])

  const next = useCallback(() => {
    const after = states.findIndex((s, k) => k > index && !DONE.includes(s.phase))
    const before = states.findIndex((s, k) => k < index && !DONE.includes(s.phase))
    const target = after >= 0 ? after : before
    if (target >= 0) setIndex(target)
    else void finish()
  }, [finish, index, states])

  const segments: SegmentState[] = states.map((s, k) => {
    if (k === index && !finished && !DONE.includes(s.phase) && s.first === null) return 'current'
    if (s.first === 'correct') return 'correct'
    if (s.first === 'not-yet') return 'not-yet'
    if (s.first === 'answered') return 'answered'
    return k === index && !finished ? 'current' : 'todo'
  })

  const totalXp = states.reduce((n, s) => n + s.xp, 0)
  const firstTry = states.filter((s) => s.first === 'correct').length
  const answered = states.filter((s) => DONE.includes(s.phase) && s.phase !== 'skipped').length
  const syncState = !online ? 'offline' : queue.stuck && queue.pending > 0 ? 'pending' : queue.justSynced ? 'synced' : null
  const savedLine = !online ? `Saved on this ${device}. It will sync when you are back online.` : null

  const header = (
    <header className="flex h-18 flex-none items-center gap-2.5 px-4 md:h-22 md:gap-4 md:px-8">
      <ExitControl exitHref={data.exitHref} beforeLeave={() => queue.flush(1500)} />
      <span className="hidden lg:inline-flex"><SubjectChip subject={subject} size="M" /></span>
      <ProgressSegments
        segments={segments}
        subject={subject}
        size={phone ? 'S' : 'L'}
        label={`Quest progress, question ${index + 1} of ${items.length}`}
      />
      <span className="flex-none text-body font-bold tabular-nums md:text-body-lg">
        {finished ? 'Done' : (
          <>
            <span className="hidden md:inline">Question {index + 1} of {items.length}</span>
            <span className="md:hidden">
              {index + 1}/{items.length}
            </span>
          </>
        )}
      </span>
      {syncState ? (
          <span className="hidden md:inline-flex">
            <OfflineBanner state={syncState} pendingCount={queue.pending} />
          </span>
        ) : null}
      {item && !finished ? <ReportControl itemRef={item.ref} reportProblem={actions.reportProblem} className="max-md:hidden" /> : null}
    </header>
  )

  if (!item || !st || finished) {
    return (
      <div data-jenjang={data.shell.jenjang} className="flex min-h-svh flex-col bg-bg text-fg">
        {header}
        <main className="flex flex-1 items-center justify-center px-4 pb-8 md:px-8">
          <section aria-label="Quest done" className="flex max-w-[560px] flex-col items-center gap-4 rounded-card border border-divider bg-surface px-8 py-10 text-center">
            <span className={cx('flex h-28 w-28 items-center justify-center rounded-card border-2 border-fg text-white', subject === 'math' ? 'bg-math' : subject === 'english' ? 'bg-english' : 'bg-science')}>
              <UiIcon name="check" size={60} />
            </span>
            <h1 className="m-0 font-display text-display font-semibold">Quest done</h1>
            <p className="m-0 text-body-lg">
              You answered {answered} {answered === 1 ? 'question' : 'questions'}. {firstTry} {firstTry === 1 ? 'was' : 'were'} right the first time.
            </p>
            {totalXp > 0 ? <XpPill xp={totalXp} size="L" /> : null}
            {submit.state === 'busy' ? (
              <p role="status" className="m-0 inline-flex items-center gap-2 text-body-lg font-semibold">
                <UiIcon name="spinner" size={22} />
                Saving your quest
              </p>
            ) : null}
            {submit.state === 'error' ? (
              <div role="alert" className="flex flex-col items-center gap-3">
                <p className="m-0 text-body-lg">
                  {submit.message} {!online ? `Your answers are safe on this ${device}.` : 'Try again in a moment.'}
                </p>
                <p className="m-0 text-body text-fg-muted tabular-nums">Reference {submit.reference}</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button variant="secondary" onClick={() => void finish()}>
                    Try again
                  </Button>
                  <ButtonLink href={data.exitHref} iconAfter="arrow-right">
                    Back to Today
                  </ButtonLink>
                </div>
              </div>
            ) : null}
          </section>
        </main>
      </div>
    )
  }

  const hints = data.allowHints ? hintsOf(item) : []
  const answering = st.phase === 'answer'
  const feedback = st.phase === 'correct' ? 'correct' : st.phase === 'not-yet' || st.phase === 'revealed' ? 'not-yet' : null
  const manual = isManualType(item.type)
  const selfSend = item.type === 'speak' || item.type === 'draw'
  const canCheck = answering && isAnswerComplete(item, st.value)
  const sheetOpen = st.phase === 'correct' || st.phase === 'not-yet' || st.phase === 'revealed' || st.phase === 'sent' || st.phase === 'answered'
  const isLast = states.every((s, k) => k === index || DONE.includes(s.phase))
  const nextLabel = isLast ? 'Finish' : 'Next'

  const openHint = () => {
    if (st.hintsUsed < hints.length) patch(index, { hintsUsed: st.hintsUsed + 1 })
  }

  const upload = onUpload ? (blob: Blob, kind: 'audio' | 'drawing') => onUpload(blob, kind, { attemptId: data.attemptId, position: item.position }) : undefined
  const skip = manual
    ? () => {
        patch(index, { phase: 'skipped' })
        next()
      }
    : undefined

  return (
    <div data-jenjang={data.shell.jenjang} className="flex min-h-svh flex-col bg-bg text-fg lg:h-svh lg:overflow-hidden">
      {header}
      {syncState ? <OfflineBanner state={syncState} pendingCount={queue.pending} variant="banner" className="mx-4 mb-2.5 md:hidden" /> : null}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-6 gap-y-3.5 px-4 md:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto]">
        <section aria-label="Question" className="min-h-0 overflow-y-auto rounded-card border border-divider bg-surface p-4 md:p-8 lg:col-start-1 lg:row-start-1">
          <QuestionView
            key={item.ref}
            item={item}
            number={item.position}
            subject={subject}
            hideTools
            listen={englishArea === 'listening'}
            answer={{ value: st.value, onChange: (v) => answering && patch(index, { value: v }), disabled: !answering, feedback }}
          >
            {answering && st.hintsUsed > 0 ? <HintList hints={hints} opened={st.hintsUsed} /> : null}
          </QuestionView>
        </section>
        <section aria-label="Your answer" className="flex min-h-0 flex-col overflow-y-auto py-1 lg:col-start-2 lg:row-start-1">
          <div className="m-auto flex w-full flex-col items-center gap-3.5">
            <Widget
              item={item}
              value={st.value}
              onChange={(v) => answering && patch(index, { value: v })}
              disabled={!answering}
              feedback={feedback}
              subject={subject}
              onUpload={upload}
              onSkip={skip}
            />
          </div>
        </section>
        <footer className="sticky bottom-0 z-10 -mx-4 flex h-21 items-center gap-3 bg-bg px-4 md:-mx-8 md:h-24 md:px-8 lg:static lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:mx-0 lg:px-0">
          {hints.length > 0 ? <HintButton total={hints.length} opened={st.hintsUsed} onOpen={openHint} disabled={!answering} compact={narrow} /> : null}
          {englishArea === 'listening' ? null : (
            <ReadAloudButton text={speakableClipParts(item)} style={speakableStyle(item)} lang={item.lang} subject={subject} showNote={false} compact={narrow} />
          )}
          {selfSend ? null : (
            <Button
              onClick={() => void check()}
              disabled={!canCheck}
              loading={st.phase === 'checking'}
              className="ml-auto min-w-0 flex-1 sm:min-w-35 sm:flex-none md:min-w-50"
              icon={manual ? 'send' : undefined}
            >
              {manual ? 'Send to tutor' : 'Check'}
            </Button>
          )}
        </footer>
        {sheetOpen ? (
          <div className="fixed inset-x-0 bottom-0 z-30 lg:relative lg:inset-auto lg:z-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-end lg:pb-6">
            <FeedbackSheet
              key={`${item.ref}-${st.phase}`}
              kind={st.phase === 'correct' ? 'correct' : st.phase === 'not-yet' ? 'not-yet' : st.phase === 'revealed' ? 'revealed' : st.phase === 'answered' ? 'saved' : 'sent'}
              subject={subject}
              xp={st.xp}
              hintsUsed={st.hintsUsed}
              secondTry={st.attemptNo > 1}
              explanation={item.reveal?.explanation}
              answerText={item.reveal?.answerText}
              solution={item.reveal?.solution ?? null}
              hint={st.phase === 'not-yet' && st.hintsUsed > 0 && hints[st.hintsUsed - 1] ? { label: `Hint ${st.hintsUsed} of ${hints.length}`, text: hints[st.hintsUsed - 1] ?? '' } : null}
              onShowHint={st.phase === 'not-yet' && st.hintsUsed === 0 && hints.length > 0 ? openHint : undefined}
              showHintLabel={`Show hint ${st.hintsUsed + 1}`}
              savedLine={savedLine}
              className="max-lg:rounded-b-none max-lg:border-x-0 max-lg:border-b-0"
              primary={
                st.phase === 'not-yet'
                  ? { label: 'Try again', onClick: () => patch(index, { phase: 'answer', attemptNo: 2, value: null, startedAt: Date.now() }) }
                  : { label: nextLabel, onClick: next, icon: 'arrow-right' }
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
