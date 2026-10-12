import type { ReactNode } from 'react'
import type { Subject } from '@/lib/dto'
import { cx } from './cx'
import { SUBJECT_BG50, SUBJECT_BORDER, SUBJECT_LABEL } from './format'

/** Kartu: permukaan putih, garis 1px --divider, radius 16, tanpa bayangan. */
export function Card({
  children,
  className,
  padding = 'md',
  as: Tag = 'div',
  ...rest
}: {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  as?: 'div' | 'section' | 'article' | 'aside' | 'li'
} & Record<`aria-${string}` | `data-${string}`, string | undefined>) {
  return (
    <Tag
      className={cx(
        'min-w-0 rounded-card border border-divider bg-surface',
        padding === 'sm' && 'p-4',
        padding === 'md' && 'p-6 max-sm:p-4',
        padding === 'lg' && 'p-8 max-sm:p-5',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/** Judul layar: h1 32/40, keterangan --fg-muted, aksi di kanan (turun ke bawah di layar sempit). */
export function PageHeader({ title, description, actions, aside }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1">
        <h1 className="m-0 text-h1 font-bold max-sm:text-h2">{title}</h1>
        {description ? <p className="m-0 text-body text-fg-muted">{description}</p> : null}
      </div>
      {aside}
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  )
}

export function CountBadge({ count, label }: { count: number; label?: string }) {
  return (
    <span
      aria-label={label}
      className="inline-flex h-7 min-w-8 items-center justify-center rounded-pill bg-fg px-2.5 text-small font-bold text-white tabular"
    >
      {count}
    </span>
  )
}

/** Judul bagian: h2 24/32 dengan jumlah dan aksi opsional. */
export function SectionHeading({
  id,
  children,
  count,
  countLabel,
  aside,
  level = 2,
}: {
  id: string
  children: ReactNode
  count?: number
  countLabel?: string
  aside?: ReactNode
  level?: 2 | 3
}) {
  const H = level === 2 ? 'h2' : 'h3'
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2.5">
        <H id={id} className={cx('m-0 font-bold', level === 2 ? 'text-h2 max-sm:text-h3' : 'text-h3')}>
          {children}
        </H>
        {count != null ? <CountBadge count={count} label={countLabel} /> : null}
      </div>
      {aside ? <div className="ml-auto flex flex-wrap items-center gap-2">{aside}</div> : null}
    </div>
  )
}

export function Section({ labelledBy, children, className }: { labelledBy: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={labelledBy} className={cx('flex min-w-0 flex-col gap-3', className)}>
      {children}
    </section>
  )
}

/** Ikon mapel 20px (papan SubjectChip). */
export function SubjectGlyph({ subject, size = 20 }: { subject: Subject; size?: number }) {
  if (subject === 'math') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="flex-none">
        <rect x="5" y="5" width="10" height="10" rx="2" className="fill-math stroke-fg" strokeWidth="2" />
        <rect x="17" y="5" width="10" height="10" rx="2" className="fill-math-50 stroke-fg" strokeWidth="2" />
        <rect x="5" y="17" width="10" height="10" rx="2" className="fill-math-50 stroke-fg" strokeWidth="2" />
        <rect x="17" y="17" width="10" height="10" rx="2" className="fill-math stroke-fg" strokeWidth="2" />
      </svg>
    )
  }
  if (subject === 'english') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="flex-none">
        <path
          d="M16 9c-3-2.2-6.5-3-11-2.5v18c4.5-.5 8 .3 11 2.5 3-2.2 6.5-3 11-2.5v-18c-4.5-.5-8 .3-11 2.5z"
          className="fill-surface stroke-fg"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M16 9v18" fill="none" className="stroke-fg" strokeWidth="2" />
        <path
          d="M8.5 12.5c1.8 0 3.3.3 4.5.9M8.5 16.5c1.8 0 3.3.3 4.5.9M19 13.4c1.2-.6 2.7-.9 4.5-.9M19 17.4c1.2-.6 2.7-.9 4.5-.9"
          fill="none"
          className="stroke-english"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="flex-none">
      <path d="M7 25C6 15 12 7 26 6c.5 13-6.5 20-19 19z" className="fill-surface stroke-fg" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 25c4-6 8-10 14-13" fill="none" className="stroke-science" strokeWidth="2" strokeLinecap="round" />
      <path d="M12.5 19.5l-.6-4.6M16.2 16.3l4 .1" fill="none" className="stroke-science" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** Chip mapel konsol 32px: latar tipis, garis 1px warna mapel, label --fg. Bukan tombol. */
export function SubjectChip({ subject, withIcon = true, size = 'md' }: { subject: Subject; withIcon?: boolean; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cx(
        'inline-flex flex-none items-center gap-1.5 rounded-pill border font-semibold whitespace-nowrap text-fg',
        size === 'md' ? 'h-8 text-small' : 'h-7 text-small',
        withIcon ? 'pr-3 pl-1.5' : 'px-3',
        SUBJECT_BG50[subject],
        SUBJECT_BORDER[subject],
      )}
    >
      {withIcon ? <SubjectGlyph subject={subject} /> : null}
      {SUBJECT_LABEL[subject]}
    </span>
  )
}

/** Label status kecil berbentuk pill, selalu dengan teks. */
export function Pill({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'dark' | 'math'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-[26px] flex-none items-center gap-1 rounded-pill border px-2.5 text-small font-bold whitespace-nowrap',
        tone === 'neutral' && 'border-border bg-surface text-fg',
        tone === 'success' && 'border-success bg-surface text-fg',
        tone === 'warn' && 'border-warn bg-warn-50 text-fg',
        tone === 'danger' && 'border-danger bg-danger-50 text-fg',
        tone === 'dark' && 'border-fg bg-fg text-white',
        tone === 'math' && 'border-math bg-math-50 text-fg',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Daftar label dan nilai (dl) dua kolom. */
export function KeyValues({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cx('m-0 grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-6 gap-y-2', className)}>
      {items.map((it, i) => (
        <div key={i} className="contents">
          <dt className="text-body text-fg-muted">{it.label}</dt>
          <dd className="m-0 text-body font-semibold">{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}
