'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { cx } from './cx'
import { UiIcon } from './icons'

/**
 * Toast untuk kejadian sistem yang tidak mendesak (papan Toast). role="status",
 * tanpa tombol di dalamnya. Hilang sendiri setelah 6 detik, error 10 detik,
 * jeda saat disentuh atau difokus. Error selalu membawa kode referensi.
 * Learner: tengah atas. Konsol: kanan bawah.
 */

export type ToastKind = 'success' | 'info' | 'error'
export type ToastInput = { kind: ToastKind; title: string; body?: string; reference?: string }
type ToastItem = ToastInput & { id: number }

type Area = 'learner' | 'console'

const ToastContext = createContext<{ show: (t: ToastInput) => void; area: Area } | null>(null)

export function ToastProvider({ children, area = 'learner' }: { children: ReactNode; area?: Area }): ReactElement {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const show = useCallback((t: ToastInput) => {
    const id = nextId.current++
    setItems((list) => [...list.slice(-2), { ...t, id }])
  }, [])
  const dismiss = useCallback((id: number) => setItems((list) => list.filter((x) => x.id !== id)), [])
  const value = useMemo(() => ({ show, area }), [show, area])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className={cx(
          'pointer-events-none fixed z-50 flex flex-col gap-3 px-4',
          area === 'learner' ? 'inset-x-0 top-24 items-center' : 'right-0 bottom-6 items-end',
        )}
      >
        {items.map((t) => (
          <TimedToast key={t.id} toast={t} area={area} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** Menampilkan toast. Di luar ToastProvider fungsi ini tidak melakukan apa pun. */
export function useToast(): (t: ToastInput) => void {
  const ctx = useContext(ToastContext)
  return ctx?.show ?? noop
}

function noop(): void {}

function TimedToast({ toast, area, onDone }: { toast: ToastItem; area: Area; onDone: () => void }): ReactElement {
  const [paused, setPaused] = useState(false)
  const remaining = useRef(toast.kind === 'error' ? 10_000 : 6_000)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })
  useEffect(() => {
    if (paused) return
    const started = Date.now()
    const timer = window.setTimeout(() => doneRef.current(), remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current = Math.max(800, remaining.current - (Date.now() - started))
    }
  }, [paused])
  return (
    <div
      className="pointer-events-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onPointerDown={() => setPaused(true)}
    >
      <Toast toast={toast} area={area} />
    </div>
  )
}

/** Tampilan satu toast. Bisa dipakai langsung untuk galeri atau pesan inline. */
export function Toast({ toast, area = 'learner', className }: { toast: ToastInput; area?: Area; className?: string }): ReactElement {
  const learner = area === 'learner'
  const isError = toast.kind === 'error'
  return (
    <div
      role="status"
      lang={learner ? 'en-GB' : 'id'}
      className={cx(
        'motion-fade flex max-w-[min(560px,calc(100vw-32px))] items-start gap-3 rounded-control border-2 bg-surface starting:-translate-y-2 starting:opacity-0',
        isError ? 'border-danger' : 'border-fg',
        learner ? 'px-5 py-4' : 'px-4.5 py-3.5',
        className,
      )}
    >
      <UiIcon
        name={isError ? 'warning' : toast.kind === 'success' ? 'check-circle' : 'info'}
        size={learner ? 24 : 22}
        className={cx('mt-0.5', isError ? 'text-danger' : toast.kind === 'success' ? 'text-success' : 'text-fg')}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className={cx('font-semibold', learner ? 'text-body-lg' : 'text-body')}>{toast.title}</div>
        {toast.body ? <div className={learner ? 'text-body-lg' : 'text-body'}>{toast.body}</div> : null}
        {toast.reference ? (
          <div className={cx('tabular-nums text-fg-muted', learner ? 'text-body' : 'text-small')}>
            {learner ? `Reference ${toast.reference}` : `Kode referensi ${toast.reference}`}
          </div>
        ) : null}
      </div>
    </div>
  )
}
