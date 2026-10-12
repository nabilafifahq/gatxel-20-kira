'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from './cx'
import { ConsoleIcon } from './icons'

/**
 * Toast konsol (papan Toast): kanan bawah, garis 2px --fg (sukses) atau --danger (error).
 * Tanpa tombol di dalam toast. Hilang setelah 6 detik, error 10 detik, jeda saat disentuh
 * atau difokus. Error juga harus tampil inline di dekat penyebabnya; toast bukan satu-satunya salinan.
 *
 * `useToast()` mengirim event ke wilayah toast terdekat di halaman, jadi bisa dipanggil
 * dari komponen layar yang merender ConsoleShell (di luar provider).
 */

export type ToastInput = { tone: 'success' | 'error' | 'info'; title: string; body?: string; reference?: string }
type ToastItem = ToastInput & { id: number }

const EVENT = 'kira:toast'

export function useToast(): (t: ToastInput) => void {
  return useCallback((t: ToastInput) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<ToastInput>(EVENT, { detail: t }))
  }, [])
}

export function ToastProvider({ children }: { children?: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastInput>).detail
      seq.current += 1
      const id = seq.current
      setItems((list) => [...list.slice(-2), { ...detail, id }])
    }
    window.addEventListener(EVENT, onToast)
    return () => window.removeEventListener(EVENT, onToast)
  }, [])
  const remove = useCallback((id: number) => setItems((list) => list.filter((x) => x.id !== id)), [])
  return (
    <>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(560px,calc(100%-32px))] flex-col items-end gap-2 max-lg:bottom-[88px]"
      >
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onDone={remove} />
        ))}
      </div>
    </>
  )
}

function ToastCard({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const [paused, setPaused] = useState(false)
  const [shown, setShown] = useState(false)
  const left = useRef(item.tone === 'error' ? 10000 : 6000)
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(r)
  }, [])
  useEffect(() => {
    if (paused) return
    const started = Date.now()
    const h = window.setTimeout(() => onDone(item.id), left.current)
    return () => {
      window.clearTimeout(h)
      left.current -= Date.now() - started
    }
  }, [paused, onDone, item.id])
  const isError = item.tone === 'error'
  return (
    <div
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      className={cx(
        'pointer-events-auto flex max-w-full items-start gap-3 rounded-control border-2 bg-surface px-[18px] py-3.5 transition-[opacity,translate] duration-240 ease-kira',
        isError ? 'border-danger' : 'border-fg',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
    >
      <ConsoleIcon
        name={isError ? 'alert' : item.tone === 'success' ? 'checkCircle' : 'infoCircle'}
        size={22}
        strokeWidth={2.5}
        className={cx('mt-0.5', isError ? 'text-danger' : item.tone === 'success' ? 'text-success' : 'text-fg')}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body font-semibold">{item.title}</span>
        {item.body ? <span className="text-body">{item.body}</span> : null}
        {item.reference ? (
          <span className="text-small text-fg-muted tabular">
            Kode referensi <span className="select-all">{item.reference}</span>
          </span>
        ) : null}
      </div>
    </div>
  )
}
