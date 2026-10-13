'use client'

import Link from 'next/link'
import { useState, type ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { Dialog } from '@/components/ui/Dialog'
import { UiIcon, type UiIconName } from '@/components/ui/icons'
import type { LearnerNavKey } from './routes'

/**
 * Tombol "More" di bar bawah HP: membuka lembar berisi tujuan utama yang tidak muat di bar (Competitions,
 * English Skills, Quick Maths, Quiz Arena). Hanya ketuk, target 56 px, dan <dialog> asli (fokus terkurung,
 * Escape menutup, fokus kembali ke tombol). Tombol menyala bila layar yang terbuka ada di dalam lembar.
 */

export type MoreItem = { key: LearnerNavKey; label: string; icon: UiIconName; href: string }

export function MoreNav({ items, current }: { items: readonly MoreItem[]; current: LearnerNavKey | null }): ReactElement | null {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  const inside = items.some((n) => n.key === current)
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cx(
          'relative flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-control border-2 bg-transparent px-0.5 text-center text-body leading-5',
          inside ? 'border-fg bg-bg font-bold text-fg' : 'border-transparent font-semibold text-fg-muted',
        )}
      >
        <UiIcon name="more" size={24} />
        More
        {inside ? <span className="visually-hidden"> (current page is inside)</span> : null}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="More" size="sm" initialFocus="none">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((n) => {
            const on = n.key === current
            return (
              <li key={n.key}>
                <Link
                  href={n.href}
                  aria-current={on ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className={cx(
                    'flex min-h-14 items-center gap-3 rounded-control border-2 px-4 text-body-lg no-underline',
                    on ? 'border-fg bg-bg font-bold text-fg' : 'border-divider font-semibold text-fg hover:border-fg',
                  )}
                >
                  <UiIcon name={n.icon} size={26} />
                  {n.label}
                </Link>
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-14 cursor-pointer rounded-control border-2 border-border bg-surface px-5 text-body-lg font-bold text-fg"
        >
          Close
        </button>
      </Dialog>
    </>
  )
}
