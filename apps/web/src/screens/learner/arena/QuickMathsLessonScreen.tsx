'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactElement } from 'react'
import type { QmActions, QmLessonDTO } from '@/lib/dto-arena'
import { Button, ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { ActionError } from '@/screens/learner/common'

/** Pelajaran strategi singkat: tiga kartu, lalu lima soal latihan yang diperiksa server. */
export function QuickMathsLessonScreen({ data, actions }: { data: QmLessonDTO; actions: Pick<QmActions, 'start'> }): ReactElement {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; reference: string } | null>(null)
  const card = data.cards[step]
  const last = step === data.cards.length - 1

  const tryIt = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await actions.start({
        mode: 'practice',
        op: 'add',
        digits: 'mixed',
        carry: true,
        auto: false,
        table: 2,
        division: false,
        flashLevel: null,
        sorobanStage: 'read',
        sorobanLevel: null,
        focus: data.id,
        mission: null,
      })
      if (res.ok) router.push(res.data.redirectTo)
      else setError({ message: res.message, reference: res.reference })
    } catch {
      setError({ message: 'The practice could not start. Check the internet and try again.', reference: 'KRA-QM-NET' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <LearnerFrame shell={data.shell} current="quick-maths" className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb">
        <ButtonLink href={data.backHref} variant="quiet" size="M" icon="arrow-left">
          Quick Maths
        </ButtonLink>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-h1 font-bold">{data.title}</h1>
        <p className="m-0 text-body-lg text-fg-muted">{data.summary}</p>
        {data.done ? <p className="m-0 text-body font-bold text-success">You have finished this lesson.</p> : null}
      </header>

      {card ? (
        <section aria-label={`Step ${step + 1} of ${data.cards.length}`} className="flex max-w-[720px] flex-col gap-4 rounded-card border border-divider bg-surface p-6">
          <p className="m-0 text-body font-bold text-mental">
            Step {step + 1} of {data.cards.length}
          </p>
          <h2 className="m-0 text-h2 font-bold">{card.title}</h2>
          <p className="text-question m-0">{card.text}</p>
          {card.example ? (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {card.example.map((e) => (
                <li key={e} className="rounded-control border-2 border-mental bg-mental-50 px-4 py-2 font-display text-h2 font-semibold tabular-nums">
                  {e}
                </li>
              ))}
            </ul>
          ) : null}
          <ol aria-hidden="true" className="m-0 flex list-none gap-2 p-0">
            {data.cards.map((_, i) => (
              <li key={i} className={cx('h-2 flex-1 rounded-pill', i <= step ? 'bg-mental' : 'bg-divider')} />
            ))}
          </ol>
          <div className="flex flex-wrap gap-3">
            {step > 0 ? (
              <Button variant="secondary" icon="arrow-left" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            ) : null}
            {!last ? (
              <Button iconAfter="arrow-right" onClick={() => setStep(step + 1)}>
                Next
              </Button>
            ) : (
              <Button iconAfter="arrow-right" loading={busy} onClick={() => void tryIt()}>
                Try it: 5 questions
              </Button>
            )}
          </div>
          {error ? <ActionError message={error.message} reference={error.reference} /> : null}
        </section>
      ) : null}

      {data.nextHref ? (
        <ButtonLink href={data.nextHref} variant="quiet" size="M" iconAfter="arrow-right" className="self-start">
          Next lesson
        </ButtonLink>
      ) : null}
    </LearnerFrame>
  )
}
