import type { Metadata, Viewport } from 'next'
import '../globals.css'

export const metadata: Metadata = {
  title: { default: 'Kira', template: '%s, Kira' },
  robots: { index: false, follow: false },
  icons: { icon: [{ url: '/favicon.ico', sizes: '48x48' }, { url: '/icons/icon.svg', type: 'image/svg+xml' }], apple: '/icons/apple-touch-icon.png' },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f5f8fc' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-area="console">
      <body className="font-body text-fg bg-bg">{children}</body>
    </html>
  )
}
