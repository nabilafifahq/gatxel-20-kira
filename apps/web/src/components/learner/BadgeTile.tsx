import type { ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { shortDate } from './format'

/**
 * Ubin lencana (papan BadgeTile). Glyph Mohave di lingkaran bergaris tinta.
 * Status didapat atau terkunci selalu tertulis sebagai teks; lencana terkunci
 * menyebut syaratnya. Label New hilang setelah lencana dilihat.
 */

const FILLS = ['bg-math-50', 'bg-star', 'bg-science-50', 'bg-english-50'] as const

/** Glyph dari judul: angka pertama ("7-day streak" jadi 7), atau inisial dua kata. */
export function badgeGlyph(title: string): string {
  const num = /\d+/.exec(title)
  if (num) return num[0].slice(0, 3)
  const words = title.split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function fillFor(id: string): string {
  // Lencana arena memakai warna jalurnya: Quick Maths ungu, Quiz Arena biru tua.
  if (id.startsWith('qm-')) return 'bg-mental-50'
  if (id.startsWith('quiz-')) return 'bg-knowledge-50'
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return FILLS[h % FILLS.length] ?? 'bg-math-50'
}

/** Medali lencana tanpa teks (halaman hasil): lingkaran bergaris tinta dengan glyph. */
export function BadgeMedal({ id, title, size = 'L', glyph, className }: { id: string; title: string; size?: 'M' | 'L'; glyph?: string; className?: string }): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex flex-none items-center justify-center rounded-pill border-2 border-fg font-display font-bold',
        size === 'L' ? 'h-18 w-18 text-h1' : 'h-14 w-14 text-h3',
        fillFor(id),
        className,
      )}
    >
      {glyph ?? badgeGlyph(title)}
    </span>
  )
}

export function BadgeTile({
  id,
  title,
  description,
  earnedAt,
  isNew = false,
  glyph,
  className,
}: {
  id: string
  title: string
  description: string
  earnedAt: string | null
  isNew?: boolean
  glyph?: string
  className?: string
}): ReactElement {
  const earned = earnedAt !== null
  const when = earned ? shortDate(earnedAt) : null
  return (
    <div
      role="img"
      aria-label={earned ? `${title}, earned ${when}${isNew ? ', new' : ''}` : `${title}, locked. ${description}`}
      className={cx(
        'relative flex flex-col items-center gap-1.5 rounded-control px-2 pt-3.5 pb-3 text-center',
        earned ? 'border border-divider bg-surface' : 'border-2 border-dashed border-border bg-bg',
        className,
      )}
    >
      {earned ? (
        <span aria-hidden="true" className={cx('flex h-14 w-14 items-center justify-center rounded-pill border-2 border-fg font-display text-h3 font-bold', fillFor(id))}>
          {glyph ?? badgeGlyph(title)}
        </span>
      ) : (
        <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-pill border-2 border-dashed border-border bg-bg text-fg-muted">
          <UiIcon name="lock" size={24} />
        </span>
      )}
      <span className="text-body leading-5 font-bold">{title}</span>
      <span className="text-body leading-5 text-fg-muted">{earned ? when : description}</span>
      {isNew && earned ? (
        <span className="absolute -top-3 right-2 inline-flex h-6 items-center rounded-pill bg-fg px-2.5 text-small font-bold text-white">New</span>
      ) : null}
    </div>
  )
}
