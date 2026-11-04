'use client'

import { useEffect, type ReactElement } from 'react'
import { KiraStar } from '@/components/ui/KiraStar'
import { CHUNK_RELOAD_KEY, isChunkError, mayAutoReload } from './route-error-logic'

const COPY = {
  learner: {
    chunkTitle: 'Kira has something new for you',
    title: 'Oops, this page got stuck',
    chunkBody: 'Tap the button to carry on. Your stars and answers are safe.',
    body: 'Your stars and answers are safe. Try again, or go back to Today.',
    retry: 'Try again',
    home: 'Back to Today',
    homeHref: '/today',
    code: 'Code for a grown-up',
  },
  family: {
    chunkTitle: 'Kira baru saja diperbarui',
    title: 'Halaman ini gagal dimuat',
    chunkBody: 'Muat ulang untuk memakai versi terbaru. Data kamu tetap aman.',
    body: 'Data kamu tetap aman. Coba lagi, atau kembali ke halaman awal.',
    retry: 'Coba lagi',
    home: 'Ke halaman awal',
    homeHref: '/',
    code: 'Kode',
  },
} as const

/**
 * Layar galat ramah untuk semua area. Chunk yang hilang (deployment baru) dimuat ulang sekali secara otomatis;
 * galat lain menampilkan tombol coba lagi. Tautan keluar memakai <a> supaya navigasi penuh, karena router klien
 * mungkin yang sedang rusak.
 */
export function RouteError({ error, reset, area }: { error: Error & { digest?: string }; reset: () => void; area: keyof typeof COPY }): ReactElement {
  const chunk = isChunkError(error)
  const t = COPY[area]

  useEffect(() => {
    if (!chunk) return
    try {
      const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY)) || null
      if (!mayAutoReload(last, Date.now())) return
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
    } catch {
      return // Tanpa penyimpanan tidak ada penjaga putaran: biarkan anak mengetuk tombol.
    }
    window.location.reload()
  }, [chunk])

  return (
    <main className="mx-auto flex min-h-svh max-w-[560px] flex-col items-center justify-center gap-4 p-6 text-center">
      <KiraStar size={96} mood="calm" />
      <h1 className="m-0 font-display text-h1 font-bold">{chunk ? t.chunkTitle : t.title}</h1>
      <p className="m-0 text-body-lg">{chunk ? t.chunkBody : t.body}</p>
      <button
        type="button"
        onClick={() => (chunk ? window.location.reload() : reset())}
        className="h-14 cursor-pointer rounded-control border-2 border-fg bg-lilac px-6 text-h3 font-extrabold text-fg"
      >
        {t.retry}
      </button>
      <a href={t.homeHref} className="inline-flex min-h-11 items-center text-body font-bold text-fg underline underline-offset-3">
        {t.home}
      </a>
      {error.digest ? (
        <p className="m-0 text-small text-fg-muted">
          {t.code}: {error.digest}
        </p>
      ) : null}
    </main>
  )
}
