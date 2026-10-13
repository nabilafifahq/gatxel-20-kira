'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react'
import type { ActionResult } from '@/lib/dto'
import type { SpellingAnswerInput, SpellingResultDTO, SpellingRoundDTO } from '@/lib/dto-english'
import { Button, ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { useSpeech } from '@/components/learner/speech'
import { XpPill } from '@/components/learner/XpPill'
import { ActionError } from './common'

/**
 * Spelling Bee: dengar kata (suara dikte), dengar kalimat contohnya, lalu ketik ejaannya. Satu kali coba
 * ulang untuk setiap kata. Ejaan dicek ulang di server saat putaran selesai, dan XP dibatasi per hari.
 */

type Phase = 'asking' | 'second-try' | 'correct' | 'revealed'

type Done = { id: string; typed: string; tries: 1 | 2 }

function Letters({ word, tone }: { word: string; tone: 'ok' | 'show' }): ReactElement {
  return (
    <span className="inline-flex flex-wrap gap-1.5" aria-label={`Spelled: ${word.split('').join(', ')}`}>
      {word.split('').map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cx(
            'inline-flex h-12 w-10 items-center justify-center rounded-control border-2 font-display text-h1 font-bold',
            tone === 'ok' ? 'border-success bg-success-50' : 'border-border bg-surface',
          )}
        >
          {ch}
        </span>
      ))}
    </span>
  )
}

export function SpellingBeeScreen({
  data,
  finish,
}: {
  data: SpellingRoundDTO
  finish: (answers: SpellingAnswerInput[]) => Promise<ActionResult<SpellingResultDTO>>
}): ReactElement {
  const words = data.words
  const speech = useSpeech('en-GB')
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('asking')
  const [typed, setTyped] = useState('')
  /** Berapa kali kata ini salah dieja. Satu salah memberi satu kesempatan lagi. */
  const [misses, setMisses] = useState(0)
  const [done, setDone] = useState<Done[]>([])
  const [result, setResult] = useState<SpellingResultDTO | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<{ message: string; reference: string } | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const current = words[index]
  const finished = index >= words.length

  const sayWord = useCallback(() => {
    if (current) speech.speak([current.word], undefined, { style: 'dictation' })
  }, [current, speech])
  const saySentence = useCallback(() => {
    if (current) speech.speak([current.sentence], undefined, { style: 'dictation' })
  }, [current, speech])

  // Kata baru: bacakan dan fokuskan kotak ketik. Pemutaran otomatis boleh diblokir browser, tombolnya tetap ada.
  const sayWordRef = useRef(sayWord)
  useEffect(() => {
    sayWordRef.current = sayWord
  })
  useEffect(() => {
    if (finished) return
    setTyped('')
    setMisses(0)
    setPhase('asking')
    input.current?.focus()
    sayWordRef.current()
  }, [index, finished])

  const send = useCallback(
    async (list: Done[]) => {
      setSending(true)
      setError(null)
      const res = await finish(list)
      setSending(false)
      if (res.ok) setResult(res.data)
      else setError({ message: res.message, reference: res.reference })
    },
    [finish],
  )

  const next = useCallback(
    (entry: Done) => {
      const list = [...done, entry]
      setDone(list)
      if (index + 1 >= words.length) {
        setIndex(index + 1)
        void send(list)
      } else {
        setIndex(index + 1)
      }
    },
    [done, index, send, words.length],
  )

  const check = (e: FormEvent) => {
    e.preventDefault()
    if (!current || (phase !== 'asking' && phase !== 'second-try')) return
    const guess = typed.trim()
    if (!guess) return
    if (guess.toLowerCase() === current.word.toLowerCase()) {
      setPhase('correct')
      return
    }
    setMisses(misses + 1)
    setPhase(misses === 0 ? 'second-try' : 'revealed')
  }

  const goOn = () => {
    if (!current) return
    next({ id: current.id, typed: typed.trim(), tries: misses === 0 ? 1 : 2 })
  }

  const total = words.length
  const correctSoFar = done.filter((d) => d.typed.toLowerCase() === words.find((w) => w.id === d.id)?.word.toLowerCase()).length

  return (
    <LearnerFrame shell={data.shell} current="english" className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <ButtonLink href="/english" variant="quiet" icon="arrow-left" size="M">
          English Skills
        </ButtonLink>
        <h1 className="m-0 text-h1 font-bold">Spelling Bee</h1>
        <span className="ml-auto text-body-lg text-fg-muted tabular-nums">
          {finished ? `${total} of ${total} words` : `Word ${index + 1} of ${total}`}
        </span>
      </header>

      {!finished && current ? (
        <section aria-label="Spell the word" className="flex max-w-[640px] flex-col gap-5 rounded-card border border-divider bg-surface p-5 md:p-8">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" icon={speech.status === 'reading' ? 'waveform' : 'speaker'} onClick={sayWord} disabled={speech.status === 'unavailable'}>
              Hear the word
            </Button>
            <Button variant="secondary" icon="speaker" onClick={saySentence} disabled={speech.status === 'unavailable'}>
              Hear it in a sentence
            </Button>
          </div>
          {speech.status === 'unavailable' ? <p className="m-0 text-body text-fg-muted">No English voice on this device.</p> : null}

          {phase === 'correct' ? (
            <div className="flex flex-col gap-3" role="status">
              <p className="m-0 flex items-center gap-2 text-h3 font-bold">
                <UiIcon name="check-circle" size={26} className="text-success" />
                Yes, you spelled it right.
              </p>
              <Letters word={current.word} tone="ok" />
            </div>
          ) : phase === 'revealed' ? (
            <div className="flex flex-col gap-3" role="status">
              <p className="m-0 text-h3 font-bold">Here is how to spell it.</p>
              <Letters word={current.word} tone="show" />
              <p className="m-0 text-body-lg text-fg-muted">Look at the letters, then say them out loud.</p>
            </div>
          ) : (
            <form onSubmit={check} className="flex flex-col gap-3">
              <label htmlFor="bee-input" className="text-body-lg font-bold">
                Type the word you hear
              </label>
              <input
                id="bee-input"
                ref={input}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                maxLength={20}
                inputMode="text"
                className="h-16 rounded-control border-2 border-border bg-bg px-4 font-display text-h1 font-bold text-fg focus:border-fg focus:outline-none"
              />
              {phase === 'second-try' ? (
                <p className="m-0 flex items-center gap-2 text-body-lg" role="status">
                  <UiIcon name="not-yet" size={22} className="text-review" />
                  Not quite. Listen again and try once more.
                </p>
              ) : null}
              <Button type="submit" disabled={typed.trim() === ''} className="self-start">
                Check
              </Button>
            </form>
          )}

          {phase === 'correct' || phase === 'revealed' ? (
            <Button onClick={goOn} iconAfter="arrow-right" className="self-start">
              {index + 1 >= total ? 'See my score' : 'Next word'}
            </Button>
          ) : null}
        </section>
      ) : (
        <section aria-label="Your score" className="flex max-w-[640px] flex-col gap-4 rounded-card border border-divider bg-surface p-5 md:p-8">
          {sending ? (
            <p className="m-0 text-body-lg" role="status">
              Checking your words
            </p>
          ) : result ? (
            <>
              <h2 className="m-0 font-display text-h1 font-semibold">
                {result.correct} of {result.total} words spelled right
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <XpPill xp={result.xp} size="L" />
                {result.xp === 0 && result.xpLeftToday === 0 ? <span className="text-body text-fg-muted">You have collected all the Bee XP for today.</span> : null}
              </div>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {done.map((d) => {
                  const w = words.find((x) => x.id === d.id)
                  const ok = w ? d.typed.toLowerCase() === w.word.toLowerCase() : false
                  return (
                    <li key={d.id} className="flex items-center gap-2 text-body-lg">
                      <UiIcon name={ok ? 'check' : 'not-yet'} size={20} className={ok ? 'text-success' : 'text-review'} />
                      <span className="font-bold">{w?.word}</span>
                      {ok ? null : <span className="text-fg-muted">you typed {d.typed || 'nothing'}</span>}
                    </li>
                  )
                })}
              </ul>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/english/spelling" variant="primary" icon="refresh" prefetch={false}>
                  Play another round
                </ButtonLink>
                <ButtonLink href="/english" variant="secondary">
                  Back to English Skills
                </ButtonLink>
              </div>
            </>
          ) : error ? (
            <ActionError message={error.message} reference={error.reference}>
              <Button variant="secondary" size="M" onClick={() => void send(done)} className="mt-2 self-start">
                Try again
              </Button>
            </ActionError>
          ) : null}
          <p className="sr-only">{correctSoFar} correct so far</p>
        </section>
      )}
    </LearnerFrame>
  )
}
