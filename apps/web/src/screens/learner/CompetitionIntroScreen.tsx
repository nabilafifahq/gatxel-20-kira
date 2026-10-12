'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactElement } from 'react'
import type { CompetitionActions, CompetitionIntroDTO } from '@/lib/dto'
import { Button, IconLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { LEARNER_ROUTES } from '@/components/learner/routes'
import { formatClock } from '@/components/learner/Timer'
import { ActionError } from './common'

/**
 * L13 Instruksi lomba (papan SimulatorInstruksi, SimulatorBelumVerifikasi). Aturan dibaca dulu,
 * lalu startSimulation membuat attempt dan mengarahkan ke runner simulasi.
 */

const SAMPLE = [2, 1, 2, 2]

export function CompetitionIntroScreen({
  data,
  actions,
  backHref = LEARNER_ROUTES.competitions,
}: {
  data: CompetitionIntroDTO
  actions: CompetitionActions
  backHref?: string
}): ReactElement {
  const router = useRouter()
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'going' } | { kind: 'error'; message: string; reference: string }>({ kind: 'idle' })
  const name = data.title.replace(/\s+practice$/i, '')
  const busy = state.kind === 'busy' || state.kind === 'going'

  const start = async () => {
    if (busy) return
    setState({ kind: 'busy' })
    try {
      const res = await actions.startSimulation(data.presetId)
      if (res.ok) {
        setState({ kind: 'going' })
        router.push(res.data.redirectTo)
      } else setState({ kind: 'error', message: res.message, reference: res.reference })
    } catch {
      setState({ kind: 'error', message: 'The practice could not start. Check the internet and try again.', reference: 'KRA-SIM-NET' })
    }
  }

  return (
    <div data-jenjang={data.shell.jenjang} className="flex min-h-svh flex-col bg-bg text-fg">
      <header className="flex min-h-18 flex-none items-center gap-4 px-4 py-2 md:h-22 md:px-8 md:py-0">
        <IconLink href={backHref} icon="arrow-left" label="Back to competition practice" />
        <div className="flex min-w-0 flex-col">
          <h1 className="m-0 text-h3 font-bold">{data.title}</h1>
          <span className="text-body text-fg-muted">{data.sub}</span>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-4 pb-8 md:px-8 lg:flex-row">
        <section aria-labelledby="how-it-works" className="flex min-w-0 flex-col gap-4 rounded-card border border-divider bg-surface p-5 md:p-7 lg:flex-[1.35]">
          {data.verified ? null : (
            <div role="note" className="flex items-start gap-2.5 rounded-control border-2 border-warn bg-surface px-4 py-3.5">
              <UiIcon name="warning" size={24} className="mt-0.5 flex-none text-warn" />
              <span className="text-body-lg font-semibold">
                Your tutor is still checking these rules. This practice may be a little different from the real {name}, and the score is not counted.
              </span>
            </div>
          )}
          <h2 id="how-it-works" className="m-0 text-h2 font-bold">
            How it works
          </h2>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {data.rules.map((r, i) => (
              <li key={r} className="flex items-start gap-3.5">
                <span className="mt-0.5 inline-flex h-7.5 min-w-9 flex-none items-center justify-center rounded-pill bg-fg px-2.5 text-body font-bold text-white">{i + 1}</span>
                <span className="font-reading text-h3 font-normal">{r}</span>
              </li>
            ))}
          </ol>
          {data.tip ? (
            <div className="flex items-start gap-2.5 rounded-control border border-divider bg-bg px-3.5 py-3">
              <UiIcon name="hint" size={22} className="mt-1 flex-none" />
              <div className="flex flex-col">
                <span className="text-body font-bold">Tip</span>
                <span className="font-reading text-body-lg">{data.tip}</span>
              </div>
            </div>
          ) : null}
        </section>

        <aside aria-label="Ready" className="flex min-w-0 flex-col items-center gap-4 rounded-card border border-divider bg-surface p-5 text-center md:p-7 lg:flex-1">
          <div aria-hidden="true" className="flex w-55 flex-col gap-2 rounded-control border-2 border-fg bg-surface px-4 py-3.5">
            <span className="text-left text-small font-bold">Answer sheet</span>
            {SAMPLE.map((filled, row) => (
              <div key={row} className="flex items-center gap-1.5">
                <span className="w-4.5 text-right text-small font-bold">{row + 1}</span>
                {Array.from({ length: data.optionCount }, (_, k) => (
                  <span key={k} className={cx('h-4.5 w-4.5 rounded-pill border-2 border-fg', k === filled ? 'bg-fg' : 'bg-surface')} />
                ))}
              </div>
            ))}
          </div>
          <div className="inline-flex h-14 items-center gap-2.5 rounded-control border-2 border-border bg-surface px-4.5">
            <UiIcon name="clock" size={24} />
            <span className="font-display text-h1 font-semibold tabular-nums">{data.timeLimitSec > 0 ? formatClock(data.timeLimitSec) : 'No clock'}</span>
          </div>
          <p className="m-0 text-body-lg">
            {data.questionCount} questions.{' '}
            {data.verified ? 'Find a quiet place and a pencil for working out.' : 'You can still practise. Your tutor will tell you when the real rules are ready.'}
          </p>
          {state.kind === 'error' ? <ActionError message={state.message} reference={state.reference} className="self-stretch text-left" /> : null}
          <Button
            variant={data.verified ? 'primary' : 'secondary'}
            iconAfter="arrow-right"
            loading={busy}
            onClick={() => void start()}
            className="mt-auto self-stretch"
          >
            {data.startLabel}
          </Button>
        </aside>
      </div>
    </div>
  )
}
