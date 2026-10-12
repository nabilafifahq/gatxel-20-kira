'use client'

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { cx } from './cx'
import { controlBorder, FieldShell } from './Field'

/**
 * Kotak password (papan MasukDewasa): tombol Tampilkan di dalam kotak dengan
 * aria-pressed dan aria-controls, pengumuman lewat wilayah live. Paste tidak pernah
 * diblokir; autocapitalize dan spellcheck dimatikan.
 */
export const PasswordField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id' | 'size'> & {
    id?: string
    label: ReactNode
    hint?: ReactNode
    error?: string | null
    labelAside?: ReactNode
    autoComplete: 'current-password' | 'new-password'
    size?: 'M' | 'L'
  }
>(function PasswordField({ id, label, hint, error, labelAside, className, size = 'M', ...rest }, ref) {
  const auto = useId()
  const fid = id ?? `pw${auto.replace(/:/g, '')}`
  const [shown, setShown] = useState(false)
  const describedBy = [hint ? `${fid}-hint` : null, error ? `${fid}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} labelAside={labelAside}>
      <div className="relative">
        <input
          ref={ref}
          id={fid}
          type={shown ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            'w-full min-w-0 rounded-control border-2 bg-surface pr-[120px] pl-3.5 text-body text-fg',
            size === 'L' ? 'h-12' : 'h-11',
            controlBorder(error),
            className,
          )}
          {...rest}
        />
        <button
          type="button"
          aria-pressed={shown}
          aria-controls={fid}
          onClick={() => setShown((s) => !s)}
          className={cx(
            'absolute right-1.5 cursor-pointer rounded-sm border-0 bg-bg px-3 text-small font-bold text-fg hover:bg-divider',
            size === 'L' ? 'top-1.5 h-9' : 'top-1 h-9',
          )}
        >
          {shown ? 'Sembunyikan' : 'Tampilkan'}
        </button>
        <span className="visually-hidden" aria-live="polite">
          {shown ? 'Password terlihat' : ''}
        </span>
      </div>
    </FieldShell>
  )
})

/** Aturan password NIST SP 800-63B-4: panjang saja, tanpa aturan komposisi. */
export function passwordProblem(pw: string): string | null {
  const n = [...pw].length
  if (n === 0) return 'Isi password dulu.'
  if (n < 15) return `Password paling sedikit 15 karakter. Sekarang ${n} karakter.`
  if (n > 128) return `Password paling panjang 128 karakter. Sekarang ${n} karakter.`
  return null
}
