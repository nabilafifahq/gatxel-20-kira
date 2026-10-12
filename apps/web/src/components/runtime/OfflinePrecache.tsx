'use client'

import { useEffect } from 'react'

/**
 * Minta service worker menyimpan halaman quest hari ini untuk dipakai offline.
 * Dijalankan setelah Today tampil, saat perangkat online dan service worker sudah aktif.
 */
export function OfflinePrecache({ urls }: { urls: string[] }) {
  const key = urls.join('|')
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !navigator.onLine) return
    let cancelled = false
    void navigator.serviceWorker.ready.then((reg) => {
      if (!cancelled) reg.active?.postMessage({ type: 'precache', urls: key.split('|') })
    })
    return () => {
      cancelled = true
    }
  }, [key])
  return null
}
