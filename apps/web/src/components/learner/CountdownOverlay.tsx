'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { playSfx, primeSfx } from './sfx'

/**
 * Hitung mundur 3, 2, 1, Go sebelum ronde berwaktu mulai (sprint dan ronde arena). Overlay menutup layar
 * tetapi bukan dialog modal dan tidak memindahkan fokus; `onGo` dipanggil tepat saat "Go" muncul sehingga
 * waktu tidak berjalan selama hitung mundur. Tiap angka berbunyi (count), Go berbunyi go.
 * Reduced motion: angka berganti tanpa membesar atau mengecil.
 */
export const COUNTDOWN_STEP_MS = 800

export function CountdownOverlay({
  from = 3,
  onGo,
  onDone,
}: {
  from?: number
  onGo?: () => void
  onDone?: () => void
}): ReactElement | null {
  const [n, setN] = useState(from)
  const [open, setOpen] = useState(true)
  const go = useRef(onGo)
  const done = useRef(onDone)
  useEffect(() => {
    go.current = onGo
    done.current = onDone
  }, [onGo, onDone])
  useEffect(() => {
    primeSfx()
  }, [])
  useEffect(() => {
    if (n > 0) {
      playSfx('count')
      const id = window.setTimeout(() => setN(n - 1), COUNTDOWN_STEP_MS)
      return () => window.clearTimeout(id)
    }
    playSfx('go')
    go.current?.()
    const id = window.setTimeout(() => {
      setOpen(false)
      done.current?.()
    }, 700)
    return () => window.clearTimeout(id)
  }, [n])
  if (!open) return null
  const label = n > 0 ? String(n) : 'Go!'
  return (
    <div
      role="status"
      aria-live="assertive"
      aria-label={label}
      className="kira-fade-in fixed inset-0 z-50 flex items-center justify-center bg-bg/95"
    >
      <span
        key={n}
        aria-hidden="true"
        className={cx(
          'kira-count font-display text-[160px] leading-none font-semibold tabular-nums',
          n > 0 ? 'text-fg' : 'text-success',
        )}
      >
        {label}
      </span>
    </div>
  )
}
