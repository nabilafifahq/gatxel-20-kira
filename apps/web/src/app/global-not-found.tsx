import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'Halaman tidak ada, Kira', robots: { index: false, follow: false } }

export default function GlobalNotFound() {
  return (
    <html lang="id" data-area="public">
      <body className="font-body text-fg bg-bg">
        <main className="mx-auto flex min-h-svh max-w-[560px] flex-col justify-center gap-4 p-6">
          <p className="text-small font-semibold text-fg-muted">Kode 404</p>
          <h1 className="text-h1 font-bold">Halaman ini tidak ada</h1>
          <p className="text-body-lg">Alamatnya mungkin salah ketik atau halamannya sudah dipindah. Kembali ke halaman awal untuk melanjutkan.</p>
          <p>
            <a href="/" className="inline-flex h-11 items-center rounded-control bg-fg px-5 font-bold text-white no-underline">
              Ke halaman awal
            </a>
          </p>
        </main>
      </body>
    </html>
  )
}
