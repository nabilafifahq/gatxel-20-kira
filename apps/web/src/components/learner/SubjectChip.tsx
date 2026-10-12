import type { ReactElement, ReactNode } from 'react'
import type { QuestSubject } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { SubjectIcon } from './SubjectIcon'
import { SUBJECT_NAME, SUBJECT_STYLE } from './subject'

/**
 * Chip mapel (papan SubjectChip). Ikon mapel, border warna mapel, label --fg.
 * Chip bukan tombol. L 44 px (learner), M 40 px (bar atas runner), S 36 px (Today), XS 32 px (konsol).
 */
const SIZES = {
  L: { box: 'h-11 gap-2 pl-2 pr-4.5 border-2 text-body-lg font-bold', icon: 28 },
  M: { box: 'h-10 gap-2 pl-2 pr-3.5 border-2 text-body font-bold', icon: 24 },
  S: { box: 'h-9 gap-2 pl-2 pr-3.5 border text-body font-bold', icon: 22 },
  XS: { box: 'h-8 gap-1.5 pl-1.5 pr-3 border text-small font-semibold', icon: 20 },
} as const

export function SubjectChip({
  subject,
  size = 'M',
  label,
  className,
}: {
  subject: QuestSubject
  size?: keyof typeof SIZES
  /** Ganti label, misalnya "ESMO Math". */
  label?: ReactNode
  className?: string
}): ReactElement {
  const s = SIZES[size]
  const style = SUBJECT_STYLE[subject]
  return (
    <span className={cx('inline-flex flex-none items-center rounded-pill text-fg whitespace-nowrap', s.box, style.tint, style.border, className)}>
      <SubjectIcon subject={subject} size={s.icon} />
      {label ?? SUBJECT_NAME[subject]}
    </span>
  )
}
