import Link from 'next/link'
import type { ReactElement } from 'react'
import type { QuestStopDTO } from '@/lib/dto'
import { ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { SubjectChip } from './SubjectChip'
import { SubjectIcon } from './SubjectIcon'
import { SUBJECT_NAME, SUBJECT_STYLE } from './subject'

/**
 * Perhentian quest di jalur Today (papan QuestStop). Cap persegi membulat bergaris tinta.
 * Quest aktif dua kali lebih besar (144 px) dengan judul, chip, keterangan, dan tombol.
 * Status selalu tertulis sebagai teks di samping cap.
 */

const STATE_WORD: Record<QuestStopDTO['state'], string> = {
  locked: 'locked',
  ready: 'ready',
  'in-progress': 'in progress',
  done: 'done',
  rest: 'rest day',
}

function progressPct(stop: QuestStopDTO): number {
  if (stop.total <= 0) return 0
  return Math.round((Math.min(stop.answered, stop.total) / stop.total) * 100)
}

/** Ukuran cap: L 72 px, S 56 px, auto 56 px di HP dan 72 px mulai md. */
export type StampSize = 'L' | 'S' | 'auto'

const STAMP_BOX: Record<StampSize, string> = {
  L: 'h-18 w-18 rounded-card',
  S: 'h-14 w-14 rounded-control',
  auto: 'h-14 w-14 rounded-control md:h-18 md:w-18 md:rounded-card',
}

/** Kelas ukuran ikon per ukuran cap. Ditulis utuh supaya terbaca pemindai Tailwind. */
function iconClass(size: StampSize, small: string, large: string, auto: string): string {
  return size === 'L' ? large : size === 'S' ? small : auto
}

/** Cap kecil 72 px (atau 56 px di HP). */
export function QuestStamp({ stop, size = 'L' }: { stop: QuestStopDTO; size?: StampSize }): ReactElement {
  const style = SUBJECT_STYLE[stop.subject]
  const bonus = stop.subject === 'bonus'
  const box = cx('flex flex-none flex-col items-center justify-center gap-1', STAMP_BOX[size])
  switch (stop.state) {
    case 'locked':
      return (
        <span className={cx(box, 'border-2 border-dashed border-border bg-bg text-fg-muted')}>
          <UiIcon name="lock" size={28} className={iconClass(size, 'h-6 w-6', 'h-7 w-7', 'h-6 w-6 md:h-7 md:w-7')} />
        </span>
      )
    case 'rest':
      return (
        <span className={cx(box, 'border-2 border-divider bg-bg text-fg-muted')}>
          <UiIcon name="moon" size={28} className={iconClass(size, 'h-6 w-6', 'h-7 w-7', 'h-6 w-6 md:h-7 md:w-7')} />
        </span>
      )
    case 'done':
      return (
        <span className={cx(box, 'border-2 border-fg', style.solid, bonus ? 'text-fg' : 'text-white')}>
          <UiIcon name="check" size={36} className={iconClass(size, 'h-7.5 w-7.5', 'h-9 w-9', 'h-7.5 w-7.5 md:h-9 md:w-9')} />
        </span>
      )
    case 'in-progress':
      return (
        <span className={cx(box, 'border-3 bg-surface', style.border)}>
          <SubjectIcon subject={stop.subject} size={34} className={iconClass(size, 'h-7 w-7', 'h-8.5 w-8.5', 'h-7 w-7 md:h-8.5 md:w-8.5')} />
          <span className={cx('flex h-1.5 w-9 overflow-hidden rounded-control bg-divider md:w-11', bonus && 'border border-fg')}>
            <span className={style.bar} style={{ width: `${progressPct(stop)}%` }} />
          </span>
        </span>
      )
    default:
      return (
        <span className={cx(box, 'border-3 bg-surface', style.border)}>
          <SubjectIcon subject={stop.subject} size={40} className={iconClass(size, 'h-8 w-8', 'h-10 w-10', 'h-8 w-8 md:h-10 md:w-10')} />
        </span>
      )
  }
}

function stopAria(stop: QuestStopDTO): string {
  const name = `${SUBJECT_NAME[stop.subject]} ${stop.sessionLabel.toLowerCase()}`
  if (stop.state === 'in-progress') return `${name}, ${stop.answered} of ${stop.total} done`
  return `${name}, ${STATE_WORD[stop.state]}`
}

/**
 * Baris perhentian kecil: cap dan teks. Menjadi tautan bila quest bisa dibuka.
 * `size` auto: di HP judulnya nama mapel dan keterangannya judul quest (papan TodayAHP),
 * mulai md judulnya "Mapel: judul quest" dengan keterangan dari DTO (papan TodayA).
 */
export function QuestStopRow({ stop, size = 'L' }: { stop: QuestStopDTO; size?: StampSize }): ReactElement {
  const quiet = stop.state === 'locked' || stop.state === 'rest'
  const open = !!stop.href && !quiet
  const topic = stop.title && stop.title !== stop.sessionLabel ? stop.title : null
  const inner = (
    <>
      <span className={cx('flex flex-none justify-center', size === 'L' ? 'w-36' : size === 'S' ? 'w-28' : 'w-28 md:w-36')}>
        <QuestStamp stop={stop} size={size} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cx('text-body-lg font-bold', quiet ? 'text-fg-muted' : 'text-fg')}>{stop.sessionLabel}</span>
        {topic ? <span className={cx('text-body font-semibold break-words', quiet ? 'text-fg-muted' : 'text-fg')}>{topic}</span> : null}
        <span className="text-body text-fg-muted">{stop.meta}</span>
        {stop.offlineReady && !quiet && stop.state !== 'done' ? (
          <span className="inline-flex items-center gap-1.5 text-body font-semibold text-fg">
            <UiIcon name="check-circle" size={18} className="text-success" />
            Saved on this device
          </span>
        ) : null}
      </span>
    </>
  )
  const cls = cx('relative flex items-center rounded-card no-underline', size === 'L' ? 'gap-8' : size === 'S' ? 'gap-4' : 'gap-4 md:gap-8')
  if (open && stop.href) {
    return (
      <Link href={stop.href} aria-label={`${stopAria(stop)}. ${stop.meta}`} className={cx(cls, 'text-fg hover:text-fg')}>
        {inner}
      </Link>
    )
  }
  return (
    <div role="group" aria-label={`${stopAria(stop)}. ${stop.meta}`} className={cls}>
      {inner}
    </div>
  )
}

/** Perhentian aktif ukuran 2 kali (144 px tablet, 112 px HP). */
export function QuestStopBig({ stop, headingLevel = 2 }: { stop: QuestStopDTO; headingLevel?: 2 | 3 | 4 }): ReactElement {
  const style = SUBJECT_STYLE[stop.subject]
  const Heading = headingLevel === 4 ? 'h4' : headingLevel === 3 ? 'h3' : 'h2'
  const bonus = stop.subject === 'bonus'
  const showBar = stop.state === 'in-progress'
  return (
    <div className="relative flex items-start gap-4 md:gap-8">
      <span className="flex w-28 flex-none justify-center md:w-36">
        <span className={cx('flex h-28 w-28 flex-col items-center justify-center gap-2.5 rounded-card border-4 bg-surface md:h-36 md:w-36', style.border)}>
          <SubjectIcon subject={stop.subject} size={72} className="h-14 w-14 md:h-18 md:w-18" />
          {showBar ? (
            <span
              role="img"
              aria-label={`${stop.answered} of ${stop.total} done`}
              className={cx('flex h-2 w-16 overflow-hidden rounded-control bg-divider md:h-2.5 md:w-22', bonus && 'border border-fg')}
            >
              <span className={style.bar} style={{ width: `${progressPct(stop)}%` }} />
            </span>
          ) : null}
        </span>
      </span>
      <div className="flex min-w-0 flex-col items-start gap-2.5 md:pt-1.5">
        <Heading className="m-0 text-h3 font-bold md:text-h2">
          {stop.sessionLabel}
          {stop.title && stop.title !== stop.sessionLabel ? `: ${stop.title}` : ''}
        </Heading>
        <div className="flex flex-wrap items-center gap-3">
          <span className="hidden md:inline-flex">
            <SubjectChip subject={stop.subject} size="S" />
          </span>
          <p className="m-0 text-body text-fg-muted md:text-body-lg">
            <strong className="font-bold text-fg md:hidden">{SUBJECT_NAME[stop.subject]}, </strong>
            {stop.meta}
          </p>
        </div>
        {stop.offlineReady ? (
          <span className="inline-flex items-center gap-2 text-body font-semibold">
            <UiIcon name="check-circle" size={20} className="text-success" />
            Saved on this device
          </span>
        ) : null}
        {stop.href ? (
          <ButtonLink href={stop.href} iconAfter="arrow-right" className="mt-2 h-auto! min-h-14 max-w-full py-2.5 whitespace-normal!">
            {stop.ctaLabel}
          </ButtonLink>
        ) : (
          <span className="mt-2 text-body font-semibold text-fg-muted">{stop.ctaLabel}</span>
        )}
      </div>
    </div>
  )
}
