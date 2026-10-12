import type { ReactElement } from 'react'
import type { CorrectionBookDTO, Subject } from '@/lib/dto'
import { ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { plural } from '@/components/learner/format'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { LEARNER_ROUTES } from '@/components/learner/routes'
import { SUBJECT_NAME, SUBJECT_STYLE } from '@/components/learner/subject'

/**
 * L11 Buku Koreksi (papan BukuKoreksi, BukuKoreksiHP, BukuKoreksiKosong). Kartu review hari ini
 * dikelompokkan. DTO belum mengaitkan kartu ke kelompoknya: kartu dicocokkan lewat awalan
 * `meta` ("Fix it, ..."), dan bila tidak cocok dibagi berurutan sesuai `count` tiap kelompok.
 */

type Card = CorrectionBookDTO['cards'][number]
type Group = CorrectionBookDTO['groups'][number]

function groupCards(groups: Group[], cards: Card[]): { group: Group; cards: { card: Card; meta: string }[] }[] {
  const strip = (meta: string, title: string) => {
    const rest = meta.slice(title.length).replace(/^[,:\s]+/, '')
    return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : meta
  }
  const byPrefix = groups.map((g) => cards.filter((c) => c.meta.toLowerCase().startsWith(g.title.toLowerCase())))
  const matched = byPrefix.reduce((n, list) => n + list.length, 0)
  if (matched === cards.length) {
    return groups.map((g, i) => ({ group: g, cards: (byPrefix[i] ?? []).map((card) => ({ card, meta: strip(card.meta, g.title) })) }))
  }
  let at = 0
  return groups.map((g) => {
    const list = cards.slice(at, at + g.count)
    at += g.count
    return { group: g, cards: list.map((card) => ({ card, meta: card.meta })) }
  })
}

function SubjectTag({ subject }: { subject: Subject }): ReactElement {
  const style = SUBJECT_STYLE[subject]
  return (
    <span className={cx('inline-flex h-7 items-center self-start rounded-pill border px-2.5 text-body font-bold', style.tint, style.border)}>
      {SUBJECT_NAME[subject]}
    </span>
  )
}

export function CorrectionBookScreen({ data, todayHref = LEARNER_ROUTES.today }: { data: CorrectionBookDTO; todayHref?: string }): ReactElement {
  const empty = data.dueCount === 0 || data.cards.length === 0
  const grouped = empty ? [] : groupCards(data.groups, data.cards)
  return (
    <LearnerFrame shell={data.shell} current="review" className="flex flex-col gap-4 md:gap-6">
      <header className="flex flex-wrap items-center gap-4 md:gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="m-0 text-h1 font-bold">Review</h1>
          {empty ? null : <p className="m-0 text-body-lg text-fg-muted">{plural(data.dueCount, 'card', 'cards')} today.</p>}
        </div>
        {!empty && data.startHref ? (
          <ButtonLink href={data.startHref} iconAfter="arrow-right" className="w-full px-6.5 md:w-auto">
            Start review
          </ButtonLink>
        ) : null}
      </header>

      {empty ? (
        <section role="status" className="flex flex-1 flex-col items-center justify-center gap-3.5 rounded-card border-2 border-dashed border-border bg-surface px-6 py-10 text-center md:p-10">
          <span aria-hidden="true" className="flex h-24 w-30 items-end justify-center">
            <span className="relative h-18 w-24">
              <span className="absolute top-0 left-3 h-16 w-20 rounded-control border-2 border-border bg-bg" />
              <span className="absolute top-2 left-0 flex h-16 w-20 items-center justify-center rounded-control border-2 border-fg bg-surface">
                <UiIcon name="check" size={32} strokeWidth={2.5} className="text-success" />
              </span>
            </span>
          </span>
          <p className="m-0 text-h2 font-bold">No review cards today.</p>
          <p className="m-0 max-w-[520px] text-body-lg text-fg-muted">
            {data.comingBack ? `${data.comingBack} ` : ''}Questions you miss in quests will show up here too.
          </p>
          <ButtonLink href={todayHref} iconAfter="arrow-right" className="mt-1.5">
            Back to Today
          </ButtonLink>
        </section>
      ) : (
        <>
          <div className="flex flex-col gap-4 md:gap-5 lg:flex-row">
            {grouped.map(({ group, cards }) => (
              <section
                key={`${group.subject}-${group.title}`}
                aria-label={`${group.title}, ${plural(cards.length, 'card', 'cards')}`}
                className="flex min-w-0 flex-1 flex-col gap-3.5 rounded-card border border-divider bg-surface p-4 md:p-5.5"
              >
                <div className="flex items-center gap-2.5">
                  <h2 className="m-0 text-h3 font-bold md:text-h2">{group.title}</h2>
                  <span className="ml-auto inline-flex h-8 min-w-9 items-center justify-center rounded-pill bg-fg px-2.5 text-body font-bold text-white tabular-nums">
                    {group.count}
                  </span>
                </div>
                <p className="m-0 text-body text-fg-muted">{group.note}</p>
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {cards.map(({ card, meta }, i) => {
                    const short = card.prompt.length <= 14
                    return (
                      <li key={`${card.prompt}-${i}`} className="flex flex-col gap-1.5 rounded-control border-2 border-border bg-surface px-3.5 py-3">
                        <SubjectTag subject={card.subject} />
                        <p className={cx('m-0 font-reading', short ? 'text-h1' : 'text-body-lg')}>{card.prompt}</p>
                        <span className="text-body text-fg-muted">{meta}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
          {data.comingBack ? (
            <p className="m-0 flex items-center gap-2.5 text-body-lg font-semibold">
              <UiIcon name="refresh" size={22} className="flex-none" />
              {data.comingBack}
            </p>
          ) : null}
        </>
      )}
    </LearnerFrame>
  )
}
