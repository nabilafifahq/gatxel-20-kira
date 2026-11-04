'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { flushOutbox } from '@/lib/offline/outbox'

/**
 * Proses latar untuk layar learner: daftar service worker, kirim ulang jawaban offline,
 * dan detak waktu layar setiap 60 detik selama halaman terlihat.
 */
export function LearnerRuntime({ screenLimitMin }: { screenLimitMin: number }) {
  const router = useRouter()
  const [limitShown, setLimitShown] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }
    const flush = () => void flushOutbox()
    flush()
    window.addEventListener('online', flush)
    const t = window.setInterval(flush, 30000)
    return () => {
      window.removeEventListener('online', flush)
      window.clearInterval(t)
    }
  }, [])

  useEffect(() => {
    let stopped = false
    const ping = async () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      try {
        const res = await fetch('/api/heartbeat', { method: 'POST', credentials: 'same-origin' })
        if (!res.ok) return
        const body = (await res.json()) as { minutes: number; limit: number }
        if (!stopped && body.minutes >= body.limit && !limitShown) {
          const path = window.location.pathname
          // Ronde yang sedang jalan (runner dan arena) tidak diputus dan layar hasilnya tetap terbaca; ronde baru ditolak server
          // bila batas habis. Layar istirahat muncul pada detak berikutnya setelah anak keluar dari sana.
          if (path.startsWith('/run/') || path.includes('/play/') || path.startsWith('/results/') || path.startsWith('/world/boss/result/')) return
          setLimitShown(true)
          router.push('/today/done')
        }
      } catch {
        // offline: diam
      }
    }
    void ping()
    const t = window.setInterval(ping, 120000)
    return () => {
      stopped = true
      window.clearInterval(t)
    }
  }, [router, limitShown, screenLimitMin])

  return null
}
