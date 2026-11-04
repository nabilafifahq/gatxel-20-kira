import Link from 'next/link'
import type { ReactElement } from 'react'
import { BookCover } from '@kira/figures'
import type { BookDetailDTO } from '@/lib/dto-reading'
import { ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { LearnerFrame } from '@/components/learner/LearnerHeader'

/** Satu buku: sampul, ringkasan, dan daftar bab dengan tanda bab yang sudah dibaca. */
export function BookDetailScreen({ data }: { data: BookDetailDTO }): ReactElement {
  const b = data.book
  return (
    <LearnerFrame shell={data.shell} current="reading" className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb">
        <Link href="/reading" className="inline-flex h-11 items-center gap-1.5 text-body font-bold text-fg no-underline">
          <UiIcon name="arrow-left" size={18} />
          Reading Room
        </Link>
      </nav>
      <header className="flex flex-col gap-5 md:flex-row md:items-center">
        <BookCover motif={b.cover.motif} tint={b.cover.tint} title={`Cover of ${b.title}`} className="h-52 w-40 flex-none" />
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="m-0 text-h1 font-bold">{b.title}</h1>
          <p className="m-0 text-body text-fg-muted">
            Grade {b.grade} level, {b.kind === 'story' ? 'story' : 'non-fiction'}, {b.genreLabel.toLowerCase()}. {b.chapterCount} chapters, about {b.minutes} minutes.
          </p>
          <p className="m-0 font-reading text-body-lg">{b.blurb}</p>
          <ButtonLink href={data.resumeHref} variant="primary" className="mt-2 w-full md:w-auto md:self-start">
            {b.status === 'finished' ? 'Read it again' : b.status === 'new' ? 'Start reading' : 'Carry on reading'}
          </ButtonLink>
          <p className="m-0 text-small text-fg-muted">{data.resumeLabel}</p>
        </div>
      </header>
      <section aria-labelledby="chapters" className="flex flex-col gap-3">
        <h2 id="chapters" className="m-0 text-h2 font-bold">
          Chapters
        </h2>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {data.chapters.map((c, i) => (
            <li key={c.id}>
              <Link
                href={c.href}
                aria-current={c.current ? 'step' : undefined}
                className={cx(
                  'flex min-h-14 items-center gap-3 rounded-control border-2 px-4 py-2 text-fg no-underline transition-transform duration-150 ease-kira active:scale-98',
                  c.current ? 'border-english bg-english-50' : 'border-border bg-surface hover:border-fg',
                )}
              >
                <span aria-hidden="true" className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-pill border-2 border-border text-body font-bold">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 text-body-lg font-bold">{c.title}</span>
                {c.done ? (
                  <span className="inline-flex items-center gap-1 text-small font-bold text-success">
                    <UiIcon name="check" size={16} strokeWidth={3} />
                    Read
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </LearnerFrame>
  )
}
