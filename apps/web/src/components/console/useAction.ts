'use client'

import { useCallback, useRef, useState } from 'react'
import type { ActionResult } from '@/lib/dto'

export type ActionFailure = { message: string; reference: string; fieldErrors?: Record<string, string> }

/** Kode untuk kegagalan jaringan di sisi perangkat (server tidak pernah menerima permintaan). */
function networkReference(): string {
  const n = Math.floor(Math.random() * 0xffff)
  return `NET-${n.toString(16).toUpperCase().padStart(4, '0')}`
}

/**
 * Menjalankan action server dan mencatat status memuat serta error-nya.
 * Error jaringan (fungsi melempar) diubah menjadi ActionResult gagal dengan kode NET.
 */
export function useAction<A extends unknown[], T>(fn: (...args: A) => Promise<ActionResult<T>>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ActionFailure | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const run = useCallback(async (...args: A): Promise<ActionResult<T>> => {
    setPending(true)
    setError(null)
    try {
      const r = await fnRef.current(...args)
      if (!r.ok) setError({ message: r.message, reference: r.reference, fieldErrors: r.fieldErrors })
      return r
    } catch {
      const r: ActionResult<T> = {
        ok: false,
        message: 'Koneksi ke server Kira terputus.',
        reference: networkReference(),
      }
      setError({ message: r.message, reference: r.reference })
      return r
    } finally {
      setPending(false)
    }
  }, [])

  const reset = useCallback(() => setError(null), [])
  return { run, pending, error, reset }
}
