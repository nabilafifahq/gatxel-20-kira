import type { Metadata } from 'next'
import '../globals.css'

export const metadata: Metadata = { title: 'Cetak, Kira', robots: { index: false, follow: false } }

export default function PrintRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" data-area="print">
      <body className="font-body text-fg bg-white">{children}</body>
    </html>
  )
}
