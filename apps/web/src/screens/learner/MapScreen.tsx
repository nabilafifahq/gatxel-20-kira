'use client'

import { useState, type ReactElement } from 'react'
import type { MapDTO, MapSkillDTO, Subject } from '@/lib/dto'
import { Button, ButtonLink, IconLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { StarGlyph } from '@/components/learner/StreakChain'
import { SubjectIcon } from '@/components/learner/SubjectIcon'
import { SUBJECT_STYLE, subjectName } from '@/components/learner/subject'
import type { Dict } from '@/lib/i18n'
import { useT } from '@/lib/i18n/client'

/**
 * L09 Peta belajar (papan PetaBelajar). Bab per mapel dengan kartu skill dan bintang.
 * Status selalu tertulis: ikon, chip, dan kalimat di panel skill terpilih.
 */

function skillLine(s: MapSkillDTO, previous: MapSkillDTO | null, t: Dict): string {
  const m = t.shell.map
  const stars = t.shell.stars(s.stars)
  if (s.state === 'locked') return previous ? m.opensAfter(previous.title) : m.opensLater
  if (s.isToday) return m.lineToday(stars)
  if (s.state === 'mastered') return m.lineMastered
  if (s.state === 'review') return m.lineReview(stars)
  if (s.state === 'new') return m.lineNew
  return m.lineLearning(stars)
}

function skillCta(s: MapSkillDTO, t: Dict): { label: string; href: string | null } {
  const m = t.shell.map
  if (s.state === 'new') return { label: m.ctaLesson, href: s.lessonHref ?? s.practiseHref }
  if (s.isToday) return { label: m.ctaToday, href: s.practiseHref }
  if (s.state === 'mastered') return { label: m.ctaAgain, href: s.practiseHref }
  if (s.state === 'review') return { label: m.ctaReview, href: s.practiseHref }
  return { label: m.ctaPractise, href: s.practiseHref }
}

function SkillCard({ s, subject, selected, onSelect }: { s: MapSkillDTO; subject: Subject; selected: boolean; onSelect: () => void }): ReactElement {
  const t = useT()
  const style = SUBJECT_STYLE[subject]
  const locked = s.state === 'locked'
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${s.title}, ${s.isToday ? t.shell.map.inTodaySessions : t.shell.map.state[s.state]}, ${t.shell.stars(s.stars)}`}
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
      <span lang="en-GB" className="text-body leading-5.5 font-bold">{s.title}</span>
      <span className="mt-auto flex items-center gap-0.5">
        {[0, 1, 2].map((k) => (
          <StarGlyph key={k} filled={k < s.stars} size={18} />
        ))}
        {s.state === 'mastered' ? <UiIcon name="check-circle" size={20} strokeWidth={2.5} className="ml-auto text-success" /> : null}
        {locked ? <UiIcon name="lock" size={20} className="ml-auto" /> : null}
      </span>
      {s.isToday ? (
        <span className={cx('absolute -top-3.5 right-2 inline-flex h-7 items-center rounded-pill px-2.5 text-body font-bold text-white', 'bg-fg')}>{t.shell.nav.today}</span>
      ) : s.state === 'review' ? (
        <span className="absolute -top-3.5 right-2 inline-flex h-7 items-center rounded-pill bg-warn px-2.5 text-body font-bold text-white">{t.shell.nav.review}</span>
      ) : null}
    </button>
  )
}

export function MapScreen({ data }: { data: MapDTO }): ReactElement {
  const t = useT()
  const [subject, setSubject] = useState<Subject>(data.selectedSubject)
  const current = data.subjects.find((s) => s.subject === subject) ?? data.subjects[0]
  const flat = (current?.chapters ?? []).flatMap((c) => c.skills)
  const defaultSkill = (flat.find((s) => s.isToday) ?? flat.find((s) => s.state !== 'locked') ?? flat[0])?.id ?? null
  const [selectedId, setSelectedId] = useState<string | null>(defaultSkill)
  const selIndex = flat.findIndex((s) => s.id === selectedId)
  const sel = flat[selIndex >= 0 ? selIndex : 0] ?? null
  const previous = selIndex > 0 ? (flat[selIndex - 1] ?? null) : null

  const pickSubject = (s: Subject) => {
    setSubject(s)
    const list = (data.subjects.find((x) => x.subject === s)?.chapters ?? []).flatMap((c) => c.skills)
    setSelectedId((list.find((x) => x.isToday) ?? list.find((x) => x.state !== 'locked') ?? list[0])?.id ?? null)
  }

  return (
    <LearnerFrame shell={data.shell} current="map" className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col">
          <h1 className="m-0 text-h1 font-bold">{t.shell.map.title}</h1>
          <p className="m-0 text-body-lg text-fg-muted">{t.shell.map.subtitle(data.grade)}</p>
        </div>
        <div role="group" aria-label={t.shell.map.subject} className="flex flex-wrap gap-2 sm:ml-auto">
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
                {subjectName(s.subject, t)}
              </button>
            )
          })}
        </div>
      </header>

      {current && current.chapters.length > 0 ? (
        <div className="@container">
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 @lg:grid-cols-3 @3xl:grid-cols-6">
            {current.chapters.map((c, ci) => (
              <section key={c.title} aria-label={t.shell.map.chapter(ci + 1, c.title)} className="flex min-w-0 flex-col gap-3">
                <div className="flex min-h-11 items-start gap-2">
                  <span className={cx('inline-flex h-7 w-7 flex-none items-center justify-center rounded-pill text-body font-bold text-white', 'bg-fg')}>{ci + 1}</span>
                  <h2 lang="en-GB" className="m-0 min-w-0 text-body leading-5.5 font-bold [overflow-wrap:anywhere]">{c.title}</h2>
                </div>
                {c.skills.map((s) => (
                  <SkillCard key={s.id} s={s} subject={subject} selected={sel?.id === s.id} onSelect={() => setSelectedId(s.id)} />
                ))}
              </section>
            ))}
          </div>
        </div>
      ) : (
        <p className="m-0 rounded-card bg-surface shadow-soft p-6 text-body-lg">
          {t.shell.map.notReady(subjectName(subject, t), data.grade)}
        </p>
      )}

      {sel ? (
        <section
          aria-label={t.shell.map.selectedSkill}
          aria-live="polite"
          className="sticky bottom-[calc(84px+var(--safe-bottom))] z-10 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card bg-surface shadow-soft px-4 py-3 md:static md:px-5 md:py-4"
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <span lang="en-GB" className="text-h3 font-bold">{sel.title}</span>
            <span className="text-body text-fg-muted">{skillLine(sel, previous, t)}</span>
            {sel.state !== 'locked' && sel.canDo ? <span lang="en-GB" className="hidden text-body md:block">{sel.canDo}</span> : null}
          </div>
          {sel.state === 'locked' ? (
            <Button disabled icon="lock">
              {t.shell.map.locked}
            </Button>
          ) : (
            <div className="flex w-full items-center gap-3 md:w-auto">
              {sel.lessonHref && sel.state !== 'new' ? (
                <>
                  <IconLink href={sel.lessonHref} icon="book" label={t.shell.map.lessonOf(sel.title)} className="md:hidden" />
                  <span className="hidden md:inline-flex">
                    <ButtonLink href={sel.lessonHref} variant="quiet" icon="book">
                      {t.shell.map.lesson}
                    </ButtonLink>
                  </span>
                </>
              ) : null}
              {(() => {
                const cta = skillCta(sel, t)
                return cta.href ? (
                  <ButtonLink href={cta.href} iconAfter="arrow-right" className="min-w-0 flex-1 max-sm:h-auto max-sm:min-h-14 max-sm:whitespace-normal max-sm:px-3 max-sm:py-2 md:flex-none">
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
          {t.shell.map.legendMastered}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-5 w-5 rounded-control border-2 border-border bg-surface" />
          {t.shell.map.legendLearning}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-5 w-5 rounded-control border-2 border-warn bg-surface" />
          {t.shell.nav.review}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-5 w-5 rounded-control border-2 border-dashed border-border bg-bg" />
          {t.shell.map.locked}
        </span>
      </div>
    </LearnerFrame>
  )
}
