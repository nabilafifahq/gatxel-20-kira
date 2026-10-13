'use client'

import { useEffect, useId, useRef, type ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { applyKey, type KeypadKey } from '@/components/learner/NumericKeypad'
import type { ArenaTone } from './tone'

const KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del']

/**
 * Keypad angka untuk Quick Maths (papan NumericKeypad, nada ungu). Menerima keyboard fisik: angka,
 * Backspace, Delete atau Escape untuk mengosongkan, dan Enter untuk memeriksa. Tombol 64 px.
 */
export function ArenaKeypad({
  value,
  onChange,
  onSubmit,
  disabled = false,
  feedback = null,
  maxLength = 6,
  label = 'Your answer',
  tone = 'hitung',
  className,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit?: () => void
  disabled?: boolean
  feedback?: 'correct' | 'not-yet' | null
  maxLength?: number
  label?: string
  tone?: ArenaTone
  className?: string
}): ReactElement {
  const outputId = useId()
  const valueRef = useRef(value)
  const changeRef = useRef(onChange)
  const submitRef = useRef(onSubmit)
  useEffect(() => {
    valueRef.current = value
    changeRef.current = onChange
    submitRef.current = onSubmit
  })

  useEffect(() => {
    if (disabled) return
    const apply = (k: KeypadKey) => {
      const next = applyKey(valueRef.current, k, { maxLength, decimalChar: '.' })
      if (next !== valueRef.current) {
        valueRef.current = next
        changeRef.current(next)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (t?.closest('dialog[open]')) return
      if (e.key === 'Enter') {
        if (t instanceof HTMLButtonElement) return
        e.preventDefault()
        submitRef.current?.()
        return
      }
      let k: KeypadKey | null = null
      if (/^[0-9]$/.test(e.key)) k = e.key as KeypadKey
      else if (e.key === 'Backspace') k = 'del'
      else if (e.key === 'Delete' || e.key === 'Escape') k = 'clear'
      if (!k) return
      e.preventDefault()
      apply(k)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled, maxLength])

  const press = (k: KeypadKey) => {
    if (disabled) return
    const next = applyKey(valueRef.current, k, { maxLength, decimalChar: '.' })
    if (next !== valueRef.current) {
      valueRef.current = next
      changeRef.current(next)
    }
  }

  const active = tone === 'hitung' ? 'active:border-mental active:bg-mental-50' : 'active:border-knowledge active:bg-knowledge-50'
  const keyBase = cx(
    'flex h-16 items-center justify-center rounded-control border-2 p-0 text-h1 font-bold transition-transform duration-150 ease-kira',
    disabled ? 'cursor-not-allowed border-divider bg-bg text-border' : cx('cursor-pointer border-border bg-surface text-fg hover:border-fg active:scale-97', active),
  )
  const frame =
    feedback === 'correct'
      ? 'border-3 border-success bg-success-50'
      : feedback === 'not-yet'
        ? 'border-3 border-warn bg-surface'
        : disabled
          ? 'border-2 border-divider bg-bg'
          : tone === 'hitung'
            ? 'border-3 border-mental bg-surface'
            : 'border-3 border-knowledge bg-surface'
  return (
    <div className={cx('flex w-full max-w-[360px] flex-col gap-2.5', className)}>
      <output id={outputId} aria-live="polite" aria-label={label} className={cx('flex h-18 items-center justify-end rounded-control px-5 font-display text-display leading-none font-semibold tabular-nums', frame)}>
        {value === '' ? <span className="text-border">?</span> : value}
      </output>
      <div className="grid grid-cols-3 gap-2.5">
        {KEYS.map((k) => (
          <button key={k} type="button" disabled={disabled} aria-label={k === 'clear' ? 'Clear' : k === 'del' ? 'Delete' : k} onClick={() => press(k)} className={keyBase}>
            {k === 'del' ? <UiIcon name="backspace" size={28} /> : k === 'clear' ? <span className="text-body font-bold">Clear</span> : k}
          </button>
        ))}
      </div>
    </div>
  )
}
