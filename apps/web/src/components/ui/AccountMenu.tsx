'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { cx } from './cx'

export type AccountLink = { href: string; label: string }

/**
 * Menu akun di header: nama, tautan, dan Keluar. Escape dan ketuk di luar menutup, fokus kembali ke tombol.
 * Keluar memakai form POST yang sama dengan sebelumnya.
 */
export function AccountMenu({ name, detail, links, signOutHref = '/keluar' }: { name: string; detail?: ReactNode; links: AccountLink[]; signOutHref?: string }): ReactElement {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const initial = [...name.trim()][0]?.toUpperCase() ?? 'K'
  return (
    <div ref={root} className="relative ml-1">
      <button
        ref={button}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Menu akun ${name}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-pill border-0 bg-transparent p-0"
      >
        <span aria-hidden="true" className="inline-flex size-9 items-center justify-center rounded-pill bg-fg font-numbers text-body font-bold text-white">
          {initial}
        </span>
      </button>
      <div id={id} hidden={!open} className={cx('absolute top-full right-0 z-40 mt-1 w-64 max-w-[calc(100vw-32px)] rounded-card bg-surface p-2 shadow-soft', open && 'kira-fade-up')}>
        <div className="px-3 py-2">
          <p className="m-0 text-body font-bold break-words">{name}</p>
          {detail ? <p className="m-0 text-small text-fg-muted break-words">{detail}</p> : null}
        </div>
        {links.map((l) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="kira-press flex min-h-11 items-center rounded-control px-3 font-bold text-fg no-underline hover:bg-lavender hover:text-fg">
            {l.label}
          </Link>
        ))}
        <form method="post" action={signOutHref}>
          <button type="submit" className="flex min-h-11 w-full cursor-pointer items-center rounded-control border-0 bg-transparent px-3 text-left font-bold text-fg hover:bg-lavender">
            Keluar
          </button>
        </form>
      </div>
    </div>
  )
}
