'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { flushOutbox } from '@/lib/offline/outbox'
import { CHUNK_RELOAD_KEY, mayAutoReload } from './route-error-logic'

/**
 * Proses latar untuk layar learner: daftar service worker, kirim ulang jawaban offline,
 * dan detak waktu layar setiap 60 detik selama halaman terlihat.
 */
export function LearnerRuntime({ screenLimitMin }: { screenLimitMin: number }) {
  const router = useRouter()
  const [limitShown, setLimitShown] = useState(false)

  // Deployment baru saat tab terbuka: id Server Action di tab ini sudah tidak dikenal server dan semua aksinya akan terus gagal.
  // Kirim dulu jawaban yang tertahan lewat /api/sync, lalu muat ulang sekali untuk mengambil versi baru. Penjaga waktunya sama dengan chunk lama.
  useEffect(() => {
    const original = window.fetch
    let reloading = false
    window.fetch = async (...args) => {
      const res = await original(...args)
      if (!reloading && res.headers.get('x-nextjs-action-not-found') === '1') {
        reloading = true
        try {
          const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY)) || null
          if (mayAutoReload(last, Date.now())) {
            sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
            void Promise.race([flushOutbox().catch(() => 0), new Promise((r) => window.setTimeout(r, 3000))]).then(() => window.location.reload())
          }
        } catch {
          // Tanpa penyimpanan tidak ada penjaga putaran: tombol coba lagi dan pindah layar tetap ada.
        }
      }
      return res
    }
    return () => {
      window.fetch = original
    }
  }, [])

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
