'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type {
  QuizAnswerInput,
  QuizDTO,
  QuizResultDTO,
  ReaderDTO,
} from '@/lib/dto-reading'
import type { ActionResult } from '@/lib/dto'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { AnswerTile } from '@/components/learner/AnswerTile'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { SentenceText } from '@/components/learner/reading/SentenceText'
import { playSfx } from '@/components/learner/sfx'
import { useSpeech } from '@/components/learner/speech'
import { XpPill } from '@/components/learner/XpPill'
import { useT } from '@/lib/i18n/client'
import { ActionError } from './common'

/**
 * Pembaca Ruang Baca. Teks per halaman (jumlah kata mengikuti level buku), ukuran huruf yang bisa diatur,
 * dan baca bersama: kalimat yang sedang dibacakan disorot selama klipnya diputar (klip pencerita per kalimat,
 * suara perangkat bila klip belum ada). Di akhir bab ada pertanyaan yang dinilai server.
 */

const SIZES = [20, 24, 28, 34] as const
const KEY_SIZE = 'kira.reader.size'
const KEY_AUTO = 'kira.reader.auto'
const HEARTBEAT_MS = 30_000
const ACTIVE_WINDOW_MS = 90_000

function defaultSize(grade: number): number {
  return grade <= 2 ? 2 : 1
}

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStore(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Penyimpanan diblokir: pengaturan hanya berlaku selama layar ini terbuka.
  }
}

type Phase = 'reading' | 'intro' | 'quiz' | 'result'

type Actions = {
  saveProgress: (input: { bookId: string; chapterId: string; sentenceIdx: number }) => Promise<ActionResult<null>>
  logTime: (input: { seconds: number }) => Promise<ActionResult<null>>
  startQuiz: (input: { bookId: string; chapterId: string }) => Promise<ActionResult<QuizDTO>>
  submitQuiz: (input: { quizId: string; answers: QuizAnswerInput[] }) => Promise<ActionResult<QuizResultDTO>>
  skipQuiz: (input: { bookId: string; chapterId: string }) => Promise<ActionResult<{ bookFinished: boolean; nextHref: string | null }>>
}

export function ReaderScreen({ data, actions }: { data: ReaderDTO; actions: Actions }): ReactElement {
  const t = useT()
  const tr = t.reading.reader
  const { speak, stop, status } = useSpeech('en-GB')
  const flat = useMemo(() => data.pages.flatMap((p) => p.sentences), [data.pages])
  const pageOf = useMemo(() => {
    const m = new Map<number, number>()
    data.pages.forEach((p, i) => p.sentences.forEach((s) => m.set(s.index, i)))
    return m
  }, [data.pages])

  const [phase, setPhase] = useState<Phase>('reading')
  const [size, setSize] = useState<number>(defaultSize(data.grade))
  const [auto, setAuto] = useState(true)
  const [cur, setCur] = useState(Math.min(data.startSentence, Math.max(0, flat.length - 1)))
  const [active, setActive] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [replay, setReplay] = useState(0)
  const autoRef = useRef(auto)
  const lastActive = useRef(Date.now())

  useEffect(() => {
    autoRef.current = auto
  }, [auto])

  // Pengaturan huruf dan lanjut otomatis diingat di perangkat ini.
  useEffect(() => {
    const s = Number(readStore(KEY_SIZE))
    if (Number.isInteger(s) && s >= 0 && s < SIZES.length && readStore(KEY_SIZE) !== null) setSize(s)
    if (readStore(KEY_AUTO) === 'off') setAuto(false)
  }, [])

  const page = pageOf.get(cur) ?? 0
  const pageData = data.pages[page]
  const lastPage = page >= data.pages.length - 1
  const unavailable = status === 'unavailable'

  // Baca bersama: satu kalimat sekali jalan, lalu lanjut ke kalimat berikutnya.
  useEffect(() => {
    if (!playing || phase !== 'reading') return
    const s = flat[cur]
    if (!s) {
      setPlaying(false)
      return
    }
    speak(
      s.text,
      () => {
        const next = cur + 1
        if (next >= flat.length) {
          setPlaying(false)
          return
        }
        if (!autoRef.current && pageOf.get(next) !== pageOf.get(cur)) {
          setPlaying(false)
          setCur(next)
          return
        }
        setCur(next)
      },
      { style: 'narrator' },
    )
    return () => stop()
  }, [playing, cur, replay, phase, flat, pageOf, speak, stop])

  useEffect(() => {
    if (unavailable) setPlaying(false)
  }, [unavailable])

  // Tempat berhenti disimpan setelah jeda singkat, supaya bisa dilanjutkan di perangkat mana pun.
  useEffect(() => {
    if (phase !== 'reading') return
    const t = window.setTimeout(() => void actions.saveProgress({ bookId: data.bookId, chapterId: data.chapterId, sentenceIdx: cur }), 1200)
    return () => window.clearTimeout(t)
  }, [cur, phase, actions, data.bookId, data.chapterId])

  // Menit membaca: dicatat tiap 30 detik selama halaman terbuka dan anak aktif (atau bacaan sedang diputar).
  const playingRef = useRef(false)
  useEffect(() => {
    playingRef.current = playing
  }, [playing])
  useEffect(() => {
    const touch = () => {
      lastActive.current = Date.now()
    }
    for (const t of ['pointerdown', 'keydown', 'scroll'] as const) window.addEventListener(t, touch, { passive: true })
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (playingRef.current || Date.now() - lastActive.current < ACTIVE_WINDOW_MS) void actions.logTime({ seconds: 30 })
    }, HEARTBEAT_MS)
    return () => {
      for (const t of ['pointerdown', 'keydown', 'scroll'] as const) window.removeEventListener(t, touch)
      window.clearInterval(timer)
    }
  }, [actions])

  // Berhenti membaca bila layar ditinggalkan.
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === 'hidden') setPlaying(false)
    }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [])

  const goPage = useCallback(
    (to: number) => {
      const target = data.pages[Math.min(Math.max(to, 0), data.pages.length - 1)]
      if (!target) return
      playSfx('whoosh')
      setCur(target.sentences[0]!.index)
    },
    [data.pages],
  )

  const togglePlay = () => {
    setActive(true)
    if (playing) setPlaying(false)
    else {
      if (cur >= flat.length - 1 && !flat[cur]) setCur(0)
      setPlaying(true)
    }
  }

  const step = (by: number) => {
    setActive(true)
    setCur((c) => Math.min(Math.max(c + by, 0), flat.length - 1))
  }

  const changeSize = (by: number) => {
    const next = Math.min(Math.max(size + by, 0), SIZES.length - 1)
    setSize(next)
    writeStore(KEY_SIZE, String(next))
    playSfx('tap')
  }

  const toggleAuto = () => {
    const next = !auto
    setAuto(next)
    writeStore(KEY_AUTO, next ? 'on' : 'off')
  }

  const paragraphs = useMemo(() => {
    const out: { paragraph: number; items: typeof flat }[] = []
    for (const s of pageData?.sentences ?? []) {
      const last = out[out.length - 1]
      if (last && last.paragraph === s.paragraph) last.items.push(s)
      else out.push({ paragraph: s.paragraph, items: [s] })
    }
    return out
  }, [pageData])

  // --- Pertanyaan bab ---
  const [quiz, setQuiz] = useState<QuizDTO | null>(null)
  const [qIndex, setQIndex] = useState(0)
  const [choices, setChoices] = useState<Record<string, number>>({})
  const [result, setResult] = useState<QuizResultDTO | null>(null)
  const [skipped, setSkipped] = useState<{ bookFinished: boolean; nextHref: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; reference: string } | null>(null)

  const finishReading = () => {
    setPlaying(false)
    stop()
    setPhase('intro')
    playSfx('complete')
  }

  const beginQuiz = async () => {
    setBusy(true)
    setError(null)
    const res = await actions.startQuiz({ bookId: data.bookId, chapterId: data.chapterId })
    setBusy(false)
    if (!res.ok) return setError({ message: res.message, reference: res.reference })
    setQuiz(res.data)
    setQIndex(0)
    setChoices({})
    setPhase('quiz')
  }

  const skipQuiz = async () => {
    setBusy(true)
    setError(null)
    const res = await actions.skipQuiz({ bookId: data.bookId, chapterId: data.chapterId })
    setBusy(false)
    if (!res.ok) return setError({ message: res.message, reference: res.reference })
    setSkipped(res.data)
    setPhase('result')
  }

  const sendQuiz = async () => {
    if (!quiz) return
    setBusy(true)
    setError(null)
    const answers = quiz.questions.flatMap((q) => (choices[q.id] === undefined ? [] : [{ questionId: q.id, choice: choices[q.id]! }]))
    const res = await actions.submitQuiz({ quizId: quiz.quizId, answers })
    setBusy(false)
    if (!res.ok) return setError({ message: res.message, reference: res.reference })
    setResult(res.data)
    setPhase('result')
    playSfx(res.data.bookFinished ? 'levelup' : 'complete')
  }

  const header = (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <Link href={data.bookHref} lang="en-GB" className="inline-flex min-h-11 items-center gap-1.5 text-body font-bold text-fg no-underline">
          <UiIcon name="arrow-left" size={18} />
          {data.bookTitle}
        </Link>
        <h1 className="m-0 text-h2 font-bold">
          {tr.chapterHeading(data.chapterNumber)} <span lang="en-GB">{data.chapterTitle}</span>
        </h1>
      </div>
      {phase === 'reading' ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={tr.settings}>
          <IconButton icon="minus" label={tr.smaller} size="M" variant="secondary" disabled={size === 0} onClick={() => changeSize(-1)} className="h-12 w-12" />
          <span className="min-w-24 text-center text-small font-bold" aria-live="polite">
            {tr.textSize(tr.sizeNames[size] ?? '')}
          </span>
          <IconButton icon="plus" label={tr.larger} size="M" variant="secondary" disabled={size === SIZES.length - 1} onClick={() => changeSize(1)} className="h-12 w-12" />
        </div>
      ) : null}
    </header>
  )

  return (
    <LearnerFrame shell={data.shell} current="reading" className="flex flex-col gap-5">
      {header}

      {phase === 'reading' ? (
        <>
          <article
            aria-label={tr.pageAria(data.bookTitle, data.chapterNumber, page + 1, data.pages.length)}
            className="rounded-card border border-divider bg-surface px-5 py-6 md:px-10 md:py-9"
          >
            <div lang="en-GB" className="font-reading" style={{ fontSize: `${SIZES[size]}px`, lineHeight: 1.75, maxWidth: '40em' }}>
              {paragraphs.map((p) => (
                <p key={p.paragraph} className="m-0 mb-[0.9em] last:mb-0">
                  {p.items.map((s) => (
                    <span key={s.index}>
                      <span
                        data-sentence={s.index}
                        aria-current={active && s.index === cur ? 'true' : undefined}
                        onClick={() => {
                          setActive(true)
                          setCur(s.index)
                          if (!unavailable) setPlaying(true)
                          setReplay((r) => r + 1)
                        }}
                        className={cx('cursor-pointer rounded-control box-decoration-clone px-1 py-0.5 transition-colors duration-150', active && s.index === cur ? 'bg-star/45' : 'hover:bg-bg')}
                      >
                        <SentenceText text={s.text} />
                      </span>{' '}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          </article>

          <div className="flex flex-wrap items-center justify-between gap-3" role="group" aria-label={tr.controls}>
            <div className="flex flex-wrap items-center gap-2">
              <IconButton icon="skip-back" label={tr.prevSentence} size="M" variant="secondary" disabled={unavailable} onClick={() => step(-1)} />
              <Button
                variant={playing ? 'secondary' : 'primary'}
                icon={playing ? 'pause' : 'play'}
                aria-pressed={playing}
                disabled={unavailable}
                onClick={togglePlay}
              >
                {playing ? tr.pause : active ? tr.play : tr.readAlong}
              </Button>
              <IconButton
                icon="replay"
                label={tr.sentenceAgain}
                size="M"
                variant="secondary"
                disabled={unavailable}
                onClick={() => {
                  setActive(true)
                  setPlaying(true)
                  setReplay((r) => r + 1)
                }}
              />
              <IconButton icon="skip-next" label={tr.nextSentence} size="M" variant="secondary" disabled={unavailable} onClick={() => step(1)} />
            </div>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-body font-bold">
              <input type="checkbox" checked={auto} onChange={toggleAuto} className="h-6 w-6 accent-fg" />
              {tr.autoTurn}
            </label>
          </div>
          {unavailable ? <p className="m-0 text-body text-fg-muted">{tr.noVoice}</p> : null}

          <nav aria-label={tr.pagesNav} className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" icon="arrow-left" disabled={page === 0} onClick={() => goPage(page - 1)}>
              {t.common.back}
            </Button>
            <span className="order-first w-full text-center text-body font-bold tabular-nums md:order-none md:w-auto">
              {tr.pageOf(page + 1, data.pages.length)}
            </span>
            {lastPage ? (
              <Button variant="primary" iconAfter="check" onClick={finishReading}>
                {tr.finishChapter}
              </Button>
            ) : (
              <Button variant="primary" iconAfter="arrow-right" onClick={() => goPage(page + 1)}>
                {tr.nextPage}
              </Button>
            )}
          </nav>
        </>
      ) : null}

      {phase === 'intro' ? (
        <section aria-labelledby="done" className="flex max-w-2xl flex-col gap-4 rounded-card border-2 border-english bg-english-50 p-6">
          <h2 id="done" className="m-0 text-h1 font-bold">
            {tr.doneTitle}
          </h2>
          <p className="m-0 text-body-lg">{tr.doneIntro}</p>
          {data.done ? <p className="m-0 text-body text-fg-muted">{tr.readBefore}</p> : null}
          {error ? <ActionError message={error.message} reference={error.reference} /> : null}
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" loading={busy} onClick={() => void beginQuiz()}>
              {tr.answerQuestions}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void skipQuiz()}>
              {tr.skipQuestions}
            </Button>
          </div>
        </section>
      ) : null}

      {phase === 'quiz' && quiz ? (
        <section aria-labelledby="qtitle" className="flex max-w-3xl flex-col gap-4">
          <p className="m-0 text-body font-bold tabular-nums" id="qtitle">
            {tr.questionOf(qIndex + 1, quiz.questions.length)}
          </p>
          <div role="progressbar" aria-label={tr.questionsAnswered} aria-valuemin={0} aria-valuemax={quiz.questions.length} aria-valuenow={Object.keys(choices).length} className="flex h-2 overflow-hidden rounded-pill bg-divider">
            <span className="bg-english" style={{ width: `${(Object.keys(choices).length / quiz.questions.length) * 100}%` }} />
          </div>
          {(() => {
            const q = quiz.questions[qIndex]!
            return (
              <div className="flex flex-col gap-4" key={q.id}>
                <p lang="en-GB" className="m-0 font-reading text-h3 font-bold">{q.prompt}</p>
                <div lang="en-GB" role="radiogroup" aria-label={q.prompt} className="flex flex-col gap-3">
                  {q.options.map((o, i) => (
                    <AnswerTile
                      key={i}
                      role="radio"
                      aria-checked={choices[q.id] === i}
                      subject="english"
                      letter={'ABCD'[i]!}
                      state={choices[q.id] === i ? 'selected' : 'default'}
                      onClick={() => {
                        playSfx('tap')
                        setChoices((c) => ({ ...c, [q.id]: i }))
                      }}
                    >
                      <span className="font-reading text-body-lg">{o}</span>
                    </AnswerTile>
                  ))}
                </div>
              </div>
            )
          })()}
          {error ? <ActionError message={error.message} reference={error.reference} /> : null}
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" icon="arrow-left" disabled={qIndex === 0} onClick={() => setQIndex((i) => i - 1)}>
              {t.common.back}
            </Button>
            {qIndex < quiz.questions.length - 1 ? (
              <Button variant="primary" iconAfter="arrow-right" disabled={choices[quiz.questions[qIndex]!.id] === undefined} onClick={() => setQIndex((i) => i + 1)}>
                {tr.nextQuestion}
              </Button>
            ) : (
              <Button variant="primary" loading={busy} disabled={Object.keys(choices).length < quiz.questions.length} onClick={() => void sendQuiz()}>
                {tr.checkAnswers}
              </Button>
            )}
          </div>
        </section>
      ) : null}

      {phase === 'result' ? (
        <section aria-labelledby="rtitle" className="flex max-w-3xl flex-col gap-4">
          {result ? (
            <>
              <h2 id="rtitle" className="m-0 text-h1 font-bold">
                {tr.score(result.correct, result.total)}
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                {result.xp > 0 ? <XpPill xp={result.xp} size="L" countUp /> : <span className="text-body text-fg-muted">{tr.noNewXp}</span>}
                {result.bookXp > 0 ? <XpPill xp={result.bookXp} size="L" /> : null}
              </div>
              {result.bookFinished ? (
                <p className="m-0 rounded-card border-2 border-success bg-success-50 p-4 text-body-lg font-bold">
                  {tr.finishedBook}
                  <span lang="en-GB">{data.bookTitle}</span>
                  {tr.finishedBookTail}
                </p>
              ) : null}
              <ol className="m-0 flex list-none flex-col gap-3 p-0">
                {result.review.map((r, n) => {
                  const ok = r.chosen === r.answer
                  return (
                    <li key={r.questionId} className={cx('flex flex-col gap-1.5 rounded-card border-2 p-4', ok ? 'border-success bg-success-50' : 'border-warn bg-surface')}>
                      <p lang="en-GB" className="m-0 font-reading text-body-lg font-bold">
                        {n + 1}. {r.prompt}
                      </p>
                      <p className="m-0 inline-flex items-center gap-1.5 text-body font-bold">
                        <UiIcon name={ok ? 'check' : 'not-yet'} size={16} strokeWidth={3} />
                        {ok ? tr.correct : tr.notYet}
                      </p>
                      {!ok ? (
                        <p className="m-0 text-body">
                          {tr.yourAnswer} {r.chosen >= 0 ? <span lang="en-GB">{r.options[r.chosen]}</span> : tr.noAnswer}
                        </p>
                      ) : null}
                      <p className="m-0 text-body">
                        {tr.theAnswer} <span lang="en-GB">{r.options[r.answer]}</span>
                      </p>
                      <p lang="en-GB" className="m-0 text-body text-fg-muted">
                        {r.why}
                      </p>
                    </li>
                  )
                })}
              </ol>
            </>
          ) : (
            <h2 id="rtitle" className="m-0 text-h1 font-bold">
              {skipped?.bookFinished ? (
                <>
                  {tr.finishedBook}
                  <span lang="en-GB">{data.bookTitle}</span>
                </>
              ) : (
                tr.chapterDone
              )}
            </h2>
          )}
          <div className="flex flex-wrap gap-3">
            {(result?.nextHref ?? skipped?.nextHref ?? data.nextHref) ? (
              <ButtonLink href={(result?.nextHref ?? skipped?.nextHref ?? data.nextHref)!} variant="primary" iconAfter="arrow-right">
                {tr.nextChapter}
              </ButtonLink>
            ) : null}
            <ButtonLink href={data.bookHref} variant="secondary">
              {tr.backToBook}
            </ButtonLink>
            <ButtonLink href={data.libraryHref} variant="secondary">
              {t.reading.name}
            </ButtonLink>
          </div>
        </section>
      ) : null}
    </LearnerFrame>
  )
}
