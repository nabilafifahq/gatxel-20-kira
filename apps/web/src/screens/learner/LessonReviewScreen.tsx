'use client'

import Link from 'next/link'
import type { ReactElement } from 'react'
import type { ReviewDTO, ReviewListDTO } from '@/server/dal/lesson-review'
import { ButtonLink } from '@/components/ui/Button'
import { LearnerFrame, LearnerHeader } from '@/components/learner/LearnerHeader'
import { ReadAloudButton } from '@/components/learner/ReadAloudButton'

/** Ulasan singkat pelajaran yang sudah selesai: daftar per mapel, langkah inti dengan baca suara, lalu 3 soal cepat. */

export function LessonReviewListScreen({ data }: { data: ReviewListDTO }): ReactElement {
  return (
    <LearnerFrame shell={data.shell} current="practice" className="flex flex-col gap-6">
      <LearnerHeader shell={data.shell} title="Quick review" subline="Open any lesson you finished and refresh it in a minute or two." />
      <Link href="/practice" className="w-fit text-body font-bold text-fg underline underline-offset-3">
        Back to practice
      </Link>
      {data.groups.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="m-0 text-body-lg text-fg-muted">Finish a lesson on the Map and it will show up here.</p>
          <ButtonLink href="/map" iconAfter="arrow-right">
            Open the Map
          </ButtonLink>
        </div>
      ) : null}
      {data.groups.map((g) => (
        <section key={g.subject} aria-labelledby={`rv-${g.subject}`} className="flex flex-col gap-3">
          <h2 id={`rv-${g.subject}`} className="m-0 text-h2 font-bold">
            {g.label}
          </h2>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {g.lessons.map((l) => (
              <li key={l.skillId}>
                <Link
                  href={`/practice/review/${l.skillId}`}
                  className="flex min-h-24 h-full flex-col justify-center gap-1 rounded-card border-2 border-border bg-surface p-4 text-fg no-underline transition-transform duration-150 ease-kira hover:border-fg active:scale-98"
                >
                  <span className="text-h3 font-bold">{l.title}</span>
                  <span className="text-body text-fg-muted">{l.strand}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </LearnerFrame>
  )
}

export function LessonReviewScreen({ data }: { data: ReviewDTO }): ReactElement {
  return (
    <LearnerFrame shell={data.shell} current="practice" className="flex max-w-[760px] flex-col gap-5">
      <LearnerHeader shell={data.shell} title={data.title} subline="Quick review: the key steps, then 3 questions." />
      <Link href="/practice/review" className="w-fit text-body font-bold text-fg underline underline-offset-3">
        All finished lessons
      </Link>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {data.steps.map((s, i) => (
          <li key={i} className="flex flex-col gap-2 rounded-card border border-divider bg-surface p-4">
            <p className="m-0 text-body-lg">{s.say}</p>
            {s.show ? <p className="m-0 text-h3 font-bold break-words">{s.show}</p> : null}
          </li>
        ))}
      </ol>
      <ReadAloudButton text={data.steps.map((s) => s.say)} subject={data.subject} showNote={false} />
      <div className="flex flex-wrap gap-3">
        <ButtonLink href={`/practice/review/${data.skillId}/start`} prefetch={false}>
          Try 3 questions
        </ButtonLink>
        <ButtonLink href={data.lessonHref} variant="secondary">
          Open the full lesson
        </ButtonLink>
      </div>
    </LearnerFrame>
  )
}
