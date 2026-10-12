import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'

/**
 * Header keamanan GTX-ENG-001 (assets/next.config.security.mjs).
 * CSP ber-nonce dipasang di src/proxy.ts karena semua halaman dinamis dan butuh sesi.
 * Mikrofon dan kamera diizinkan untuk origin sendiri (widget bicara dan foto jawaban).
 */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: [
      'accelerometer=()', 'autoplay=()', 'camera=(self)', 'display-capture=()', 'encrypted-media=()',
      'geolocation=()', 'gyroscope=()', 'magnetometer=()', 'microphone=(self)', 'midi=()', 'payment=()',
      'picture-in-picture=()', 'usb=()', 'xr-spatial-tracking=()', 'browsing-topics=()',
    ].join(', '),
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-XSS-Protection', value: '0' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: ['@kira/core', '@kira/content', '@kira/figures', '@kira/db'],
  serverExternalPackages: ['@node-rs/argon2', 'postgres'],
  experimental: { serverActions: { bodySizeLimit: '12mb' }, globalNotFound: true },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      { source: '/((?!_next/static|fonts|icons).*)', headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] },
    ]
  },
}

export default nextConfig
