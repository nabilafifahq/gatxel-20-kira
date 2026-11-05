import Link from 'next/link'
import type { CoachChild } from '@/lib/dto-coach'
import { cx } from '@/components/console/cx'

/** Pilih anak lewat tautan ?learner= (server-rendered, 44 px). Tersembunyi bila hanya ada satu anak. */
export function ChildPicker({ children, selectedId, href }: { children: CoachChild[]; selectedId: string | null; href: (id: string) => string }) {
  if (children.length < 2) return null
  return (
    <nav aria-label="Pilih anak" className="flex flex-wrap gap-2">
      {children.map((c) => {
        const on = c.id === selectedId
        return (
          <Link
            key={c.id}
            href={href(c.id)}
            aria-current={on ? 'page' : undefined}
            className={cx(
              'inline-flex min-h-11 max-w-full items-center rounded-pill border-2 px-4 py-1 text-body no-underline',
              on ? 'border-fg bg-fg font-extrabold text-white hover:text-white' : 'border-border bg-surface font-semibold text-fg hover:border-fg',
            )}
          >
            <span className="min-w-0 [overflow-wrap:anywhere]">{c.name}</span>
            <span className={cx('ml-2 flex-none text-small', on ? 'text-white' : 'text-fg-muted')}>Kelas {c.grade}</span>
          </Link>
        )
      })}
    </nav>
  )
}
