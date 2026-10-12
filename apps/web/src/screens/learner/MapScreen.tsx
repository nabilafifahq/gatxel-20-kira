'use client'

import { useState, type ReactElement } from 'react'
import type { MapDTO, MapSkillDTO, Subject } from '@/lib/dto'
import { Button, ButtonLink, IconLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { StarGlyph } from '@/components/learner/StreakChain'
import { SubjectIcon } from '@/components/learner/SubjectIcon'
import { SUBJECT_NAME, SUBJECT_STYLE } from '@/components/learner/subject'

/**
 * L09 Peta belajar (papan PetaBelajar). Bab per mapel dengan kartu skill dan bintang.
 * Status selalu tertulis: ikon, chip, dan kalimat di panel skill terpilih.
 */

const STATE_WORD: Record<MapSkillDTO['state'], string> = {
  locked: 'locked',
  new: 'new',
  learning: 'learning',
  review: 'needs review',
  mastered: 'mastered',
}

function skillLine(s: MapSkillDTO, previous: MapSkillDTO | null): string {
  const stars = `${s.stars} of 3 stars`
  if (s.state === 'locked') return previous ? `Opens after ${previous.title}.` : 'Opens later.'
  if (s.isToday) return `In today's quest, ${stars}.`
  if (s.state === 'mastered') return 'Mastered, 3 of 3 stars.'
  if (s.state === 'review') return `Time to review, ${stars}. A short review keeps the stars.`
  if (s.state === 'new') return 'New skill. Start with the lesson.'
  return `Learning, ${stars}.`
}

function skillCta(s: MapSkillDTO): { label: string; href: string | null } {
  if (s.state === 'new') return { label: 'See the lesson', href: s.lessonHref ?? s.practiseHref }
  if (s.isToday) return { label: "Start today's quest", href: s.practiseHref }
  if (s.state === 'mastered') return { label: 'Practise again', href: s.practiseHref }
  if (s.state === 'review') return { label: 'Review now', href: s.practiseHref }
  return { label: 'Practise', href: s.practiseHref }
}

function SkillCard({ s, subject, selected, onSelect }: { s: MapSkillDTO; subject: Subject; selected: boolean; onSelect: () => void }): ReactElement {
  const style = SUBJECT_STYLE[subject]
  const locked = s.state === 'locked'
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${s.title}, ${s.isToday ? "in today's quest" : STATE_WORD[s.state]}, ${s.stars} of 3 stars`}
      onClick={onSelect}
      className={cx(
        'relative flex min-h-26 w-full cursor-pointer flex-col items-stretch gap-2 rounded-control p-3 text-left',
        selected && 'outline-3 outline-offset-2 outline-fg',
        s.isToday
          ? cx('border-4', style.border, style.tint, 'text-fg')
          : locked
            ? 'border-2 border-dashed border-border bg-bg text-fg-muted'
            : s.state === 'review'
              ? 'border-2 border-warn bg-surface text-fg'
              : s.state === 'mastered'
                ? cx('border-2 bg-surface text-fg', style.border)
                : 'border-2 border-border bg-surface text-fg hover:border-fg',
      )}
    >
      <span className="text-body leading-5.5 font-bold">{s.title}</span>
      <span className="mt-auto flex items-center gap-0.5">
        {[0, 1, 2].map((k) => (
          <StarGlyph key={k} filled={k < s.stars} size={18} />
        ))}
        {s.state === 'mastered' ? <UiIcon name="check-circle" size={20} strokeWidth={2.5} className="ml-auto text-success" /> : null}
        {locked ? <UiIcon name="lock" size={20} className="ml-auto" /> : null}
      </span>
      {s.isToday ? (
        <span className={cx('absolute -top-3.5 right-2 inline-flex h-7 items-center rounded-pill px-2.5 text-body font-bold text-white', style.solid)}>Today</span>
      ) : s.state === 'review' ? (
        <span className="absolute -top-3.5 right-2 inline-flex h-7 items-center rounded-pill bg-warn px-2.5 text-body font-bold text-white">Review</span>
      ) : null}
    </button>
  )
}

export function MapScreen({ data }: { data: MapDTO }): ReactElement {
  const [subject, setSubject] = useState<Subject>(data.selectedSubject)
  const current = data.subjects.find((s) => s.subject === subject) ?? data.subjects[0]
  const flat = (current?.chapters ?? []).flatMap((c) => c.skills)
  const defaultSkill = (flat.find((s) => s.isToday) ?? flat.find((s) => s.state !== 'locked') ?? flat[0])?.id ?? null
  const [selectedId, setSelectedId] = useState<string | null>(defaultSkill)
  const selIndex = flat.findIndex((s) => s.id === selectedId)
  const sel = flat[selIndex >= 0 ? selIndex : 0] ?? null
  const previous = selIndex > 0 ? (flat[selIndex - 1] ?? null) : null
  const style = SUBJECT_STYLE[subject]

  const pickSubject = (s: Subject) => {
    setSubject(s)
    const list = (data.subjects.find((x) => x.subject === s)?.chapters ?? []).flatMap((c) => c.skills)
    setSelectedId((list.find((x) => x.isToday) ?? list.find((x) => x.state !== 'locked') ?? list[0])?.id ?? null)
  }

  return (
    <LearnerFrame shell={data.shell} current="map" className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col">
          <h1 className="m-0 text-h1 font-bold">Map</h1>
          <p className="m-0 text-body-lg text-fg-muted">Grade {data.grade} chapters and skills</p>
        </div>
        <div role="group" aria-label="Subject" className="flex flex-wrap gap-2 sm:ml-auto">
          {data.subjects.map((s) => {
            const on = s.subject === subject
            const st = SUBJECT_STYLE[s.subject]
            return (
              <button
                key={s.subject}
                type="button"
                aria-pressed={on}
                onClick={() => pickSubject(s.subject)}
                className={cx(
                  'inline-flex h-12 cursor-pointer items-center gap-1.5 rounded-pill border-2 pr-3 pl-2 text-body font-bold text-fg sm:gap-2 sm:pr-4 sm:pl-2.5',
                  on ? cx(st.border, st.tint) : 'border-border bg-surface hover:border-fg',
                )}
              >
                <SubjectIcon subject={s.subject} size={24} />
                {SUBJECT_NAME[s.subject]}
              </button>
            )
          })}
        </div>
      </header>

      {current && current.chapters.length > 0 ? (
        <div className="@container">
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 @lg:grid-cols-3 @3xl:grid-cols-6">
            {current.chapters.map((c, ci) => (
              <section key={c.title} aria-label={`Chapter ${ci + 1}, ${c.title}`} className="flex min-w-0 flex-col gap-3">
                <div className="flex min-h-11 items-start gap-2">
                  <span className={cx('inline-flex h-7 w-7 flex-none items-center justify-center rounded-pill text-body font-bold text-white', style.solid)}>{ci + 1}</span>
                  <h2 className="m-0 text-body leading-5.5 font-bold">{c.title}</h2>
                </div>
                {c.skills.map((s) => (
                  <SkillCard key={s.id} s={s} subject={subject} selected={sel?.id === s.id} onSelect={() => setSelectedId(s.id)} />
                ))}
              </section>
            ))}
          </div>
        </div>
      ) : (
        <p className="m-0 rounded-card border border-divider bg-surface p-6 text-body-lg">
          The {SUBJECT_NAME[subject]} map is not ready yet. Your tutor adds the chapters for Grade {data.grade}.
        </p>
      )}

      {sel ? (
        <section
          aria-label="Selected skill"
          aria-live="polite"
          className="sticky bottom-21 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-divider bg-surface px-4 py-3 md:static md:px-5 md:py-4"
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-h3 font-bold">{sel.title}</span>
            <span className="text-body text-fg-muted">{skillLine(sel, previous)}</span>
            {sel.state !== 'locked' && sel.canDo ? <span className="hidden text-body md:block">{sel.canDo}</span> : null}
          </div>
          {sel.state === 'locked' ? (
            <Button disabled icon="lock">
              Locked
            </Button>
          ) : (
            <div className="flex w-full items-center gap-3 md:w-auto">
              {sel.lessonHref && sel.state !== 'new' ? (
                <>
                  <IconLink href={sel.lessonHref} icon="book" label={`Lesson: ${sel.title}`} className="md:hidden" />
                  <span className="hidden md:inline-flex">
                    <ButtonLink href={sel.lessonHref} variant="quiet" icon="book">
                      Lesson
                    </ButtonLink>
                  </span>
                </>
              ) : null}
              {(() => {
                const cta = skillCta(sel)
                return cta.href ? (
                  <ButtonLink href={cta.href} iconAfter="arrow-right" className="min-w-0 flex-1 md:flex-none">
                    {cta.label}
                  </ButtonLink>
                ) : null
              })()}
            </div>
          )}
        </section>
      ) : null}

      <div aria-hidden="true" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-body font-semibold text-fg-muted">
        <span className="inline-flex items-center gap-2">
          <UiIcon name="check-circle" size={20} strokeWidth={2.5} className="text-success" />
          Mastered, 3 stars
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-5 w-5 rounded-control border-2 border-border bg-surface" />
          Learning
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-5 w-5 rounded-control border-2 border-warn bg-surface" />
          Review
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-5 w-5 rounded-control border-2 border-dashed border-border bg-bg" />
          Locked
        </span>
      </div>
    </LearnerFrame>
  )
}
