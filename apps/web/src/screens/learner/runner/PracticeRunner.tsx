'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { checkAnswer } from '@kira/content/check'
import { TTS_EXAMINER_INTRO } from '@kira/core/tts'
import { answerXp } from '@kira/core'
import type { SolutionStep } from '@kira/content/schema'
import type { RemedialLessonDTO, RunnerActions, RunnerDTO, RunnerItem, SegmentState } from '@/lib/dto'
import { Button, ButtonLink } from '@/components/ui/Button'
import type { FigureSpec } from '@kira/figures'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { FeedbackSheet } from '@/components/learner/FeedbackSheet'
import { BossBar } from '@/components/learner/world/BossBar'
import { HintButton, HintList } from '@/components/learner/HintStack'
import { useDeviceWord, useMediaQuery, useOnline } from '@/components/learner/hooks'
import { OfflineBanner } from '@/components/learner/OfflineBanner'
import { ProgressSegments } from '@/components/learner/ProgressSegments'
import { ReadAloudButton } from '@/components/learner/ReadAloudButton'
import { comboLevel } from '@/components/learner/ComboStars'
import { RunnerCorner } from '@/components/learner/RunnerCorner'
import { playSfx, primeSfx } from '@/components/learner/sfx'
import { stopSpeech, useSpeech } from '@/components/learner/speech'
import { SubjectChip } from '@/components/learner/SubjectChip'
import { XpPill } from '@/components/learner/XpPill'
import { isAnswerComplete, isManualType } from '@/components/widgets/answers'
import { QuestionView } from '@/components/widgets/QuestionView'
import { usePreloadNextClips } from '@/components/widgets/usePreloadNextClips'
import { speakableClipParts, speakableStyle } from '@/components/widgets/speakable-parts'
import { Widget } from '@/components/widgets/Widget'
import { useT } from '@/lib/i18n/client'
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

type Rem = { watched: boolean; lessonDone: boolean; lesson: RemedialLessonDTO | null | undefined; loading: boolean; failed: boolean }
const NO_REM: Rem = { watched: false, lessonDone: false, lesson: undefined, loading: false, failed: false }

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
  const t = useT()
  const tp = t.runner.practice
  const [items, setItems] = useState<RunnerItem[]>(() => sortedItems(data))
  const [states, setStates] = useState<QState[]>(() => initState(data, sortedItems(data)))
  // Putaran perbaikan (hanya Latihan): per nomor soal yang salah.
  const [rem, setRem] = useState<Record<number, Rem>>({})
  // Pembahasan bergerak dimuat malas per soal.
  const [walk, setWalk] = useState<Record<number, SolutionStep[] | 'loading' | null>>({})
  const [index, setIndex] = useState(() => {
    const st = initState(data, sortedItems(data))
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
  const combo = useRef(0)
  const [streak, setStreak] = useState(0)
  useEffect(() => primeSfx(), [])

  const item = items[index]
  usePreloadNextClips(items[index + 1])
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

  const walkAsked = useRef(new Set<number>())
  const loadWalk = useCallback(
    async (position: number) => {
      if (!actions.walkthrough || walkAsked.current.has(position)) return
      walkAsked.current.add(position)
      setWalk((w) => ({ ...w, [position]: 'loading' }))
      await queue.flush(3000)
      try {
        const res = await actions.walkthrough({ attemptId: data.attemptId, position })
        setWalk((w) => ({ ...w, [position]: res.ok ? res.data.steps : null }))
        if (!res.ok) walkAsked.current.delete(position)
      } catch {
        setWalk((w) => ({ ...w, [position]: null }))
        walkAsked.current.delete(position)
      }
    },
    [actions, data.attemptId, queue],
  )
  const revealedItemPos = item && st?.phase === 'revealed' && item.reveal?.hasSolution ? item.position : null
  useEffect(() => {
    if (revealedItemPos !== null) void loadWalk(revealedItemPos)
  }, [revealedItemPos, loadWalk])

  const remedialOn = Boolean(actions.remedialLesson && actions.addRemedialItem) && data.allowRetry && data.kind !== 'lesson-check'
  const patchRem = useCallback((position: number, p: Partial<Rem>) => {
    setRem((m) => ({ ...m, [position]: { ...(m[position] ?? NO_REM), ...p } }))
  }, [])

  // Putaran perbaikan: begitu soal terbuka kuncinya karena salah, jawaban disimpan dulu lalu pelajaran dimuat.
  const revealedPos = remedialOn && item && st?.phase === 'revealed' && item.remedialOf === undefined && !isManualType(item.type) ? item.position : null
  useEffect(() => {
    if (revealedPos === null || !actions.remedialLesson) return
    let alive = true
    patchRem(revealedPos, { loading: true })
    void (async () => {
      await queue.flush(3000)
      try {
        const res = await actions.remedialLesson!({ attemptId: data.attemptId, position: revealedPos })
        if (alive) patchRem(revealedPos, { loading: false, lesson: res.ok ? res.data.lesson : null, failed: !res.ok })
      } catch {
        if (alive) patchRem(revealedPos, { loading: false, lesson: null, failed: true })
      }
    })()
    return () => {
      alive = false
    }
  }, [revealedPos])

  const tryOneLikeIt = useCallback(async () => {
    if (!actions.addRemedialItem || !item) return
    const pos = item.position
    patchRem(pos, { loading: true })
    try {
      await queue.flush(3000)
      const res = await actions.addRemedialItem({ attemptId: data.attemptId, position: pos })
      patchRem(pos, { loading: false })
      if (!res.ok || !res.data.item) {
        patchRem(pos, { failed: true })
        return
      }
      const sib = res.data.item
      playSfx('tap')
      if (items.some((x) => x.position === sib.position)) {
        setIndex(items.findIndex((x) => x.position === sib.position))
        return
      }
      setItems((list) => [...list.slice(0, index + 1), sib, ...list.slice(index + 1)])
      setStates((list) => [...list.slice(0, index + 1), { value: null, attemptNo: 1, hintsUsed: 0, phase: 'answer', first: null, xp: 0, startedAt: Date.now() }, ...list.slice(index + 1)])
      setIndex(index + 1)
    } catch {
      patchRem(pos, { loading: false, failed: true })
    }
  }, [actions, data.attemptId, index, item, items, patchRem, queue])

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
    // Bacaan soal berhenti sebelum bunyi benar atau salah, supaya tidak bertumpuk.
    stopSpeech()
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
      // Kombo: tiga benar beruntun di percobaan pertama.
      combo.current = st.attemptNo === 1 ? combo.current + 1 : 0
      setStreak(combo.current)
      const level = comboLevel(combo.current)
      if (level === 0) playSfx('correct')
      else playSfx('combo', { level })
      patch(index, { phase: 'correct', xp, first: st.first ?? 'correct' })
    } else {
      combo.current = 0
      setStreak(0)
      playSfx('notyet')
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
        // replace: tombol kembali tidak membuka lagi runner yang sudah dikumpulkan.
        router.replace(res.data.redirectTo || data.doneHref)
        return
      }
      setSubmit({ state: 'error', message: res.message, reference: res.reference })
    } catch {
      setSubmit({ state: 'error', message: tp.submitFailed, reference: 'KRA-RUN-NET' })
    }
  }, [actions, data.attemptId, data.doneHref, queue, router, tp])

  // Semua soal sudah terjawab saat halaman dibuka (muat ulang sebelum menekan Selesai): kumpulkan sekarang.
  // Tanpa ini anak tertahan di layar selesai tanpa tombol dan hadiahnya tidak masuk. Kumpul ganda aman di server.
  const resumedAllDone = useRef(finished)
  useEffect(() => {
    if (!resumedAllDone.current) return
    resumedAllDone.current = false
    void finish()
  }, [finish])

  const next = useCallback(() => {
    playSfx('tap')
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
  const savedLine = !online ? tp.savedOffline(device) : null

  const header = (
    <header className="flex h-18 flex-none items-center gap-2.5 px-4 md:h-22 md:gap-4 md:px-8">
      <ExitControl exitHref={data.exitHref} beforeLeave={() => queue.flush(1500)} />
      <span className="hidden lg:inline-flex"><SubjectChip subject={subject} size="M" /></span>
      <ProgressSegments
        segments={segments}
        subject={subject}
        size={phone ? 'S' : 'L'}
        label={tp.progress(index + 1, items.length)}
      />
      <span className="flex-none text-body font-bold tabular-nums md:text-body-lg">
        {finished ? t.common.done : (
          <>
            <span className="hidden md:inline">{t.runner.questionOf(index + 1, items.length)}</span>
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
      {item && !finished ? <ReportControl itemRef={item.ref} reportProblem={actions.reportProblem} screen="practice" /> : null}
    </header>
  )

  if (!item || !st || finished) {
    return (
      <div data-jenjang={data.shell.jenjang} className="flex min-h-svh flex-col bg-bg text-fg">
        {header}
        <main className="flex flex-1 items-center justify-center px-4 pb-8 md:px-8">
          <section aria-label={tp.questDone} className="flex max-w-[560px] flex-col items-center gap-4 rounded-card bg-surface shadow-soft px-8 py-10 text-center">
            <span className={cx('flex h-28 w-28 items-center justify-center rounded-card border-2 border-fg text-fg', subject === 'math' ? 'bg-math' : subject === 'english' ? 'bg-english' : 'bg-science')}>
              <UiIcon name="check" size={60} />
            </span>
            <h1 className="m-0 font-display text-display font-semibold">{tp.questDone}</h1>
            <p className="m-0 text-body-lg">{tp.summary(answered, firstTry)}</p>
            {totalXp > 0 ? <XpPill xp={totalXp} size="L" /> : null}
            {submit.state === 'busy' ? (
              <p role="status" className="m-0 inline-flex items-center gap-2 text-body-lg font-semibold">
                <UiIcon name="spinner" size={22} />
                {tp.saving}
              </p>
            ) : null}
            {submit.state === 'error' ? (
              <div role="alert" className="flex flex-col items-center gap-3">
                <p className="m-0 text-body-lg">
                  {submit.message} {!online ? tp.safeOn(device) : t.runner.tryInAMoment}
                </p>
                <p className="m-0 text-body text-fg-muted tabular-nums">{t.runner.reference(submit.reference ?? '')}</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button variant="secondary" onClick={() => void finish()}>
                    {t.common.tryAgain}
                  </Button>
                  <ButtonLink href={data.exitHref} iconAfter="arrow-right">
                    {tp.backToToday}
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
  const nextLabel = isLast ? tp.finish : t.common.next

  const openHint = () => {
    if (st.hintsUsed < hints.length) {
      playSfx('tap')
      patch(index, { hintsUsed: st.hintsUsed + 1 })
    }
  }

  const upload = onUpload ? (blob: Blob, kind: 'audio' | 'drawing' | 'image') => onUpload(blob, kind, { attemptId: data.attemptId, position: item.position }) : undefined
  const skip = manual
    ? () => {
        patch(index, { phase: 'skipped' })
        next()
      }
    : undefined

  return (
    <div data-jenjang={data.shell.jenjang} className="flex min-h-svh flex-col bg-bg text-fg lg:h-svh lg:overflow-hidden">
      {header}
      {data.boss ? (
        <BossBar
          bossId={data.boss}
          right={states.filter((s, k) => s.phase === 'correct' && items[k]?.remedialOf === undefined).length}
          wrong={states.filter((s, k) => s.first === 'not-yet' && items[k]?.remedialOf === undefined).length}
          total={items.filter((i) => i.remedialOf === undefined).length}
        />
      ) : null}
      {syncState ? <OfflineBanner state={syncState} pendingCount={queue.pending} variant="banner" className="mx-4 mb-2.5 md:hidden" /> : null}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-6 gap-y-3.5 px-4 max-lg:grid-rows-[auto_1fr_auto] md:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto]">
        <section aria-label={t.runner.question} className="min-h-0 overflow-y-auto rounded-card bg-surface shadow-soft p-4 md:p-8 lg:col-start-1 lg:row-start-1">
          <QuestionView
            key={item.ref}
            item={item}
            number={item.position}
            subject={subject}
            hideTools
            tapWords
            listen={englishArea === 'listening'}
            answer={{ value: st.value, onChange: (v) => answering && patch(index, { value: v }), disabled: !answering, feedback }}
          >
            {answering && st.hintsUsed > 0 ? <HintList hints={hints} opened={st.hintsUsed} contentLang={item.lang} /> : null}
          </QuestionView>
        </section>
        <section aria-label={tp.yourAnswer} tabIndex={0} className="relative flex min-h-0 flex-col overflow-x-hidden overflow-y-auto py-1 focus-visible:outline-3 focus-visible:outline-fg lg:col-start-2 lg:row-start-1">
          <RunnerCorner shell={data.shell} phase={st.phase} streak={streak} xp={st.xp} nonce={`${item.ref}-${st.attemptNo}`} />
          <div className={cx('m-auto flex w-full flex-col items-center gap-3.5 max-md:[&>*>*>p:first-child]:pr-12', feedback === 'not-yet' && item.type !== 'mcq' && item.type !== 'multi' && 'kira-nudge', feedback === 'correct' && item.type !== 'mcq' && item.type !== 'multi' && 'kira-pulse')}>
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
        <footer className="sticky bottom-0 z-10 -mx-4 flex h-[calc(84px+var(--safe-bottom))] items-center gap-3 bg-bg px-4 pb-(--safe-bottom) md:-mx-8 md:h-24 md:px-8 lg:static lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:mx-0 lg:px-0">
          {hints.length > 0 ? <HintButton total={hints.length} opened={st.hintsUsed} onOpen={openHint} disabled={!answering} compact={narrow} /> : null}
          {englishArea === 'listening' ? null : (
            <ReadAloudButton key={item.ref} text={speakableClipParts(item)} style={speakableStyle(item)} lang={item.lang} subject={subject} showNote={false} compact={narrow} />
          )}
          {selfSend ? null : (
            <Button
              onClick={() => void check()}
              disabled={!canCheck}
              loading={st.phase === 'checking'}
              className="ml-auto min-w-0 flex-1 max-sm:px-3 sm:min-w-35 sm:flex-none md:min-w-50"
              icon={manual ? 'send' : undefined}
            >
              {manual ? tp.sendToTutor : t.common.check}
            </Button>
          )}
        </footer>
        {sheetOpen ? (
          // Lembar yang lebih tinggi dari layar digulir di dalam dirinya: judul dan kunci tidak terpotong di HP.
          <div className="fixed inset-x-0 bottom-0 z-30 max-h-svh overflow-y-auto overscroll-contain lg:relative lg:inset-auto lg:z-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-h-full lg:self-end lg:pb-6">
            <FeedbackSheet
              key={`${item.ref}-${st.phase}`}
              kind={st.phase === 'correct' ? 'correct' : st.phase === 'not-yet' ? 'not-yet' : st.phase === 'revealed' ? 'revealed' : st.phase === 'answered' ? 'saved' : 'sent'}
              subject={subject}
              contentLang={item.lang}
              xp={st.xp}
              hintsUsed={st.hintsUsed}
              secondTry={st.attemptNo > 1}
              explanation={item.reveal?.explanation}
              answerText={item.reveal?.answerText}
              solution={item.reveal?.solution ?? (Array.isArray(walk[item.position]) ? (walk[item.position] as SolutionStep[]) : null)}
              hasSolution={Boolean(item.reveal?.hasSolution)}
              onLoadSolution={() => void loadWalk(item.position)}
              hint={st.phase === 'not-yet' && st.hintsUsed > 0 && hints[st.hintsUsed - 1] ? { label: t.runner.hints.of(st.hintsUsed, hints.length), text: hints[st.hintsUsed - 1] ?? '' } : null}
              onShowHint={st.phase === 'not-yet' && st.hintsUsed === 0 && hints.length > 0 ? openHint : undefined}
              showHintLabel={t.runner.hints.show(st.hintsUsed + 1)}
              savedLine={savedLine}
              className="max-lg:rounded-b-none max-lg:border-x-0 max-lg:border-b-0"
              prompt={item.prompt}
              figure={item.figure as FigureSpec | undefined}
              fixItNote={st.phase === 'revealed' && item.remedialOf !== undefined}
              remedial={
                revealedPos !== null
                  ? {
                      watched: rem[item.position]?.watched ?? false,
                      lessonDone: rem[item.position]?.lessonDone ?? false,
                      lesson: rem[item.position]?.lesson,
                      loading: rem[item.position]?.loading ?? false,
                      canTry: !(rem[item.position]?.failed ?? false),
                      onWatched: () => patchRem(item.position, { watched: true }),
                      onLessonOpen: () => undefined,
                      onLessonDone: () => patchRem(item.position, { lessonDone: true }),
                      onTry: () => void tryOneLikeIt(),
                    }
                  : undefined
              }
              primary={
                st.phase === 'not-yet'
                  ? {
                      label: t.common.tryAgain,
                      onClick: () => {
                        playSfx('tap')
                        patch(index, { phase: 'answer', attemptNo: 2, value: null, startedAt: Date.now() })
                      },
                    }
                  : { label: nextLabel, onClick: next, icon: 'arrow-right' }
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
