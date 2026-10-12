import type { ReactElement } from 'react'
import type { QuestSubject, SegmentState } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { SUBJECT_STYLE } from './subject'

/**
 * Bar progres bersegmen (papan ProgressSegments). Satu segmen per soal. Status ditandai
 * warna, ikon kecil, dan aria-label per segmen; penghitung teks ada di samping.
 * Segmen `answered` (mode tanpa umpan balik) memakai warna mapel tanpa ikon.
 */

const WORD: Record<SegmentState, string> = {
  correct: 'correct',
  'not-yet': 'not yet',
  current: 'now',
  todo: 'not done',
  answered: 'answered',
}

const RING: Record<QuestSubject, string> = {
  math: 'border-math',
  english: 'border-english',
  science: 'border-science',
  bonus: 'border-fg',
}

export function ProgressSegments({
  segments,
  subject,
  label,
  size = 'L',
  className,
}: {
  segments: SegmentState[]
  subject: QuestSubject
  /** Misalnya "Quest progress, question 4 of 10". */
  label: string
  size?: 'L' | 'S'
  className?: string
}): ReactElement {
  const style = SUBJECT_STYLE[subject]
  const many = segments.length > 20
  return (
    <ol
      aria-label={label}
      className={cx('m-0 flex min-w-0 flex-1 list-none p-0', many ? 'gap-0.5' : size === 'L' ? 'gap-1.5' : 'gap-1', className)}
    >
      {segments.map((s, i) => (
        <li
          key={i}
          aria-label={`Question ${i + 1}, ${WORD[s]}`}
          aria-current={s === 'current' ? 'step' : undefined}
          className={cx(
            'flex min-w-0 flex-1 items-center justify-center rounded-control text-white',
            size === 'L' ? 'h-7' : 'h-5.5',
            s === 'correct' && 'bg-success',
            s === 'not-yet' && 'bg-warn',
            s === 'answered' && style.solid,
            s === 'todo' && 'bg-divider',
            s === 'current' && cx('border-3 bg-surface', RING[subject]),
          )}
        >
          {many ? null : s === 'correct' ? (
            <UiIcon name="check" size={14} strokeWidth={3.5} />
          ) : s === 'not-yet' ? (
            <UiIcon name="not-yet" size={14} strokeWidth={3} />
          ) : s === 'current' ? (
            <span className={cx('h-2 w-2 rounded-pill', style.solid)} />
          ) : null}
        </li>
      ))}
    </ol>
  )
}
