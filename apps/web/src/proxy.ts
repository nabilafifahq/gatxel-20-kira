import { NextResponse, type NextRequest } from 'next/server'

/**
 * CSP ber-nonce untuk semua halaman (GTX-ENG-001, aplikasi terautentikasi).
 * Proxy bukan batas otorisasi: pemeriksaan sesi ada di DAL dan setiap action.
 * style-src memakai 'unsafe-inline' karena atribut style dari React tidak bisa diberi nonce.
 */
/** Halaman auth publik yang boleh memuat Cloudflare Turnstile (hanya bila dikonfigurasi). Area learner tidak pernah. */
const TURNSTILE_PATHS = [/^\/$/, /^\/beranda$/, /^\/daftar(\/|$)/, /^\/masuk$/, /^\/reset(\/|$)/]
const SESSION_COOKIE = '__Host-kira.session'
const DEVICE_COOKIE = '__Host-kira.device'

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const anonymousHome = path === '/' && !request.cookies.has(SESSION_COOKIE) && !request.cookies.has(DEVICE_COOKIE)
  const turnstile = Boolean(process.env.KIRA_TURNSTILE_SITE_KEY && process.env.KIRA_TURNSTILE_SECRET) && (path === '/' ? anonymousHome : TURNSTILE_PATHS.some((re) => re.test(path)))
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const dev = process.env.NODE_ENV !== 'production'
  // upgrade-insecure-requests hanya bila Kira memang dibuka lewat https (Cloudflare Tunnel). Di http://localhost
  // (CI, uji build produksi) arahan ini membuat browser pindah ke https yang tidak ada.
  const httpsOrigin = (process.env.KIRA_ORIGIN ?? '').startsWith('https://')
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${turnstile ? ' https://challenges.cloudflare.com' : ''}${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    `connect-src 'self'${turnstile ? ' https://challenges.cloudflare.com' : ''}`,
    ...(turnstile ? ["frame-src https://challenges.cloudflare.com"] : []),
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(!dev && httpsOrigin ? ['upgrade-insecure-requests'] : []),
  ].join('; ')

  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('Content-Security-Policy', csp)
  // Pengunjung tanpa sesi dan tanpa tablet terdaftar melihat halaman depan publik; alamat tetap /.
  const response = anonymousHome ? NextResponse.rewrite(new URL('/beranda', request.url), { request: { headers } }) : NextResponse.next({ request: { headers } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icons|sounds|dict|sw.js|manifest.webmanifest|fonts).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
