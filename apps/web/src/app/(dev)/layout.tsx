import { notFound } from 'next/navigation'
import '../globals.css'

/** Galeri komponen untuk pengembangan. Tidak tersedia di produksi. */
export default function DevRootLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <html lang="en-GB" data-area="learner">
      <body className="font-body text-fg bg-bg">{children}</body>
    </html>
  )
}
