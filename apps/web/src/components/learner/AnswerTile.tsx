'use client'

import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react'
import type { Subject } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { useT } from '@/lib/i18n/client'

/**
 * Ubin jawaban (papan AnswerTile). Tinggi minimal 56 px (72 px untuk teks soal).
 * Terpilih memakai isi Lilac dan border 3 px Deep Grape. Correct dan Not yet selalu membawa ikon dan teks.
 * `dimmed` untuk opsi lain setelah jawaban diperiksa.
 */

export type AnswerTileState = 'default' | 'selected' | 'correct' | 'not-yet' | 'dimmed' | 'disabled'

export function TileBadge({ kind, className }: { kind: 'correct' | 'not-yet'; className?: string }): ReactElement {
  const t = useT().runner
  return (
    <span
      className={cx(
        'pointer-events-none absolute -top-3.5 right-2.5 inline-flex h-7 items-center gap-1 rounded-pill px-2.5 text-body font-bold text-white',
        kind === 'correct' ? 'bg-success' : 'border-2 border-fg bg-lavender !text-fg',
        className,
      )}
    >
      <UiIcon name={kind === 'correct' ? 'check' : 'not-yet'} size={16} />
      {kind === 'correct' ? t.correct : t.notYet}
    </span>
  )
}

export function LetterPill({ letter, state }: { letter: string; state: AnswerTileState; subject?: Subject }): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex h-8 w-8 flex-none items-center justify-center rounded-pill text-body font-bold',
        state === 'default' && 'border-2 border-border bg-surface text-fg',
        state === 'selected' && 'bg-fg text-white',
        state === 'correct' && 'bg-success text-white',
        state === 'not-yet' && 'border-2 border-dashed border-fg bg-surface text-fg',
        (state === 'dimmed' || state === 'disabled') && 'border-2 border-lavender bg-surface text-fg/55',
      )}
    >
      {letter}
    </span>
  )
}

export function AnswerTile({
  letter,
  state = 'default',
  subject,
  layout = 'row',
  children,
  className,
  ...rest
}: {
  letter?: string
  state?: AnswerTileState
  subject: Subject
  /** row: pill dan teks sebaris. stack: pill di atas, isi (gambar) di tengah. */
  layout?: 'row' | 'stack'
  children: ReactNode
  className?: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>): ReactElement {
  const thick = state === 'selected' || state === 'correct' || state === 'not-yet'
  const inactive = state === 'dimmed' || state === 'disabled'
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'relative flex w-full rounded-control text-left text-fg transition-transform duration-150 ease-kira',
        layout === 'row' ? 'min-h-18 items-center gap-3' : 'min-h-26 flex-col items-start gap-2',
        thick ? (layout === 'row' ? 'border-3 px-[15px] py-[11px]' : 'border-3 p-[11px]') : layout === 'row' ? 'border-2 px-4 py-3' : 'border-2 p-3',
        state === 'default' && 'cursor-pointer border-border bg-surface enabled:hover:-translate-y-px enabled:active:translate-y-0.5',
        state === 'selected' && 'cursor-pointer border-fg bg-lilac enabled:active:translate-y-0.5',
        state === 'correct' && 'kira-correct cursor-default border-success bg-surface',
        state === 'not-yet' && 'kira-nudge cursor-default border-dashed border-fg bg-lavender',
        state === 'dimmed' && 'cursor-default border-lavender bg-bg',
        state === 'disabled' && 'cursor-not-allowed border-lavender bg-lavender text-fg/55',
        className,
      )}
    >
      {letter ? <LetterPill letter={letter} state={state} subject={subject} /> : null}
      <span className={cx('min-w-0', layout === 'stack' ? 'flex w-full flex-1 flex-col items-center justify-center gap-2 self-stretch' : 'flex-1', inactive && 'opacity-50')}>
        {children}
      </span>
      {state === 'correct' ? <TileBadge kind="correct" /> : null}
      {state === 'not-yet' ? <TileBadge kind="not-yet" /> : null}
    </button>
  )
}
