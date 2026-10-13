'use client'

import { useEffect, useRef, type ReactElement } from 'react'
import type { Subject } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'

/**
 * Papan karakter untuk soal eja, tabel, dan teka-teki kotak: huruf atau angka sebagai tombol 56 px,
 * dengan hapus satu dan kosongkan semua. Menerima keyboard fisik juga: karakter yang ada di papan,
 * Backspace untuk hapus satu, Delete atau Escape untuk mengosongkan. Hanya satu papan aktif per halaman.
 */

export const LETTERS_AZ = 'abcdefghijklmnopqrstuvwxyz'.split('')
export const DIGITS_0_9 = '1234567890'.split('')

const ACTIVE: Record<Subject, string> = {
  math: 'active:border-math active:bg-math-50',
  english: 'active:border-english active:bg-english-50',
  science: 'active:border-science active:bg-science-50',
}

export function CharKeypad({
  keys,
  onKey,
  onBackspace,
  onClear,
  disabled = false,
  subject,
  columns = 7,
  upper = false,
  physicalKeyboard = true,
  label = 'Keypad',
  className,
}: {
  keys: readonly string[]
  onKey: (key: string) => void
  onBackspace: () => void
  onClear: () => void
  disabled?: boolean
  subject: Subject
  columns?: number
  /** Tampilkan huruf besar di tombol; nilai yang dikirim tetap huruf kecil. */
  upper?: boolean
  physicalKeyboard?: boolean
  label?: string
  className?: string
}): ReactElement {
  const handlers = useRef({ onKey, onBackspace, onClear })
  const keySet = useRef(keys)
  useEffect(() => {
    handlers.current = { onKey, onBackspace, onClear }
    keySet.current = keys
  })

  useEffect(() => {
    if (!physicalKeyboard || disabled) return
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (t?.closest('dialog[open]')) return
      if (e.key === 'Backspace') {
        e.preventDefault()
        handlers.current.onBackspace()
      } else if (e.key === 'Delete' || e.key === 'Escape') {
        e.preventDefault()
        handlers.current.onClear()
      } else if (e.key.length === 1) {
        const k = e.key.toLowerCase()
        if (keySet.current.includes(k)) {
          e.preventDefault()
          handlers.current.onKey(k)
        }
      }
    }
    window.addEventListener('keydown', onDown)
    return () => window.removeEventListener('keydown', onDown)
  }, [physicalKeyboard, disabled])

  const keyBase = cx(
    'flex h-14 min-w-0 items-center justify-center rounded-control border-2 p-0 font-reading text-h3 font-bold transition-transform duration-150 ease-kira',
    disabled ? 'cursor-not-allowed border-divider bg-bg text-border' : cx('cursor-pointer border-border bg-surface text-fg hover:border-fg active:scale-97', ACTIVE[subject]),
  )
  return (
    <div role="group" aria-label={label} className={cx('flex w-full max-w-[420px] flex-col gap-2', className)}>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {keys.map((k) => (
          <button key={k} type="button" disabled={disabled} aria-label={k === ' ' ? 'Space' : k === '-' ? 'Hyphen' : k === "'" ? 'Apostrophe' : k === '.' ? 'Point' : k} onClick={() => onKey(k)} className={keyBase}>
            {upper ? k.toUpperCase() : k}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" disabled={disabled} aria-label="Delete" onClick={onBackspace} className={cx(keyBase, 'gap-2 text-body-lg')}>
          <UiIcon name="backspace" size={24} />
          Delete
        </button>
        <button type="button" disabled={disabled} onClick={onClear} className={cx(keyBase, 'text-body-lg')}>
          Clear
        </button>
      </div>
    </div>
  )
}
