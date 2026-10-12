import type { ReactElement } from 'react'
import type { CompetitionPickDTO } from '@/lib/dto'
import { ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { LearnerFrame } from '@/components/learner/LearnerHeader'

/**
 * L13 Simulator lomba, pilih (papan SimulatorPilih). Satu kartu per preset lomba.
 * Preset yang aturannya belum diperiksa tutor bergaris putus-putus dan tombolnya sekunder.
 */

export function CompetitionPickScreen({ data }: { data: CompetitionPickDTO }): ReactElement {
  return (
    <LearnerFrame shell={data.shell} current={null} className="flex flex-col gap-6 md:gap-7">
      <header className="flex flex-col gap-1.5">
        <h1 className="m-0 text-h1 font-bold">Competition practice</h1>
        <p className="m-0 text-body-lg text-fg-muted">Practise like the real day. No hints, and the clock keeps going.</p>
      </header>
      {data.presets.length === 0 ? (
        <p className="m-0 rounded-card border-2 border-dashed border-border bg-surface p-8 text-center text-body-lg">
          No competitions to practise yet. Your tutor adds them when a competition is coming up.
        </p>
      ) : (
        <div className="@container">
        <ul className="m-0 grid list-none grid-cols-1 items-stretch gap-5 p-0 @xl:grid-cols-2 @4xl:grid-cols-3">
          {data.presets.map((p) => (
            <li
              key={p.presetId}
              className={cx(
                'flex flex-col gap-3.5 rounded-card bg-surface p-6',
                p.verified ? 'border border-divider' : 'border-2 border-dashed border-border',
              )}
            >
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="flex h-11 w-11 flex-none items-center justify-center rounded-control border-2 border-fg bg-bg">
                  <UiIcon name="trophy" size={26} />
                </span>
                <h2 className="m-0 text-h3 font-bold">{p.title}</h2>
              </div>
              {p.verified ? (
                <span className="inline-flex h-7.5 items-center gap-1.5 self-start rounded-pill border border-success bg-success-50 px-3 text-body font-bold">
                  <UiIcon name="check" size={16} strokeWidth={3} className="text-success" />
                  Ready
                </span>
              ) : (
                <span className="inline-flex h-7.5 items-center gap-1.5 self-start rounded-pill border-2 border-warn bg-surface px-3 text-body font-bold">
                  <UiIcon name="warning" size={16} className="text-warn" />
                  Rules not checked yet
                </span>
              )}
              <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body-lg">
                <li>{p.subjectLine}</li>
                {p.formatLines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <span className="text-body text-fg-muted">
                {p.lastTry ? `Last try: ${p.lastTry}` : p.verified ? 'Not tried yet' : 'Your tutor is checking this one'}
              </span>
              <ButtonLink href={p.href} variant={p.verified ? 'primary' : 'secondary'} className="mt-auto w-full">
                {p.verified ? 'Choose' : 'Have a look'}
              </ButtonLink>
            </li>
          ))}
        </ul>
        </div>
      )}
    </LearnerFrame>
  )
}
