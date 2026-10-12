import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'
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

const baseConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  // Pencarian folder content/ di packages/content/src/load.ts membuat pelacak berkas menyalin seluruh repo.
  // Server standalone hanya butuh hasil build dan node_modules; konten disalin terpisah ke image Docker.
  outputFileTracingExcludes: {
    '**': [
      './src/**/*', './test/**/*', './.env*', '../../content/**/*', '../../docs/**/*', '../../apps/worker/**/*',
      '../../apps/android/**/*', '../../e2e/**/*', '../../scripts/**/*', '../../.kira-local/**/*', '../../.git/**/*',
      '../../packages/*/test/**/*', '../../packages/*/scripts/**/*', '../../deploy/**/*', '../../.github/**/*',
    ],
  },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  devIndicators: false,
  // Jangan pernah mencatat argumen Server Action (bisa berisi password atau PIN).
  logging: { serverFunctions: false, incomingRequests: { ignore: [/\/api\/heartbeat/] } },
  transpilePackages: ['@kira/core', '@kira/content', '@kira/figures', '@kira/db'],
  serverExternalPackages: ['@node-rs/argon2', 'postgres'],
  // 61 MB: PDF paket resmi sampai 60 MB lewat Server Action impor (T12). Semua action tetap memeriksa sesi.
  experimental: { serverActions: { bodySizeLimit: '61mb' }, globalNotFound: true },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      { source: '/((?!_next/static|fonts|icons).*)', headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] },
    ]
  },
}

/**
 * Galeri pengembangan di app/(dev) memakai berkas page.dev.tsx dan layout.dev.tsx. Ekstensi itu hanya
 * dikenali oleh server pengembangan, jadi build produksi tidak memuat galeri dan data contohnya.
 */
export default function nextConfig(phase: string): NextConfig {
  const dev = phase === PHASE_DEVELOPMENT_SERVER
  return { ...baseConfig, pageExtensions: dev ? ['tsx', 'ts', 'dev.tsx'] : ['tsx', 'ts'] }
}
