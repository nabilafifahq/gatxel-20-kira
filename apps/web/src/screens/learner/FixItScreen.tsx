import type { ReactElement } from 'react'
import type { FixItDTO } from '@/lib/dto-paper'
import { ButtonLink } from '@/components/ui/Button'
import { UiIcon } from '@/components/ui/icons'
import { plural } from '@/components/learner/format'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { LEARNER_ROUTES } from '@/components/learner/routes'

/**
 * Fix-it Book (Buku Salah). Soal Tes dan Paper yang belum benar dikumpulkan di sini. Setiap Sabtu
 * Syakira mengerjakannya lagi dalam satu sesi pendek dengan umpan balik. Hanya ketuk, tanpa tarik.
 */

export function FixItScreen({ data }: { data: FixItDTO }): ReactElement {
  return (
    <LearnerFrame shell={data.shell} current="review" className="flex flex-col gap-4 md:gap-6">
      <header className="flex flex-wrap items-center gap-4 md:gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="m-0 text-h1 font-bold">Fix-it Book</h1>
          <p className="m-0 text-body-lg text-fg-muted">
            {data.canStart
              ? `${plural(data.open, 'question', 'questions')} from tests and papers to try again.`
              : 'Questions you miss in tests and papers wait here until you get them right.'}
          </p>
        </div>
        {data.canStart ? (
          <ButtonLink href={LEARNER_ROUTES.fixItStart} prefetch={false} iconAfter="arrow-right" className="w-full px-6.5 md:w-auto">
            {data.saturday ? 'Start Saturday fix-it' : 'Fix some now'}
          </ButtonLink>
        ) : null}
      </header>

      {data.canStart ? (
        <section aria-label="What is waiting" className="flex flex-col gap-3.5 rounded-card border border-divider bg-surface p-4 md:p-5.5">
          <p className="m-0 text-body-lg">
            Each session has up to {data.sessionSize} questions. You get hints and feedback, so this is the time to learn from them.
          </p>
          <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
            {data.bySubject.map((g) => (
              <li key={g.subject} className="inline-flex h-9 items-center rounded-pill border-2 border-border bg-surface px-3.5 text-body font-bold">
                {g.label}: {g.count}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section role="status" className="flex flex-1 flex-col items-center justify-center gap-3.5 rounded-card border-2 border-dashed border-border bg-surface px-6 py-10 text-center md:p-10">
          <UiIcon name="check" size={32} strokeWidth={2.5} className="text-success" />
          <p className="m-0 text-h2 font-bold">Nothing to fix.</p>
          <p className="m-0 max-w-[520px] text-body-lg text-fg-muted">When a test or paper question does not go right, it comes here so you can try it again on Saturday.</p>
          <ButtonLink href={LEARNER_ROUTES.today} iconAfter="arrow-right" className="mt-1.5">
            Back to Today
          </ButtonLink>
        </section>
      )}
    </LearnerFrame>
  )
}

/** Kartu kecil untuk layar lain (Review, Today): jumlah soal dan tautan ke Fix-it Book. */
export function FixItCard({ open, saturday }: { open: number; saturday: boolean }): ReactElement | null {
  if (open === 0) return null
  return (
    <section aria-label="Fix-it Book" className="flex flex-wrap items-center gap-3.5 rounded-card border-2 border-fg bg-surface p-4 md:p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="m-0 text-h3 font-bold">Fix-it Book</h2>
        <p className="m-0 text-body text-fg-muted">
          {plural(open, 'question', 'questions')} to try again{saturday ? '. Saturday is fix-it day.' : '.'}
        </p>
      </div>
      <ButtonLink href={LEARNER_ROUTES.fixIt} prefetch={false} iconAfter="arrow-right">
        Open Fix-it Book
      </ButtonLink>
    </section>
  )
}
