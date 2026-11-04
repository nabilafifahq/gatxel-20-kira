'use client'

import { useRef, type KeyboardEvent, type ReactElement } from 'react'
import { cx } from './cx'

export type SegmentOption<T extends string> = { value: T; label: string; id?: string; controls?: string }

/**
 * Kontrol segmen gaya iOS: penanda bergeser di bawah pilihan aktif, target 44 px, panah kiri dan kanan untuk keyboard.
 * `semantic="tabs"` bila tiap segmen membuka panel, `radio` bila memilih nilai di dalam form.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  semantic = 'radio',
  className,
}: {
  label: string
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (next: T) => void
  semantic?: 'tabs' | 'radio'
  className?: string
}): ReactElement {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  const count = options.length

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % count
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + count) % count
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = count - 1
    if (next < 0) return
    e.preventDefault()
    onChange(options[next]!.value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role={semantic === 'tabs' ? 'tablist' : 'radiogroup'}
      aria-label={label}
      className={cx('relative isolate grid min-h-12 rounded-control bg-lavender p-0.5', className)}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 -z-10 rounded-control border-2 border-fg bg-surface shadow-soft transition-transform duration-[240ms] ease-kira"
        style={{ width: `calc((100% - 4px) / ${count})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            id={o.id}
            type="button"
            data-no-press
            role={semantic === 'tabs' ? 'tab' : 'radio'}
            aria-selected={semantic === 'tabs' ? on : undefined}
            aria-checked={semantic === 'radio' ? on : undefined}
            aria-controls={o.controls}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cx('relative z-10 min-h-11 min-w-0 cursor-pointer rounded-control border-0 bg-transparent px-2 text-center text-body text-fg', on ? 'font-extrabold' : 'font-bold')}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
