import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthCard, PublicFrame } from '@/screens/public/PublicFrame'
import { unsubscribeByToken } from '@/server/signup/service'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Berhenti berlangganan', referrer: 'no-referrer' }

/** Berhenti berlangganan satu klik: membuka tautan ini sudah cukup. Idempotent. */
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const kind = /^[A-Za-z0-9_-]{20,100}$/.test(token) ? await unsubscribeByToken(token) : null
  const ok = kind !== null
  return (
    <PublicFrame brandHref="/">
      <AuthCard labelledBy="berhenti-judul">
        <h1 id="berhenti-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
          {ok ? 'Anda sudah berhenti berlangganan' : 'Tautan ini tidak dikenal'}
        </h1>
        <p className="m-0 text-body text-fg-muted">
          {kind === 'account'
            ? 'Kami tidak akan mengirim kabar produk lagi ke alamat ini. Laporan belajar dan email penting soal akun tetap berjalan. Anda bisa mengaktifkannya lagi di halaman Privasi keluarga.'
            : ok
              ? 'Kami tidak akan mengirim kabar lagi ke alamat ini. Alamatnya dihapus dari daftar dalam 30 hari. Kalau ini keliru, Anda bisa mendaftar lagi kapan saja.'
              : 'Tautan berhenti berlangganan ini salah atau sudah dihapus. Kalau Anda masih menerima email dari Kira, balas email itu dan kami hentikan.'}
        </p>
        <Link href="/" className="font-bold">
          Ke halaman depan
        </Link>
      </AuthCard>
    </PublicFrame>
  )
}
