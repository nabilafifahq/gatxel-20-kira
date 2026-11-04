import type { Metadata } from 'next'
import './globals.css'
import { KiraStar } from '@/components/ui/KiraStar'

export const metadata: Metadata = { title: 'Halaman tidak ada, Kira', robots: { index: false, follow: false } }

export default function GlobalNotFound() {
  return (
    <html lang="id" data-area="public">
      <body className="font-body text-fg bg-bg">
        <main className="mx-auto flex min-h-svh max-w-[560px] flex-col justify-center gap-4 p-6">
          <KiraStar size={96} mood="calm" />
          <p className="m-0 text-small font-bold">Kode 404</p>
          <h1 className="m-0 text-h1 font-semibold">Halaman ini tidak ada</h1>
          <p className="m-0 text-body-lg">Alamatnya mungkin salah ketik atau halamannya sudah dipindah. Kembali ke halaman awal untuk melanjutkan.</p>
          <p className="m-0">
            <a href="/" className="inline-flex h-12 items-center rounded-control border-2 border-fg bg-lilac px-5 font-extrabold text-fg no-underline">
              Ke halaman awal
            </a>
          </p>
        </main>
      </body>
    </html>
  )
}
