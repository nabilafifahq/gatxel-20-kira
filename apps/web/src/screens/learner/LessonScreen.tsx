'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { checkAnswer } from '@kira/content/check'
import type { ClientItem } from '@kira/content/present'
import type { LessonStep } from '@kira/content/schema'
import { Figure } from '@kira/figures'
import type { LessonActions, LessonDTO } from '@/lib/dto'
import { Button, ButtonLink, IconButton, IconLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { NO_LOOKUP_SKILLS } from '@kira/core/dictionary'
import { useT } from '@/lib/i18n/client'
import { LessonShow } from '@/components/learner/LessonShow'
import { TapWords } from '@/components/learner/TapWords'
import { useReducedMotion } from '@/components/learner/hooks'
import { TranslateToggle, useExplainLang, useIdClipsReady } from '@/components/learner/explain-lang'
import { useSpeech } from '@/components/learner/speech'
import { SubjectChip } from '@/components/learner/SubjectChip'
import { SUBJECT_STYLE } from '@/components/learner/subject'
import { ToolPlay } from '@/components/manipulatives/ToolPlay'
import { TapSound } from '@/components/learner/TapSound'
import { isAnswerComplete } from '@/components/widgets/answers'
import { QuestionView } from '@/components/widgets/QuestionView'
import { Widget } from '@/components/widgets/Widget'
import { ActionError } from './common'

/**
 * L12 Pelajaran (papan Pelajaran, PelajaranCek). Langkah pelajaran diputar satu per satu
 * dengan caption (bisa dimatikan) dan suara (bisa dimatikan). Tidak pernah diputar otomatis.
 * Soal cek muncul setelah langkah terakhir; pelajaran berhenti di setiap cek sampai dijawab.
 * Selesai: completeLesson(skillId, benar, total) dipanggil sekali.
 */

type StepView = LessonStep & { sayId?: string }
type Part = { kind: 'step'; step: StepView; n: number } | { kind: 'check'; item: ClientItem; n: number }
type CheckState = { value: unknown | null; tries: number; status: 'open' | 'correct' | 'revealed'; firstTry: boolean | null }

function firstSentence(text: string): string {
  const m = /^(.+?[.?!])(\s|$)/.exec(text)
  const s = (m?.[1] ?? text).trim()
  return s.length > 48 ? `${s.slice(0, 46).trimEnd()}…` : s
}

/** Bagian `i` boleh dilewati: langkah biasa, atau cek yang sudah dijawab. */
function passableAt(parts: Part[], checks: CheckState[], i: number): boolean {
  const p = parts[i]
  if (!p || p.kind === 'step') return true
  return checks[p.n]?.status !== 'open'
}

function dwellMs(text: string): number {
  return Math.max(3000, text.length * 70)
}

export function LessonScreen({ data, actions }: { data: LessonDTO; actions: LessonActions }): ReactElement {
  const t = useT()
  const copy = t.lessons.lesson
  const parts = useMemo<Part[]>(
    () => [...data.steps.map((step, i): Part => ({ kind: 'step', step, n: i })), ...data.check.map((item, i): Part => ({ kind: 'check', item, n: i }))],
    [data.steps, data.check],
  )
  const [at, setAt] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [captions, setCaptions] = useState(true)
  const [sound, setSound] = useState(true)
  const [checks, setChecks] = useState<CheckState[]>(() => data.check.map(() => ({ value: null, tries: 0, status: 'open', firstTry: null })))
  const [finished, setFinished] = useState(false)
  const [save, setSave] = useState<{ state: 'idle' | 'busy' | 'done' | 'error'; message?: string; reference?: string }>({ state: 'idle' })
  const reduced = useReducedMotion()
  const speech = useSpeech('en-GB')
  const speechRef = useRef(speech)
  const speechId = useSpeech('id')
  const speechIdRef = useRef(speechId)
  useEffect(() => {
    speechRef.current = speech
    speechIdRef.current = speechId
  })
  // Penjelasan dalam bahasa Indonesia hanya mengganti kalimat guru. Soal cek tetap berbahasa Inggris.
  const explain = useExplainLang()
  const translated = useMemo(() => data.steps.flatMap((s) => (s.sayId ? [s.sayId] : [])), [data.steps])
  const showId = explain.on && translated.length > 0
  const style = SUBJECT_STYLE[data.subject]
  const part = parts[at]
  const total = parts.length
  // Suara Indonesia diperiksa per langkah: langkah tanpa klip (misalnya yang memuat kata Inggris) diam, langkah lain tetap bersuara.
  const stepIdText = showId && part?.kind === 'step' ? part.step.sayId : undefined
  const idReady = useIdClipsReady(stepIdText ? [stepIdText] : [])
  const hideSound = Boolean(stepIdText) && !idReady

  // Bagian berikutnya terbuka bila bagian ini langkah biasa atau cek yang sudah selesai.
  const passable = (i: number) => passableAt(parts, checks, i)
  const furthest = (() => {
    let i = 0
    while (i < total - 1 && passable(i)) i++
    return i
  })()

  const correct = checks.filter((c) => c.firstTry === true).length

  const complete = useCallback(async () => {
    setSave({ state: 'busy' })
    try {
      const res = await actions.completeLesson(data.skillId, checks.filter((c) => c.firstTry === true).length, data.check.length)
      if (res.ok) setSave({ state: 'done' })
      else setSave({ state: 'error', message: res.message, reference: res.reference })
    } catch {
      setSave({ state: 'error', message: copy.notSaved, reference: 'KRA-LES-NET' })
    }
  }, [actions, checks, copy.notSaved, data.check.length, data.skillId])

  const goNext = useCallback(() => {
    if (!passableAt(parts, checks, at)) return
    if (at >= total - 1) {
      setPlaying(false)
      setFinished(true)
      void complete()
      return
    }
    // Pemutar berhenti di depan soal cek sampai soal itu dijawab.
    const upNext = parts[at + 1]
    if (upNext?.kind === 'check' || (upNext?.kind === 'step' && upNext.step.tool)) setPlaying(false)
    setAt(at + 1)
  }, [at, total, complete, checks, parts])

  // Putar: langkah maju sendiri hanya setelah Play ditekan, berhenti di cek.
  useEffect(() => {
    if (!playing || reduced || finished || !part || part.kind === 'check' || part.step.tool) return
    let cancelled = false
    let timer = 0
    const advance = () => {
      if (!cancelled) goNext()
    }
    const idText = showId ? part.step.sayId : undefined
    if (sound && idText && idReady) {
      speechIdRef.current.speak(idText, () => {
        timer = window.setTimeout(advance, 700)
      })
    } else if (sound && !showId && speechRef.current.status !== 'unavailable') {
      speechRef.current.speak(part.step.say, () => {
        timer = window.setTimeout(advance, 700)
      })
    } else {
      timer = window.setTimeout(advance, dwellMs(idText ?? part.step.say))
    }
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [playing, part, reduced, finished, sound, goNext, showId, idReady])

  useEffect(() => {
    if (!playing || !sound) speechRef.current.stop()
  }, [playing, sound])

  const go = (i: number) => {
    setPlaying(false)
    setAt(Math.max(0, Math.min(i, furthest)))
  }

  const setCheck = (n: number, p: Partial<CheckState>) => setChecks((list) => list.map((c, k) => (k === n ? { ...c, ...p } : c)))

  const submitCheck = (n: number, item: ClientItem) => {
    const c = checks[n]
    if (!c || c.status !== 'open' || !isAnswerComplete(item, c.value)) return
    const ok = item.key ? checkAnswer(item.key, c.value).status === 'correct' : true
    const first = c.firstTry ?? ok
    if (ok) setCheck(n, { status: 'correct', tries: c.tries + 1, firstTry: first })
    else if (c.tries >= 1) setCheck(n, { status: 'revealed', tries: c.tries + 1, firstTry: first })
    else setCheck(n, { tries: c.tries + 1, firstTry: first, value: null })
  }

  const stepsDone = finished ? total : at

  return (
    <div data-jenjang={data.shell.jenjang} className="flex min-h-svh flex-col bg-bg text-fg">
      <header className="flex min-h-18 flex-none flex-wrap items-center gap-3 px-4 py-2 md:min-h-22 md:gap-4 md:px-8">
        <IconLink href={data.backHref} icon="arrow-left" label={copy.backToMap} />
        <span className="hidden sm:inline-flex">
          <SubjectChip subject={data.subject} size="M" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 lang="en-GB" className="m-0 text-h3 font-bold">{data.title}</h1>
          <span className="text-body text-fg-muted">{data.meta}</span>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button
            type="button"
            aria-pressed={captions}
            onClick={() => setCaptions((v) => !v)}
            className={cx(
              'inline-flex h-12 cursor-pointer items-center rounded-control border-2 px-3.5 text-body font-bold text-fg',
              captions ? 'border-fg bg-surface' : 'border-border bg-bg',
            )}
          >
            {copy.captions}
          </button>
          <button
            type="button"
            aria-pressed={sound}
            onClick={() => setSound((v) => !v)}
            className={cx(
              'inline-flex h-12 cursor-pointer items-center gap-2 rounded-control border-2 px-3.5 text-body font-bold text-fg',
              sound ? 'border-fg bg-surface' : 'border-border bg-bg',
              hideSound && 'invisible',
            )}
          >
            <UiIcon name={sound ? 'speaker' : 'speaker-off'} size={20} />
            {sound ? copy.soundOn : copy.soundOff}
          </button>
          <TranslateToggle available={translated.length > 0} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 pb-7 md:px-8 lg:flex-row">
        <section aria-label={copy.player} className="flex min-w-0 flex-col gap-3 lg:flex-[1.7]">
          {finished ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-card bg-surface shadow-soft px-6 py-10 text-center">
              <span className={cx('flex h-24 w-24 items-center justify-center rounded-card border-2 border-fg text-fg', style.solid)}>
                <UiIcon name="check" size={52} />
              </span>
              <h2 className="m-0 font-display text-display font-semibold">{copy.done}</h2>
              {data.check.length > 0 ? (
                <p className="m-0 text-body-lg">
                  {copy.checksRight(correct, data.check.length)}
                </p>
              ) : null}
              {save.state === 'busy' ? (
                <p role="status" className="m-0 inline-flex items-center gap-2 text-body-lg font-semibold">
                  <UiIcon name="spinner" size={22} />
                  {copy.saving}
                </p>
              ) : null}
              {save.state === 'error' ? (
                <ActionError message={save.message ?? ''} reference={save.reference ?? 'KRA-LES'} className="text-left">
                  <Button variant="secondary" size="M" onClick={() => void complete()} className="mt-1 self-start">
                    {t.common.tryAgain}
                  </Button>
                </ActionError>
              ) : null}
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <ButtonLink href={data.backHref} variant="secondary">
                  {copy.backToMap}
                </ButtonLink>
                <ButtonLink href={`/practice/review/${data.skillId}`} variant="secondary" prefetch={false}>
                  {copy.reviewLesson}
                </ButtonLink>
                <ButtonLink href={data.practiseHref} iconAfter="arrow-right">
                  {copy.practiseNow}
                </ButtonLink>
              </div>
            </div>
          ) : part?.kind === 'check' ? (
            <CheckPart
              key={`check-${part.n}`}
              item={part.item}
              n={part.n}
              count={data.check.length}
              state={checks[part.n] ?? { value: null, tries: 0, status: 'open', firstTry: null }}
              subject={data.subject}
              onChange={(v) => setCheck(part.n, { value: v })}
              onCheck={() => submitCheck(part.n, part.item)}
              onNext={goNext}
              isLast={at >= total - 1}
            />
          ) : part ? (
            <div data-lesson-board className="paper-grid flex min-h-[300px] min-w-0 flex-1 items-center justify-center rounded-card bg-surface shadow-soft p-4 md:min-h-[380px] md:p-6">
              <div key={at} className={cx('motion-fade flex w-full min-w-0 flex-col items-center gap-4 starting:opacity-0', part.step.tool ? 'max-w-[640px]' : 'max-w-[520px]')}>
                {part.step.show ? <LessonShow text={part.step.show} borderClass={style.border} /> : null}
                {part.step.tool ? (
                  <TapSound>
                    <div className="w-full">
                      <ToolPlay kind={part.step.tool.kind} config={part.step.tool} />
                    </div>
                  </TapSound>
                ) : part.step.figure ? (
                  <div className="w-full">
                    <Figure spec={part.step.figure} />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {!finished && part?.kind === 'step' && captions ? (
            showId && part.step.sayId ? (
              <p lang="id" aria-live="polite" className="m-0 min-h-16.5 rounded-control border border-divider bg-surface px-4 py-2.5 font-reading text-h3 md:text-h2 md:font-normal">
                {part.step.sayId}
              </p>
            ) : (
              <p lang="en-GB" aria-live="polite" className="m-0 min-h-16.5 rounded-control border border-divider bg-surface px-4 py-2.5 font-reading text-h3 md:text-h2 md:font-normal">
                <TapWords text={part.step.say} enabled={!NO_LOOKUP_SKILLS.includes(data.skillId)} />
              </p>
            )
          ) : null}

          {!finished ? (
            <div className="flex items-center gap-2.5">
              {reduced ? null : (
                <IconButton
                  icon={playing ? 'pause' : 'play'}
                  label={playing ? copy.pause : copy.play}
                  variant="primary"
                  disabled={part?.kind === 'check'}
                  onClick={() => setPlaying((p) => !p)}
                />
              )}
              <IconButton icon="skip-back" label={copy.previousPart} disabled={at === 0} onClick={() => go(at - 1)} />
              <IconButton icon="skip-next" label={copy.nextPart} disabled={!passable(at)} onClick={() => (at >= total - 1 ? goNext() : go(at + 1))} />
              <ol aria-label={copy.partOf(at + 1, total)} className="m-0 ml-1.5 flex min-w-0 flex-1 list-none items-center gap-1 p-0 sm:gap-1.5">
                {parts.map((p, i) =>
                  p.kind === 'check' ? (
                    <li key={i} className="flex h-5 w-5 flex-none items-center justify-center">
                      <span aria-hidden="true" className={cx('block h-3.5 w-3.5 rotate-45 border-2', i === at ? 'border-3 border-fg' : 'border-fg', checks[p.n]?.status !== 'open' ? 'bg-star' : 'bg-surface')} />
                    </li>
                  ) : (
                    <li key={i} className={cx('h-3 min-w-0 flex-1 rounded-pill', i < stepsDone ? style.bar : i === at ? 'border-2 border-fg bg-surface' : 'bg-divider')} />
                  ),
                )}
              </ol>
            </div>
          ) : null}
        </section>

        <aside aria-labelledby="lesson-parts" className="flex min-w-0 flex-col gap-3 rounded-card bg-surface shadow-soft p-5.5 lg:flex-1">
          <h2 id="lesson-parts" className="m-0 text-h3 font-bold">
            {copy.inThisLesson}
          </h2>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {parts.map((p, i) => {
              const current = i === at && !finished
              const done = i < at || finished
              const locked = i > furthest
              return (
                <li key={i} className="flex">
                  <button
                    type="button"
                    disabled={locked}
                    aria-current={current ? 'step' : undefined}
                    onClick={() => {
                      setFinished(false)
                      go(i)
                    }}
                    className={cx(
                      'flex min-h-14 flex-1 items-center gap-3 rounded-control px-3 py-2 text-left',
                      current ? cx('border-3', style.border, style.tint, 'text-fg') : 'border-2 border-divider bg-surface text-fg',
                      locked ? 'cursor-not-allowed text-fg-muted' : 'cursor-pointer hover:border-border',
                    )}
                  >
                    <span
                      className={cx(
                        'inline-flex h-7.5 w-7.5 flex-none items-center justify-center rounded-pill border-2 text-body font-bold',
                        done ? cx('bg-fg', 'border-transparent text-white') : current ? 'border-fg bg-surface text-fg' : 'border-border bg-surface text-fg-muted',
                      )}
                    >
                      {done ? <UiIcon name="check" size={16} strokeWidth={3} /> : p.kind === 'check' ? <UiIcon name="question" size={16} /> : i + 1}
                    </span>
                    <span lang={p.kind === 'check' ? undefined : showId && p.step.sayId ? 'id' : 'en-GB'} className="text-body-lg leading-6 font-bold">
                      {p.kind === 'check' ? copy.checkPrefix(firstSentence(p.item.prompt)) : firstSentence((showId ? p.step.sayId : undefined) ?? p.step.say)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          <p className="m-0 mt-auto text-body text-fg-muted">{copy.stopsNote}</p>
        </aside>
      </div>
    </div>
  )
}

function CheckPart({
  item,
  n,
  count,
  state,
  subject,
  onChange,
  onCheck,
  onNext,
  isLast,
}: {
  item: ClientItem
  n: number
  count: number
  state: CheckState
  subject: LessonDTO['subject']
  onChange: (v: unknown | null) => void
  onCheck: () => void
  onNext: () => void
  isLast: boolean
}): ReactElement {
  const t = useT()
  const copy = t.lessons.lesson
  const open = state.status === 'open'
  const feedback = state.status === 'correct' ? 'correct' : state.status === 'revealed' ? 'not-yet' : null
  const line =
    state.status === 'correct'
      ? copy.correct
      : state.status === 'revealed'
        ? copy.notYetAnswer(item.reveal?.answerText ?? copy.answerShownAbove)
        : state.tries > 0
          ? copy.notYetLookAgain
          : null
  return (
    <div role="group" aria-labelledby={`check-title-${n}`} className="flex flex-1 flex-col gap-4 rounded-card border-3 border-fg bg-surface p-4 md:p-6">
      <div className="flex items-center gap-2.5">
        <span id={`check-title-${n}`} className="inline-flex h-7.5 items-center gap-1.5 rounded-pill bg-fg px-3 text-body font-bold text-white">
          <UiIcon name="check" size={14} strokeWidth={3} />
          {count > 1 ? copy.checkBadgeOf(n + 1, count) : copy.checkBadge}
        </span>
      </div>
      <QuestionView item={item} number={n + 1} subject={subject} hideTools tapWords answer={{ value: state.value, onChange, disabled: !open, feedback }} />
      <Widget item={item} value={state.value} onChange={(v) => open && onChange(v)} disabled={!open} feedback={feedback} subject={subject} />
      <div className="mt-auto flex flex-wrap items-center gap-3">
        <p role="status" className={cx('m-0 min-w-0 flex-1 text-body-lg font-bold', state.status === 'correct' ? 'text-success' : line ? 'text-warn' : '')}>
          {line}
        </p>
        {open ? (
          <Button onClick={onCheck} disabled={!isAnswerComplete(item, state.value)}>
            {t.common.check}
          </Button>
        ) : (
          <Button onClick={onNext} iconAfter="arrow-right" autoFocus>
            {isLast ? copy.finishLesson : copy.keepGoing}
          </Button>
        )}
      </div>
    </div>
  )
}
