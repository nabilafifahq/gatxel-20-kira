'use client'

import dynamic from 'next/dynamic'
import { Fragment, useEffect, useRef, useState, type ReactElement } from 'react'
import type { SolutionStep } from '@kira/content/schema'
import type { SolutionStepView } from '@kira/content/walkthrough'
import { Figure, type FigureSpec } from '@kira/figures'
import type { Subject } from '@/lib/dto'
import { Button, IconButton } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { useT } from '@/lib/i18n/client'
import { TranslateToggle, useExplainLang, useIdClipsReady } from './explain-lang'
import { useReducedMotion } from './hooks'
import { showSizeClass } from './LessonShow'
import { useSpeech, type SpeechLang } from './speech'
import { SUBJECT_STYLE } from './subject'

/**
 * Pemutar langkah pembahasan (papan SolutionPlayer), sekarang bergerak. Tiap langkah boleh membawa gambar
 * bergerak (`anim`: angka bergerak, hitung bersusun, model batang, garis bilangan, deret, baris dicentang),
 * sorotan di kalimat soal (`mark`), atau figur diam. Tidak pernah diputar sendiri: langkah pertama tampil
 * diam sampai Play diketuk. Play membacakan tiap langkah dengan suara guru yang tetap lalu maju; Pause
 * menghentikan; Next dan Back melompat; Replay mengulang dari awal. Dengan reduced motion setiap langkah
 * tampil sebagai gambar diam lengkap dengan tombol Back dan Next. Kode gambar bergerak dimuat malas.
 */

const AnimStage = dynamic(() => import('./AnimStage'), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-[190px] w-full max-w-[380px]" />,
})

function dwellMs(step: SolutionStep | undefined): number {
  if (!step) return 2500
  return Math.max(3200, step.say.length * 70 + (step.anim ? 1200 : 0))
}

/** Posisi sorotan di teks. Angka tidak boleh menempel pada angka lain, misalnya 3 di dalam 34 atau Rp3 di dalam Rp3.500. */
function findMark(text: string, m: string): number {
  if (!/\d/.test(m)) return text.indexOf(m)
  for (let at = text.indexOf(m); at >= 0; at = text.indexOf(m, at + 1)) {
    const before = text.slice(Math.max(0, at - 2), at)
    const after = text.slice(at + m.length, at + m.length + 2)
    const startsDigit = /^\d/.test(m)
    const endsDigit = /\d$/.test(m)
    if (startsDigit && (/\d$/.test(before) || /\d[.,]$/.test(before))) continue
    if (endsDigit && /^(\d|[.,]\d)/.test(after)) continue
    return at
  }
  return -1
}

/** Kalimat soal dengan bagian `mark` disorot. Sorotan hanya tampil bila langkah memintanya. */
function MarkedPrompt({ prompt, marks, reduced, lang }: { prompt: string; marks: readonly string[]; reduced: boolean; lang: string }): ReactElement {
  const spans: { text: string; hit: boolean }[] = []
  let rest = prompt
  const wanted = [...marks].sort((a, b) => findMark(prompt, a) - findMark(prompt, b))
  for (const m of wanted) {
    const at = findMark(rest, m)
    if (at < 0) continue
    if (at > 0) spans.push({ text: rest.slice(0, at), hit: false })
    spans.push({ text: m, hit: true })
    rest = rest.slice(at + m.length)
  }
  if (rest) spans.push({ text: rest, hit: false })
  return (
    <p lang={lang} className="m-0 w-full rounded-card border border-divider bg-surface px-3 py-2 text-left font-reading text-body leading-snug">
      {spans.map((s, i) =>
        s.hit ? (
          <mark key={i} className={cx('rounded-sm bg-star px-0.5 font-bold text-fg', !reduced && 'kira-mark')}>
            {s.text}
          </mark>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </p>
  )
}

export function SolutionPlayer({
  steps,
  subject,
  narrate = true,
  lang = 'en-GB',
  reduced: reducedProp,
  className,
  label,
  figure: fallbackFigure,
  prompt,
  onFinished,
}: {
  steps: SolutionStepView[]
  /** Figur soal, dipakai untuk langkah yang tidak membawa figur sendiri. */
  figure?: FigureSpec
  subject: Subject
  /** Bacakan caption saat diputar (suara guru yang tetap). */
  narrate?: boolean
  lang?: SpeechLang
  reduced?: boolean
  className?: string
  label?: string
  /** Teks soal, untuk menampilkan bagian yang disorot. */
  prompt?: string
  /** Dipanggil saat langkah terakhir sudah tampil. */
  onFinished?: () => void
}): ReactElement {
  const dict = useT()
  const t = dict.runner.solution
  const prefersReduced = useReducedMotion()
  const reduced = reducedProp ?? prefersReduced
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [sound, setSound] = useState(narrate)
  const speech = useSpeech(lang)
  const speechRef = useRef(speech)
  const speechId = useSpeech('id')
  const speechIdRef = useRef(speechId)
  const finishedRef = useRef(onFinished)
  useEffect(() => {
    speechRef.current = speech
    speechIdRef.current = speechId
    finishedRef.current = onFinished
  })
  const total = steps.length
  const current = steps[Math.min(step, Math.max(0, total - 1))]
  const style = SUBJECT_STYLE[subject]
  const explain = useExplainLang()
  const translatedKey = steps.flatMap((s) => (s.sayId ? [s.sayId] : [])).join('\n')
  const translated = translatedKey ? translatedKey.split('\n') : []
  const showId = explain.on && translated.length > 0
  const idReady = useIdClipsReady(showId ? translated : [])
  // Suara mengikuti bahasa teks yang tampil. Teks Indonesia tanpa klip: diam, tombol suaranya tidak tampil.
  const idLine = showId ? current?.sayId : undefined
  const canSpeak = showId ? idReady : lang === 'en-GB' && speech.status !== 'unavailable'

  useEffect(() => {
    if (total > 0 && step >= total - 1) finishedRef.current?.()
  }, [step, total])

  // Maju otomatis hanya saat Play aktif.
  useEffect(() => {
    if (!playing || reduced) return
    let cancelled = false
    let timer = 0
    const advance = () => {
      if (cancelled) return
      if (step >= total - 1) setPlaying(false)
      else setStep(step + 1)
    }
    if (sound && canSpeak && current && idLine) {
      speechIdRef.current.speak(idLine, () => {
        timer = window.setTimeout(advance, 700)
      })
    } else if (sound && canSpeak && current) {
      speechRef.current.speak(
        current.say,
        () => {
          timer = window.setTimeout(advance, 700)
        },
        { style: 'teacher' },
      )
    } else {
      timer = window.setTimeout(advance, dwellMs(current))
    }
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [playing, step, reduced, sound, canSpeak, total, current, idLine])

  useEffect(() => {
    if (!playing) speechRef.current.stop()
  }, [playing])
  useEffect(() => () => speechRef.current.stop(), [])

  if (total === 0 || !current) {
    return <p className="m-0 text-body-lg text-fg-muted">{t.notReady}</p>
  }

  const go = (n: number) => {
    setPlaying(false)
    setStep(Math.max(0, Math.min(total - 1, n)))
  }
  const atStart = step === 0
  const atEnd = step >= total - 1
  const figure = (current.figure ?? fallbackFigure) as FigureSpec | undefined

  return (
    <div role="region" aria-label={label ?? t.player} className={cx('flex flex-col overflow-hidden rounded-card bg-surface shadow-soft', className)}>
      <div className="relative flex min-h-[200px] items-center justify-center bg-bg px-4 pt-5 pb-3">
        <div key={step} className="motion-fade flex w-full flex-col items-center gap-3 starting:opacity-0">
          {prompt && current.mark ? <MarkedPrompt prompt={prompt} marks={current.mark} reduced={reduced} lang={lang} /> : null}
          {current.anim ? <AnimStage anim={current.anim} subject={subject} reduced={reduced} /> : null}
          {!current.anim && figure ? (
            <div className={cx('w-full max-w-[380px] rounded-card', current.focus === 'figure' && cx('p-1 ring-4 ring-star', !reduced && 'kira-pulse'))}>
              <Figure spec={figure} />
            </div>
          ) : null}
          {current.show && !current.anim ? <div lang={lang} className={cx('max-w-full text-center font-numbers font-semibold text-balance tabular-nums [overflow-wrap:anywhere]', showSizeClass(current.show, 'player'))}>{current.show}</div> : null}
          {!current.anim && !figure && !current.show && !current.mark ? (
            <div aria-hidden="true" className="font-numbers text-display font-semibold text-border tabular-nums">
              {step + 1}
            </div>
          ) : null}
        </div>
        {reduced ? (
          <span className="absolute top-2.5 left-2.5 inline-flex h-7 items-center rounded-pill border border-border bg-surface px-2.5 text-body font-bold">
            {t.stillPictures}
          </span>
        ) : !playing && step > 0 ? (
          <span className="absolute top-2.5 left-2.5 inline-flex h-7 items-center rounded-pill bg-fg px-2.5 text-body font-bold text-white">{t.paused}</span>
        ) : null}
      </div>
      <p aria-live="polite" lang={idLine ? 'id' : lang} className="m-0 bg-fg px-4 py-3 font-reading text-h3 text-white">
        {idLine ?? current.say}
      </p>
      <div className="flex flex-col gap-2.5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {reduced ? (
            <>
              <Button variant="secondary" icon="skip-back" disabled={atStart} onClick={() => go(step - 1)}>
                {dict.common.back}
              </Button>
              <Button variant="secondary" iconAfter="skip-next" disabled={atEnd} onClick={() => go(step + 1)} className="ml-auto">
                {dict.common.next}
              </Button>
            </>
          ) : (
            <>
              <IconButton icon="skip-back" label={t.previousStep} disabled={atStart} onClick={() => go(step - 1)} />
              <IconButton
                icon={playing ? 'pause' : 'play'}
                label={playing ? t.pause : t.play}
                variant="primary"
                onClick={() => {
                  if (playing) setPlaying(false)
                  else {
                    if (atEnd) setStep(0)
                    setPlaying(true)
                  }
                }}
              />
              <IconButton icon="skip-next" label={t.nextStep} disabled={atEnd} onClick={() => go(step + 1)} />
              {canSpeak ? (
                <IconButton
                  icon={sound ? 'speaker' : 'speaker-off'}
                  label={sound ? t.soundOn : t.soundOff}
                  variant="secondary"
                  onClick={() => setSound((v) => !v)}
                />
              ) : null}
              <IconButton
                icon="replay"
                label={t.replay}
                className="ml-auto"
                onClick={() => {
                  setStep(0)
                  setPlaying(true)
                }}
              />
            </>
          )}
        </div>
        <TranslateToggle available={translated.length > 0 && lang !== 'id'} className="self-start" />
        <div className="flex items-center justify-between text-body font-bold">
          <span className="tabular-nums">{t.stepOf(step + 1, total)}</span>
          <span className="font-semibold text-fg-muted">{reduced ? (atEnd ? t.lastStep : t.tapNext) : playing ? t.playing : t.tapPlay}</span>
        </div>
        <div role="progressbar" aria-label={t.stepOf(step + 1, total)} aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1} className="flex gap-1">
          {steps.map((_, i) => (
            <span key={i} className="flex h-2 flex-1 overflow-hidden rounded-pill bg-divider">
              <span className={cx(style.bar, 'w-full transition-transform duration-240 ease-kira origin-left', i <= step ? 'scale-x-100' : 'scale-x-0')} />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
