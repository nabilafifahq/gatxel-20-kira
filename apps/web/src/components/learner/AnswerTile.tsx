import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react'
import type { Subject } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { SUBJECT_STYLE } from './subject'

/**
 * Ubin jawaban (papan AnswerTile). Tinggi minimal 56 px (72 px untuk teks soal).
 * Terpilih memakai border 3 px warna mapel. Correct dan Not yet selalu membawa ikon dan teks.
 * `dimmed` untuk opsi lain setelah jawaban diperiksa.
 */

export type AnswerTileState = 'default' | 'selected' | 'correct' | 'not-yet' | 'dimmed' | 'disabled'

export function TileBadge({ kind, className }: { kind: 'correct' | 'not-yet'; className?: string }): ReactElement {
  return (
    <span
      className={cx(
        'pointer-events-none absolute -top-3.5 right-2.5 inline-flex h-7 items-center gap-1 rounded-pill px-2.5 text-body font-bold text-white',
        kind === 'correct' ? 'bg-success' : 'bg-warn',
        className,
      )}
    >
      <UiIcon name={kind === 'correct' ? 'check' : 'not-yet'} size={16} />
      {kind === 'correct' ? 'Correct' : 'Not yet'}
    </span>
  )
}

export function LetterPill({ letter, state, subject }: { letter: string; state: AnswerTileState; subject: Subject }): ReactElement {
  const style = SUBJECT_STYLE[subject]
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex h-8 w-8 flex-none items-center justify-center rounded-pill text-body font-bold',
        state === 'default' && 'border-2 border-border bg-surface text-fg',
        state === 'selected' && cx(style.solid, 'text-white'),
        state === 'correct' && 'bg-success text-white',
        state === 'not-yet' && 'border-2 border-warn bg-surface text-fg',
        (state === 'dimmed' || state === 'disabled') && 'border-2 border-divider bg-surface text-border',
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
  const style = SUBJECT_STYLE[subject]
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
        state === 'default' && 'cursor-pointer border-border bg-surface hover:border-fg enabled:active:scale-97',
        state === 'selected' && cx('cursor-pointer', style.border, style.tint, 'enabled:active:scale-97'),
        state === 'correct' && 'kira-correct cursor-default border-success bg-success-50',
        state === 'not-yet' && 'kira-nudge cursor-default border-warn bg-surface',
        state === 'dimmed' && 'cursor-default border-divider bg-bg',
        state === 'disabled' && 'cursor-not-allowed border-divider bg-bg text-border',
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
