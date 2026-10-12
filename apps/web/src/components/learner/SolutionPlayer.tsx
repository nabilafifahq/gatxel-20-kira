'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { SolutionStep } from '@kira/content/schema'
import { Figure, type FigureSpec } from '@kira/figures'
import type { Subject } from '@/lib/dto'
import { Button, IconButton } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { useReducedMotion } from './hooks'
import { useSpeech, type SpeechLang } from './speech'
import { SUBJECT_STYLE } from './subject'

/**
 * Pemutar langkah pembahasan (papan SolutionPlayer). Tidak pernah diputar otomatis:
 * langkah pertama tampil diam sampai Play diketuk. Back dan Next melompat per langkah,
 * Play again mengulang dari langkah 1. Caption selalu tampil. Dengan reduced motion,
 * setiap langkah tampil sebagai gambar diam dengan tombol Back dan Next.
 */

function dwellMs(step: SolutionStep | undefined): number {
  if (!step) return 2500
  return Math.max(2800, step.say.length * 70)
}

export function SolutionPlayer({
  steps,
  subject,
  narrate = false,
  lang = 'en-GB',
  reduced: reducedProp,
  className,
  label = 'Solution player',
  figure: fallbackFigure,
}: {
  steps: SolutionStep[]
  /** Figur soal, dipakai untuk langkah yang tidak membawa figur sendiri. */
  figure?: FigureSpec
  subject: Subject
  /** Bacakan caption saat diputar. */
  narrate?: boolean
  lang?: SpeechLang
  reduced?: boolean
  className?: string
  label?: string
}): ReactElement {
  const prefersReduced = useReducedMotion()
  const reduced = reducedProp ?? prefersReduced
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const speech = useSpeech(lang)
  const speechRef = useRef(speech)
  useEffect(() => {
    speechRef.current = speech
  })
  const total = steps.length
  const current = steps[Math.min(step, Math.max(0, total - 1))]
  const style = SUBJECT_STYLE[subject]

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
    if (narrate && speechRef.current.status !== 'unavailable' && current) {
      speechRef.current.speak(current.say, () => {
        timer = window.setTimeout(advance, 600)
      })
    } else {
      timer = window.setTimeout(advance, dwellMs(current))
    }
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [playing, step, reduced, narrate, total, current])

  useEffect(() => {
    if (!playing) speechRef.current.stop()
  }, [playing])

  if (total === 0 || !current) {
    return <p className="m-0 text-body-lg text-fg-muted">The steps for this question are not ready yet.</p>
  }

  const go = (n: number) => {
    setPlaying(false)
    setStep(Math.max(0, Math.min(total - 1, n)))
  }
  const atStart = step === 0
  const atEnd = step >= total - 1

  return (
    <div role="region" aria-label={label} className={cx('flex flex-col overflow-hidden rounded-card border border-divider bg-surface', className)}>
      <div className="relative flex min-h-[200px] items-center justify-center bg-bg px-4 pt-5 pb-3">
        <div key={step} className="motion-fade flex w-full flex-col items-center gap-3 starting:opacity-0">
          {current.figure || fallbackFigure ? (
            <div className="w-full max-w-[380px]">
              <Figure spec={(current.figure ?? fallbackFigure) as FigureSpec} />
            </div>
          ) : null}
          {current.show ? <div className="text-center font-display text-h1 font-semibold tabular-nums">{current.show}</div> : null}
          {!current.figure && !fallbackFigure && !current.show ? (
            <div aria-hidden="true" className="font-display text-display font-semibold text-border tabular-nums">
              {step + 1}
            </div>
          ) : null}
        </div>
        {reduced ? (
          <span className="absolute top-2.5 left-2.5 inline-flex h-7 items-center rounded-pill border border-border bg-surface px-2.5 text-body font-bold">
            Still pictures
          </span>
        ) : !playing && step > 0 ? (
          <span className="absolute top-2.5 left-2.5 inline-flex h-7 items-center rounded-pill bg-fg px-2.5 text-body font-bold text-white">Paused</span>
        ) : null}
      </div>
      <p aria-live="polite" className="m-0 bg-fg px-4 py-3 font-reading text-h3 text-white">
        {current.say}
      </p>
      <div className="flex flex-col gap-2.5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {reduced ? (
            <>
              <Button variant="secondary" icon="skip-back" disabled={atStart} onClick={() => go(step - 1)}>
                Back
              </Button>
              <Button variant="secondary" iconAfter="skip-next" disabled={atEnd} onClick={() => go(step + 1)} className="ml-auto">
                Next
              </Button>
            </>
          ) : (
            <>
              <IconButton icon="skip-back" label="Previous step" disabled={atStart} onClick={() => go(step - 1)} />
              <IconButton
                icon={playing ? 'pause' : 'play'}
                label={playing ? 'Pause' : 'Play'}
                variant="primary"
                onClick={() => {
                  if (playing) setPlaying(false)
                  else {
                    if (atEnd) setStep(0)
                    setPlaying(true)
                  }
                }}
              />
              <IconButton icon="skip-next" label="Next step" disabled={atEnd} onClick={() => go(step + 1)} />
              <IconButton
                icon="replay"
                label="Play again from the start"
                className="ml-auto"
                onClick={() => {
                  setStep(0)
                  setPlaying(true)
                }}
              />
            </>
          )}
        </div>
        <div className="flex items-center justify-between text-body font-bold">
          <span className="tabular-nums">
            Step {step + 1} of {total}
          </span>
          <span className="font-semibold text-fg-muted">{reduced ? (atEnd ? 'Last step' : 'Tap Next') : playing ? 'Playing' : 'Tap Play'}</span>
        </div>
        <div role="progressbar" aria-label={`Step ${step + 1} of ${total}`} aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1} className="flex gap-1">
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
