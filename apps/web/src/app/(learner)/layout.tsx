import type { Metadata, Viewport } from 'next'
import '../globals.css'

export const metadata: Metadata = {
  title: { default: 'Kira', template: '%s, Kira' },
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f5f8fc' }

export default function LearnerRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" data-area="learner">
      <body className="font-body text-fg bg-bg">{children}</body>
    </html>
  )
}
