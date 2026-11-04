'use client'

import { useEffect, useId, useRef, type ReactElement } from 'react'
import type { Subject } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { useT } from '@/lib/i18n/client'

/**
 * Keypad angka (papan NumericKeypad). Tombol 64 px dengan angka Andika, juga menerima
 * keyboard fisik: angka, Backspace, Delete atau Escape untuk mengosongkan, titik atau koma
 * untuk desimal, minus untuk tanda negatif. Kotak jawaban memakai border 3 px warna mapel
 * saat aktif dan kembali ke --divider saat umpan balik terbuka.
 */

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'clear' | 'del' | 'dot' | 'sign'

export function applyKey(value: string, key: KeypadKey, opts: { maxLength: number; decimalChar: string }): string {
  if (key === 'clear') return ''
  if (key === 'del') return value.slice(0, -1)
  if (key === 'sign') return value.startsWith('-') ? value.slice(1) : `-${value}`
  const digits = value.replace('-', '')
  if (digits.replace(/[.,]/g, '').length >= opts.maxLength) return value
  if (key === 'dot') {
    if (/[.,]/.test(value)) return value
    return `${value === '' || value === '-' ? `${value}0` : value}${opts.decimalChar}`
  }
  if (digits === '0') return `${value.startsWith('-') ? '-' : ''}${key}`
  return value + key
}

const DIGITS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del']

export function NumericKeypad({
  value,
  onChange,
  disabled = false,
  feedback = null,
  allowDecimal = false,
  allowNegative = false,
  decimalChar = '.',
  unit,
  maxLength = 6,
  physicalKeyboard = true,
  size = 'L',
  label: labelProp,
  showLabel = true,
  className,
}: {
  value: string
  onChange: (v: string) => void
  subject: Subject
  disabled?: boolean
  feedback?: 'correct' | 'not-yet' | null
  allowDecimal?: boolean
  allowNegative?: boolean
  decimalChar?: '.' | ','
  unit?: string
  maxLength?: number
  physicalKeyboard?: boolean
  size?: 'L' | 'M'
  label?: string
  showLabel?: boolean
  className?: string
}): ReactElement {
  const dict = useT()
  const label = labelProp ?? dict.widgets.shared.yourAnswer
  const outputId = useId()
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    valueRef.current = value
    onChangeRef.current = onChange
  })

  const press = (k: KeypadKey) => {
    if (disabled) return
    const next = applyKey(valueRef.current, k, { maxLength, decimalChar })
    if (next !== valueRef.current) {
      valueRef.current = next
      onChangeRef.current(next)
    }
  }

  useEffect(() => {
    if (!physicalKeyboard || disabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (t?.closest('dialog[open]')) return
      let k: KeypadKey | null = null
      if (/^[0-9]$/.test(e.key)) k = e.key as KeypadKey
      else if (e.key === 'Backspace') k = 'del'
      else if (e.key === 'Delete' || e.key === 'Escape') k = 'clear'
      else if ((e.key === '.' || e.key === ',') && allowDecimal) k = 'dot'
      else if (e.key === '-' && allowNegative) k = 'sign'
      if (!k) return
      e.preventDefault()
      const next = applyKey(valueRef.current, k, { maxLength, decimalChar })
      if (next !== valueRef.current) {
        valueRef.current = next
        onChangeRef.current(next)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [physicalKeyboard, disabled, allowDecimal, allowNegative, maxLength, decimalChar])

  const extras: KeypadKey[] = [...(allowNegative ? (['sign'] as const) : []), ...(allowDecimal ? (['dot'] as const) : [])]
  const keyH = size === 'L' ? 'h-16' : 'h-13'
  const keyBase = cx(
    'flex items-center justify-center rounded-control border-2 p-0 font-bold transition-transform duration-150 ease-kira',
    keyH,
    disabled
      ? 'cursor-not-allowed border-lavender bg-lavender text-fg/55'
      : 'cursor-pointer border-border bg-surface text-fg enabled:hover:-translate-y-px enabled:active:translate-y-0.5 active:bg-lilac',
  )

  const keyLabel = (k: KeypadKey) => (k === 'clear' ? dict.widgets.shared.clear : k === 'del' ? dict.widgets.keypad.delete : k === 'dot' ? dict.widgets.keypad.decimalPoint : k === 'sign' ? dict.widgets.keypad.minusSign : k)

  return (
    <div className={cx('flex w-full flex-col gap-2.5', size === 'L' ? 'max-w-[360px]' : 'max-w-[358px]', className)}>
      {showLabel ? (
        <label htmlFor={outputId} className="text-body font-semibold text-fg-muted">
          {label}
        </label>
      ) : null}
      <output
        id={outputId}
        aria-live="polite"
        aria-label={showLabel ? undefined : label}
        className={cx(
          'flex items-center rounded-md px-5 font-numbers text-[40px] leading-[48px] font-bold tabular-nums',
          size === 'L' ? 'h-18' : 'h-14',
          feedback === 'correct'
            ? 'border-3 border-success bg-surface'
            : feedback === 'not-yet'
              ? 'border-3 border-dashed border-fg bg-lavender'
              : disabled
                ? 'border-2 border-lavender bg-lavender'
                : 'border-3 border-fg bg-surface ring-4 ring-lilac',
        )}
      >
        <span className="min-w-0 flex-1 truncate">{value}</span>
        {unit ? <span className="ml-2 text-h3 text-fg-muted">{unit}</span> : null}
      </output>
      <div className={cx('grid grid-cols-3', size === 'L' ? 'gap-3' : 'gap-2')}>
        {DIGITS.map((k) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            aria-label={keyLabel(k)}
            onClick={() => press(k)}
            className={cx(keyBase, k === 'clear' ? 'text-body font-extrabold' : k === 'del' ? 'bg-lavender' : 'font-numbers text-[30px]')}
          >
            {k === 'del' ? <UiIcon name="backspace" size={28} /> : k === 'clear' ? dict.widgets.shared.clear : k}
          </button>
        ))}
      </div>
      {extras.length > 0 ? (
        <div className={cx('grid', extras.length === 2 ? 'grid-cols-2' : 'grid-cols-1', size === 'L' ? 'gap-3' : 'gap-2')}>
          {extras.map((k) => (
            <button
              key={k}
              type="button"
              disabled={disabled}
              aria-label={keyLabel(k)}
              onClick={() => press(k)}
              className={cx(keyBase, 'font-numbers text-[30px]')}
            >
              {k === 'sign' ? '−' : decimalChar}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
