'use client'

import { useEffect, useId, useRef, type ReactElement, type ReactNode } from 'react'
import { cx } from './cx'

/**
 * Dialog dengan <dialog> asli dan showModal(): fokus terkurung, Escape menutup,
 * latar di belakang tidak bisa diklik. Fokus kembali ke elemen pemicu saat ditutup.
 * Dikendalikan dari luar lewat `open` dan `onClose`.
 */

export type DialogProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** Kalimat pendek di bawah judul. */
  description?: ReactNode
  children?: ReactNode
  /** Baris tombol di bawah. */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'full'
  /** learner: judul Mohave besar, border tinta. console: judul body tebal. */
  tone?: 'learner' | 'console'
  /** alertdialog untuk keadaan yang menuntut keputusan (waktu habis). */
  role?: 'dialog' | 'alertdialog'
  /** Escape dan klik latar menutup dialog. Matikan untuk keadaan yang tidak boleh dilewati. */
  dismissible?: boolean
  className?: string
  /** Elemen yang difokus pertama kali, lewat atribut data-autofocus di dalam isi. */
  initialFocus?: 'first' | 'none'
  /** Rata tengah untuk dialog keadaan (misalnya waktu habis). */
  align?: 'start' | 'center'
}

const WIDTH: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'w-[min(440px,calc(100vw-32px))]',
  md: 'w-[min(600px,calc(100vw-32px))]',
  lg: 'w-[min(840px,calc(100vw-32px))]',
  full: 'w-[calc(100vw-32px)] h-[calc(100svh-32px)]',
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  tone = 'learner',
  role = 'dialog',
  dismissible = true,
  className,
  initialFocus = 'first',
  align = 'start',
}: DialogProps): ReactElement {
  const ref = useRef<HTMLDialogElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      try {
        d.showModal()
      } catch {
        d.setAttribute('open', '')
      }
      if (initialFocus === 'first') {
        const auto = d.querySelector<HTMLElement>('[data-autofocus]')
        if (auto) auto.focus()
      }
    }
    if (!open && d.open) {
      d.close()
    }
  }, [open, initialFocus])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    const handleClose = () => {
      const target = returnTo.current
      returnTo.current = null
      if (target && document.contains(target)) {
        // Tunggu satu frame supaya dialog benar-benar tertutup sebelum fokus pindah.
        requestAnimationFrame(() => target.focus())
      }
    }
    d.addEventListener('close', handleClose)
    return () => d.removeEventListener('close', handleClose)
  }, [])

  // Tutup dialog yang masih terbuka saat komponen dilepas.
  useEffect(() => {
    const d = ref.current
    return () => {
      if (d?.open) d.close()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      role={role === 'alertdialog' ? 'alertdialog' : undefined}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      aria-modal="true"
      onCancel={(e) => {
        e.preventDefault()
        if (dismissible) onCloseRef.current()
      }}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onCloseRef.current()
      }}
      className={cx(
        'm-auto max-h-[calc(100svh-32px)] overflow-visible border-0 bg-transparent p-0 text-fg',
        WIDTH[size],
        className,
      )}
    >
      {open ? (
        <div
          className={cx(
            'flex max-h-[calc(100svh-32px)] flex-col gap-4 overflow-y-auto rounded-card bg-surface',
            tone === 'learner' ? 'border-2 border-fg p-6 sm:p-8' : 'border border-divider p-6',
            size === 'full' && 'h-full',
            align === 'center' && 'items-center text-center',
          )}
        >
          <h2
            id={titleId}
            className={cx('m-0', tone === 'learner' ? 'font-display text-h1 font-semibold' : 'text-h2 font-bold')}
          >
            {title}
          </h2>
          {description ? (
            <p id={descId} className={cx('m-0', tone === 'learner' ? 'text-body-lg' : 'text-body text-fg-muted')}>
              {description}
            </p>
          ) : null}
          {children}
          {footer ? <div className={cx('mt-2 flex flex-wrap gap-3', align === 'center' ? 'justify-center' : 'justify-end')}>{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  )
}
