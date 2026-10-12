'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { cx } from './cx'
import { TextField } from './Field'
import { ConsoleIcon } from './icons'

/**
 * Dialog modal dengan elemen <dialog> dan showModal(). Escape menutup dialog,
 * fokus kembali ke elemen pemicu. Isi yang panjang bergulir di dalam dialog.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeLabel = 'Tutup',
  dismissible = true,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeLabel?: string
  /** false: Escape dan klik latar tidak menutup (misalnya saat menyimpan). */
  dismissible?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const auto = useId()
  const tid = `d${auto.replace(/:/g, '')}-t`
  const did = `d${auto.replace(/:/g, '')}-d`

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      d.showModal()
      // Kontrol dengan data-autofocus (misalnya isian pertama) menerima fokus awal, bukan tombol Tutup.
      d.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    } else if (!open && d.open) {
      d.close()
    }
  }, [open])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    const onDialogClose = () => {
      const el = opener.current
      opener.current = null
      if (el && el.isConnected) el.focus()
    }
    d.addEventListener('close', onDialogClose)
    return () => d.removeEventListener('close', onDialogClose)
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={tid}
      aria-describedby={description ? did : undefined}
      onCancel={(e) => {
        e.preventDefault()
        if (dismissible) onClose()
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose()
      }}
      className={cx(
        'm-auto max-h-[calc(100svh-32px)] w-[calc(100%-32px)] overflow-hidden rounded-card border-0 bg-surface p-0 text-fg',
        size === 'sm' && 'max-w-[440px]',
        size === 'md' && 'max-w-[540px]',
        size === 'lg' && 'max-w-[720px]',
        size === 'xl' && 'max-w-[960px]',
      )}
    >
      {open ? (
        <div className="flex max-h-[calc(100svh-32px)] flex-col">
          <div className="flex items-start gap-3 px-7 pt-7 pb-2 max-sm:px-5 max-sm:pt-5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 id={tid} className="m-0 text-h2 font-bold">
                {title}
              </h2>
              {description ? (
                <p id={did} className="m-0 text-body">
                  {description}
                </p>
              ) : null}
            </div>
            {dismissible ? (
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="-mt-1 -mr-2 inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-control border-0 bg-transparent text-fg hover:bg-bg"
              >
                <ConsoleIcon name="x" size={20} strokeWidth={2.5} />
              </button>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 pt-2 pb-2 max-sm:px-5">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-3 px-7 pt-4 pb-7 max-sm:px-5 max-sm:pb-5">{footer}</div> : <div className="h-5" />}
        </div>
      ) : null}
    </dialog>
  )
}

/**
 * Konfirmasi untuk aksi yang serius. Menyebut akibatnya. `confirmText` mewajibkan
 * mengetik teks yang sama persis (misalnya nama learner) sebelum aksi jalan.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  warning,
  confirmLabel,
  cancelLabel = 'Batal',
  tone = 'danger',
  onConfirm,
  confirmText,
  confirmTextLabel,
  error,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  body: ReactNode
  warning?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  onConfirm: () => Promise<void> | void
  confirmText?: string
  confirmTextLabel?: ReactNode
  error?: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [typed, setTyped] = useState('')
  const [typedError, setTypedError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTyped('')
      setTypedError(null)
      setBusy(false)
    }
  }, [open])

  async function run() {
    if (confirmText && typed.trim() !== confirmText) {
      setTypedError(`Ketik ${confirmText} persis seperti tertulis untuk melanjutkan.`)
      return
    }
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={run} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="text-body">{body}</div>
        {warning ? (
          <div role="note" className="flex items-start gap-2.5 rounded-control border-2 border-warn bg-surface px-4 py-3.5">
            <ConsoleIcon name="alert" size={22} strokeWidth={2.5} className="text-warn" />
            <div className="text-body">{warning}</div>
          </div>
        ) : null}
        {confirmText ? (
          <TextField
            label={confirmTextLabel ?? `Ketik ${confirmText} untuk melanjutkan`}
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value)
              setTypedError(null)
            }}
            autoComplete="off"
            spellCheck={false}
            error={typedError}
          />
        ) : null}
        {error ? <div role="alert">{error}</div> : null}
      </div>
    </Dialog>
  )
}
