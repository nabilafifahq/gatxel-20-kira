'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

/** Status jaringan perangkat. Di server dan render pertama dianggap online. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb)
      window.addEventListener('offline', cb)
      return () => {
        window.removeEventListener('online', cb)
        window.removeEventListener('offline', cb)
      }
    },
    () => navigator.onLine,
    () => true,
  )
}

/** Cocokkan media query. Di server selalu false. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/** Kata untuk perangkat ini di kalimat learner: tablet atau phone. */
export function useDeviceWord(): 'tablet' | 'phone' {
  return useMediaQuery('(max-width: 599px)') ? 'phone' : 'tablet'
}

/** Detik berjalan sejak `startMs`, diperbarui setiap detik selama `running`. */
export function useTicker(running: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [running, intervalMs])
  return now
}
