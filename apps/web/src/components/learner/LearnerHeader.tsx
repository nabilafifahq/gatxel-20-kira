import Link from 'next/link'
import type { ReactElement, ReactNode } from 'react'
import { Avatar } from '@kira/figures'
import type { AvatarName, LearnerShell } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { UiIcon, type UiIconName } from '@/components/ui/icons'
import { LEARNER_ROUTES, type LearnerNavKey } from './routes'

/**
 * Kerangka layar learner dengan navigasi utama (papan TodayA, PetaBelajar, Me, BukuKoreksi):
 * rel kiri 104 px di tablet, bar bawah di HP. Root membawa data-jenjang supaya
 * ukuran teks soal mengikuti jenjang learner.
 */

const NAV: { key: LearnerNavKey; label: string; icon: UiIconName; href: string }[] = [
  { key: 'today', label: 'Today', icon: 'sun', href: LEARNER_ROUTES.today },
  { key: 'map', label: 'Map', icon: 'map', href: LEARNER_ROUTES.map },
  { key: 'review', label: 'Review', icon: 'cards', href: LEARNER_ROUTES.review },
  { key: 'quick-maths', label: 'Quick Maths', icon: 'bolt', href: LEARNER_ROUTES.quickMaths },
  { key: 'quiz-arena', label: 'Quiz Arena', icon: 'globe', href: LEARNER_ROUTES.quizArena },
  { key: 'me', label: 'Me', icon: 'person', href: LEARNER_ROUTES.me },
]

const AVATAR_WORD: Record<AvatarName, string> = {
  fox: 'Fox',
  cat: 'Cat',
  owl: 'Owl',
  bear: 'Bear',
  rabbit: 'Rabbit',
  turtle: 'Turtle',
  penguin: 'Penguin',
  frog: 'Frog',
}

export function avatarLabel(avatar: AvatarName): string {
  return `${AVATAR_WORD[avatar]} avatar`
}

function navItems(shell: LearnerShell) {
  return NAV.filter((n) => n.key !== 'review' || shell.showReview)
}

function ReviewCount({ shell }: { shell: LearnerShell }): ReactElement | null {
  if (shell.dueReviewCount <= 0) return null
  return (
    <span className="absolute -top-2 -right-2 inline-flex h-6 min-w-6 items-center justify-center rounded-pill bg-fg px-1.5 text-small font-bold text-white tabular-nums">
      {shell.dueReviewCount}
      <span className="visually-hidden"> cards today</span>
    </span>
  )
}

export function LearnerNav({ shell, current }: { shell: LearnerShell; current: LearnerNavKey | null }): ReactElement {
  const items = navItems(shell)
  return (
    <>
      <nav
        aria-label="Main"
        className="sticky top-0 hidden h-svh w-26 flex-none flex-col items-center gap-3 border-r border-divider bg-surface px-3 py-7 md:flex"
      >
        <div className="mb-5 font-display text-h1 font-bold">Kira</div>
        {items.map((n) => {
          const on = n.key === current
          return (
            <Link
              key={n.key}
              href={n.href}
              aria-current={on ? 'page' : undefined}
              className={cx(
                'relative flex min-h-19 w-20 flex-col items-center justify-center gap-1 rounded-control border-2 px-1 py-2 text-center text-body leading-5 no-underline',
                on ? 'border-fg bg-bg font-bold text-fg' : 'border-transparent font-semibold text-fg-muted hover:border-divider hover:text-fg',
              )}
            >
              <UiIcon name={n.icon} size={26} />
              {n.label}
              {n.key === 'review' ? <ReviewCount shell={shell} /> : null}
            </Link>
          )
        })}
      </nav>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex h-19 gap-2 border-t border-divider bg-surface px-4 py-1.5 md:hidden"
      >
        {items.map((n) => {
          const on = n.key === current
          return (
            <Link
              key={n.key}
              href={n.href}
              aria-current={on ? 'page' : undefined}
              className={cx(
                'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-control border-2 px-0.5 text-center text-body leading-5 no-underline',
                on ? 'border-fg bg-bg font-bold text-fg' : 'border-transparent font-semibold text-fg-muted',
              )}
            >
              <UiIcon name={n.icon} size={24} />
              {n.label}
              {n.key === 'review' ? <ReviewCount shell={shell} /> : null}
            </Link>
          )
        })}
      </nav>
    </>
  )
}

/** Layar learner dengan navigasi utama. `current` null untuk layar tanpa tab aktif. */
export function LearnerFrame({
  shell,
  current,
  children,
  className,
}: {
  shell: LearnerShell
  current: LearnerNavKey | null
  children: ReactNode
  className?: string
}): ReactElement {
  return (
    <div data-jenjang={shell.jenjang} className="min-h-svh bg-bg text-fg md:flex">
      <LearnerNav shell={shell} current={current} />
      <main className={cx('min-w-0 flex-1 px-4 pt-5 pb-28 md:px-10 md:pt-8 md:pb-8 md:pl-8', className)}>{children}</main>
    </div>
  )
}

/** Sapaan dengan avatar (papan TodayA dan Me). */
export function LearnerHeader({
  shell,
  title,
  subline,
  right,
  avatarSize = 64,
  className,
}: {
  shell: LearnerShell
  /** Default "Hi, {nama}". */
  title?: ReactNode
  subline?: ReactNode
  right?: ReactNode
  avatarSize?: number
  className?: string
}): ReactElement {
  return (
    <header className={cx('flex flex-wrap items-center justify-between gap-x-6 gap-y-4', className)}>
      <div className="flex min-w-0 items-center gap-3 md:gap-4">
        <Avatar name={shell.avatar} accessory={shell.accessory ?? null} size={avatarSize} title={avatarLabel(shell.avatar)} className="h-12 w-12 flex-none md:h-auto md:w-auto" />
        <div className="flex min-w-0 flex-col">
          <h1 className="m-0 text-h1 font-bold break-words">{title ?? `Hi, ${shell.name}`}</h1>
          {subline ? <p className="m-0 text-body-lg text-fg-muted">{subline}</p> : null}
        </div>
      </div>
      {right ? <div className="flex flex-wrap items-center gap-5">{right}</div> : null}
    </header>
  )
}
