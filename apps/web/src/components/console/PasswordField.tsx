'use client'

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { UiIcon } from '@/components/ui/icons'
import { passwordInputProblem, PASSWORD_RULES } from '@/lib/password-rules'
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
    /** Tampilkan daftar syarat yang tercentang sambil mengetik (untuk password baru). */
    checklist?: boolean
    /** Tampilkan * merah dan aria-required. */
    required?: boolean
  }
>(function PasswordField({ id, label, hint, error, labelAside, className, size = 'M', checklist = false, required, ...rest }, ref) {
  const auto = useId()
  const fid = id ?? `pw${auto.replace(/:/g, '')}`
  const [shown, setShown] = useState(false)
  const describedBy = [required ? `${fid}-req` : null, hint ? `${fid}-hint` : null, error ? `${fid}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} labelAside={labelAside} required={required}>
      <div className="relative">
        <input
          ref={ref}
          id={fid}
          type={shown ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            'w-full min-w-0 rounded-md border-2 bg-surface pr-[120px] pl-3.5 text-body text-fg',
            size === 'L' ? 'h-14' : 'h-12',
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
            size === 'L' ? 'top-1.5 h-11' : 'top-0.5 h-11',
          )}
        >
          {shown ? 'Sembunyikan' : 'Tampilkan'}
        </button>
        <span className="visually-hidden" aria-live="polite">
          {shown ? 'Password terlihat' : ''}
        </span>
      </div>
      {checklist ? <PasswordChecklist value={typeof rest.value === 'string' ? rest.value : ''} /> : null}
    </FieldShell>
  )
})

function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul aria-label="Syarat password" className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
      {PASSWORD_RULES.map((r) => {
        const met = r.test(value)
        return (
          <li key={r.key} className={cx('flex items-center gap-2 text-small transition-colors', met ? 'text-success' : 'text-fg-muted')}>
            <span aria-hidden="true" className={cx('inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2', met ? 'border-success bg-success text-bg' : 'border-divider')}>
              {met ? <UiIcon name="check" size={12} /> : null}
            </span>
            <span>{r.label}</span>
            <span className="visually-hidden">{met ? 'sudah terpenuhi' : 'belum terpenuhi'}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** Pemeriksaan di browser, sama dengan aturan di server. */
export const passwordProblem = passwordInputProblem
