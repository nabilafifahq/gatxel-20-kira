'use client'

import '@fontsource/roboto/latin-500.css'
import { useEffect, useState } from 'react'
import { isEmbeddedBrowser } from '@/lib/embedded-browser'

/**
 * Tombol masuk Google sesuai panduan merek Google: logo G berwarna asli, tema terang, Roboto Medium, teks resmi berbahasa
 * Indonesia. Warna dan font dari token google-* di globals.css. Tautan biasa, tanpa skrip Google, dan tanpa prefetch.
 * Server sudah menyembunyikannya di WebView; pemeriksaan di browser berjaga bila halaman datang dari cache.
 */
export function GoogleButton({ next = null }: { next?: string | null }) {
  const [embedded, setEmbedded] = useState(false)
  useEffect(() => {
    setEmbedded(isEmbeddedBrowser(navigator.userAgent))
  }, [])
  if (embedded) return null
  const href = `/api/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ''}`
  return (
    <div className="flex flex-col gap-4">
      <a
        href={href}
        className="flex h-12 w-full items-center justify-center gap-2.5 rounded-control border border-google-border bg-google-surface px-3 font-google text-small font-medium text-google-text no-underline transition-colors hover:bg-google-hover hover:text-google-text focus-visible:bg-google-hover"
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 48 48" className="size-[18px] shrink-0">
          <path className="fill-google-red" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path className="fill-google-blue" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path className="fill-google-yellow" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path className="fill-google-green" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        Lanjutkan dengan Google
      </a>
      <div className="flex items-center gap-3 text-small text-fg-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-fg-muted/30" />
        atau
        <span className="h-px flex-1 bg-fg-muted/30" />
      </div>
    </div>
  )
}
