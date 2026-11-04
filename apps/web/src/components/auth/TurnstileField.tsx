'use client'

import { useEffect, useRef } from 'react'

type TurnstileApi = {
  render(el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; 'expired-callback': () => void; 'error-callback': () => void; theme?: string }): string
  remove(id: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/**
 * Widget Cloudflare Turnstile untuk halaman auth publik. Tidak merender apa pun tanpa siteKey.
 * Skrip dimuat hanya di sini (CSP halaman publik mengizinkan challenges.cloudflare.com; area learner tidak).
 * `resetKey` diubah pemanggil untuk meminta token baru setelah percobaan gagal.
 */
export function TurnstileField({ siteKey, onToken, resetKey = 0 }: { siteKey: string | null | undefined; onToken: (token: string | null) => void; resetKey?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useRef(onToken)
  cb.current = onToken

  useEffect(() => {
    if (!siteKey || !ref.current) return
    const host = ref.current
    let widget: string | null = null
    let cancelled = false
    const mount = () => {
      if (cancelled || !window.turnstile) return
      widget = window.turnstile.render(host, {
        sitekey: siteKey,
        callback: (t) => cb.current(t),
        'expired-callback': () => cb.current(null),
        'error-callback': () => cb.current(null),
      })
    }
    if (window.turnstile) mount()
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`)
      if (!s) {
        s = document.createElement('script')
        s.src = SRC
        s.async = true
        document.head.appendChild(s)
      }
      s.addEventListener('load', mount)
    }
    return () => {
      cancelled = true
      cb.current(null)
      if (widget && window.turnstile) window.turnstile.remove(widget)
    }
  }, [siteKey, resetKey])

  if (!siteKey) return null
  return <div ref={ref} className="min-h-[65px]" aria-label="Pemeriksaan keamanan" />
}
