import type { ReactElement } from 'react'
import type { EnglishCardArea, EnglishCardDTO, EnglishSkillsDTO } from '@/lib/dto-english'
import { ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon, type UiIconName } from '@/components/ui/icons'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { SUBJECT_STYLE } from '@/components/learner/subject'

/**
 * English Skills (rencana bagian 12): empat keterampilan Cambridge Young Learners (listening, speaking, writing,
 * reading) ditambah Spelling Bee. Tingkat learner (Starters, Movers, atau Flyers) mengikuti kelasnya.
 */

const ICON: Record<EnglishCardArea, UiIconName> = {
  listening: 'speaker',
  speaking: 'mic',
  writing: 'pencil',
  spelling: 'star',
  reading: 'book',
}

function Card({ card }: { card: EnglishCardDTO }): ReactElement {
  const style = SUBJECT_STYLE.english
  return (
    <li className="flex flex-col gap-3 rounded-card border border-divider bg-surface p-6">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={cx('flex h-12 w-12 flex-none items-center justify-center rounded-control', style.tint, style.text)}>
          <UiIcon name={ICON[card.area]} size={28} />
        </span>
        <h2 className="m-0 text-h3 font-bold">{card.title}</h2>
      </div>
      <p className="m-0 text-body-lg">{card.blurb}</p>
      <p className="m-0 text-body text-fg-muted">{card.detail}</p>
      {card.progress ? (
        <p className="m-0 inline-flex items-center gap-1.5 text-body font-bold">
          <UiIcon name="check" size={16} strokeWidth={3} className="text-success" />
          {card.progress}
        </p>
      ) : null}
      {card.unavailable ? (
        <p className="m-0 mt-auto rounded-control border-2 border-dashed border-border px-4 py-3 text-body text-fg-muted">Nothing here for your grade yet. Your tutor is adding more.</p>
      ) : (
        <ButtonLink href={card.href} variant="primary" className="mt-auto w-full">
          {card.cta}
        </ButtonLink>
      )}
    </li>
  )
}

export function EnglishSkillsScreen({ data }: { data: EnglishSkillsDTO }): ReactElement {
  return (
    <LearnerFrame shell={data.shell} current="english" className="flex flex-col gap-6 md:gap-7">
      <header className="flex flex-col gap-1.5">
        <h1 className="m-0 text-h1 font-bold">English Skills</h1>
        <p className="m-0 text-body-lg text-fg-muted">
          Listen, speak, write and spell. You are working at {data.levelName} level ({data.cefr}).
        </p>
      </header>

      <section aria-label="Cambridge Young Learners levels">
        <ol className="m-0 flex list-none flex-wrap gap-3 p-0">
          {data.ladder.map((l) => (
            <li
              key={l.name}
              aria-current={l.current ? 'step' : undefined}
              className={cx(
                'flex min-w-40 flex-col rounded-control border-2 px-4 py-2.5',
                l.current ? 'border-fg bg-surface font-bold' : 'border-divider bg-bg text-fg-muted',
              )}
            >
              <span className="text-body-lg">{l.name}</span>
              <span className="text-body">
                {l.cefr}, {l.grades.toLowerCase()}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="@container">
        <ul className="m-0 grid list-none grid-cols-1 items-stretch gap-5 p-0 @xl:grid-cols-2 @4xl:grid-cols-3">
          {data.cards.map((c) => (
            <Card key={c.area} card={c} />
          ))}
        </ul>
      </div>
    </LearnerFrame>
  )
}
