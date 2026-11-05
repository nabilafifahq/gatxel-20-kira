'use client'

import Link from 'next/link'
import type { ReactElement } from 'react'
import type { ReviewDTO, ReviewListDTO } from '@/server/dal/lesson-review'
import { ButtonLink } from '@/components/ui/Button'
import { LearnerFrame, LearnerHeader } from '@/components/learner/LearnerHeader'
import { TranslateToggle, useExplainLang } from '@/components/learner/explain-lang'
import { ReadAloudButton } from '@/components/learner/ReadAloudButton'
import { useT } from '@/lib/i18n/client'

/** Ulasan singkat pelajaran yang sudah selesai: daftar per mapel, langkah inti dengan baca suara, lalu 3 soal cepat. */

export function LessonReviewListScreen({ data }: { data: ReviewListDTO }): ReactElement {
  const dict = useT()
  const t = dict.runner.review
  return (
    <LearnerFrame shell={data.shell} current="practice" className="flex flex-col gap-6">
      <LearnerHeader shell={data.shell} title={t.listTitle} subline={t.listSubline} />
      <Link href="/practice" className="w-fit text-body font-bold text-fg underline underline-offset-3">
        {t.backToPractice}
      </Link>
      {data.groups.length === 0 ? <p className="m-0 text-body-lg text-fg-muted">{t.empty}</p> : null}
      {data.groups.map((g) => (
        <section key={g.subject} aria-labelledby={`rv-${g.subject}`} className="flex flex-col gap-3">
          <h2 id={`rv-${g.subject}`} className="m-0 text-h2 font-bold">
            {dict.common.subject[g.subject]}
          </h2>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {g.lessons.map((l) => (
              <li key={l.skillId}>
                <Link
                  href={`/practice/review/${l.skillId}`}
                  className="flex min-h-24 h-full flex-col justify-center gap-1 rounded-card border-2 border-border bg-surface p-4 text-fg no-underline transition-transform duration-150 ease-kira hover:border-fg active:scale-98"
                >
                  <span lang="en-GB" className="text-h3 font-bold">{l.title}</span>
                  <span lang="en-GB" className="text-body text-fg-muted">{l.strand}</span>
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
  const t = useT().runner.review
  const explain = useExplainLang()
  const translated = data.steps.flatMap((s) => (s.sayId ? [s.sayId] : []))
  const showId = explain.on && translated.length > 0
  return (
    <LearnerFrame shell={data.shell} current="practice" className="flex max-w-[760px] flex-col gap-5">
      <LearnerHeader shell={data.shell} title={<span lang="en-GB">{data.title}</span>} subline={t.subline} />
      <Link href="/practice/review" className="w-fit text-body font-bold text-fg underline underline-offset-3">
        {t.allFinished}
      </Link>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {data.steps.map((s, i) => (
          <li key={i} className="flex flex-col gap-2 rounded-card border border-divider bg-surface p-4">
            <p lang={showId && s.sayId ? 'id' : 'en-GB'} className="m-0 text-body-lg">{(showId ? s.sayId : null) ?? s.say}</p>
            {showId && s.sayId ? <ReadAloudButton text={s.sayId} lang="id" subject={data.subject} showNote={false} compact className="self-start" /> : null}
            {s.show ? <p lang="en-GB" className="m-0 text-h3 font-bold break-words">{s.show}</p> : null}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2.5">
        {showId ? null : <ReadAloudButton text={data.steps.map((s) => s.say)} subject={data.subject} showNote={false} />}
        <TranslateToggle available={translated.length > 0} />
      </div>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href={`/practice/review/${data.skillId}/start`} prefetch={false}>
          {t.tryQuestions}
        </ButtonLink>
        <ButtonLink href={data.lessonHref} variant="secondary">
          {t.openLesson}
        </ButtonLink>
      </div>
    </LearnerFrame>
  )
}
