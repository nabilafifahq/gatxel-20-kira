import Link from 'next/link'
import { AuthCard } from '@/screens/public/PublicFrame'

/** Layar ramah saat kursi habis tepat ketika email dikonfirmasi: pendaftar otomatis masuk daftar tunggu. */
export function WaitlistFull() {
  return (
    <AuthCard labelledBy="penuh-vf">
      <h1 id="penuh-vf" className="m-0 text-h1 font-bold max-sm:text-h2">
        Kursi beta baru saja penuh
      </h1>
      <p className="m-0 text-body text-fg-muted">
        Email Anda sudah terkonfirmasi, tetapi kursi terakhir diambil beberapa saat sebelum Anda menekan tombol. Maaf, ini bukan salah Anda.
      </p>
      <p className="m-0 text-body">
        Kami sudah memasukkan Anda ke daftar tunggu. Begitu kursi dibuka lagi, kami kirim email ke alamat yang sama. Setiap email punya tautan untuk berhenti.
      </p>
      <p className="m-0 text-small text-fg-muted">
        Password yang Anda buat tidak disimpan. Saat kursi dibuka, Anda mendaftar lagi dengan password baru.{' '}
        <Link href="/" className="font-bold">
          Kembali ke halaman depan
        </Link>
      </p>
    </AuthCard>
  )
}
