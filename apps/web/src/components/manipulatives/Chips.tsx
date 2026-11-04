'use client'

import type { ReactElement } from 'react'
import { cx } from '@/components/ui/cx'

/** Pilihan ketuk bergaya radio untuk bermain bebas. */
export function Chips<T extends string | number>({ label, value, options, onPick, render }: { label: string; value: T; options: readonly T[]; onPick(v: T): void; render?(v: T): string }): ReactElement {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="text-small font-semibold text-fg-muted">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onPick(o)}
          className={cx(
            'inline-flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-control border-2 px-3 text-body font-bold transition-transform duration-150 ease-kira active:scale-95',
            value === o ? 'border-fg bg-fg text-white' : 'border-border bg-surface text-fg',
          )}
        >
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  )
}

