import type { Metadata, Viewport } from 'next'
import '../globals.css'
import { FontPreload } from '@/components/ui/FontPreload'
import { htmlLang } from '@/lib/i18n'
import { I18nProvider } from '@/lib/i18n/client'
import { getLang } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: { default: 'Kira', template: '%s, Kira' },
  robots: { index: false, follow: false },
  icons: { icon: [{ url: '/favicon.ico', sizes: '48x48' }, { url: '/icons/icon.svg', type: 'image/svg+xml' }], apple: '/icons/apple-touch-icon.png' },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#fffcf5' }

export default async function LearnerRootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang()
  return (
    <html lang={htmlLang(lang)} data-area="learner">
      <head>
        <FontPreload />
      </head>
      <body className="font-body text-fg bg-bg">
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  )
}
