import Link from 'next/link'
import { WaitlistForm } from '@/components/auth/WaitlistForm'

/**
 * Isi halaman saat kursi beta penuh: ramah, menjual yang jujur, dan form daftar tunggu.
 * Dipakai di /daftar dan di halaman depan. Tidak ada angka atau klaim yang tidak bisa dibuktikan.
 */
export function SeatsFull({ turnstileSiteKey, headingLevel = 1 }: { turnstileSiteKey: string | null; headingLevel?: 1 | 2 }) {
  const H = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <section aria-labelledby="penuh-judul" id="daftar-tunggu" className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <div className="flex flex-col gap-5">
        <H id="penuh-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
          Kursi beta sudah penuh
        </H>
        <p className="m-0 max-w-[56ch] text-body-lg text-fg-muted">
          Terima kasih sudah tertarik. Kami sengaja membuka Kira bertahap, supaya setiap keluarga yang masuk mendapat perhatian dan perbaikan yang cepat. Itu sebabnya kursinya terbatas.
        </p>
        <h3 className="m-0 mt-2 text-h3 font-bold">Kenapa layak ditunggu</h3>
        <ul className="m-0 flex max-w-[60ch] list-disc flex-col gap-2 pl-5 text-body">
          <li>Anak belajar sedikit tiap hari, dengan soal Math, English, dan Science yang naik tingkat pelan-pelan dari kelas 1 sampai 6.</li>
          <li>Kamu yang mengatur: batas waktu layar, izin data per tujuan, dan hapus akun anak kapan saja.</li>
          <li>Anak masuk dengan PIN gambar, tanpa email dan tanpa profil publik. Tidak ada iklan.</li>
          <li>Kamu membaca ringkasan mingguan dan tahu persis apa yang sudah dan belum dikuasai anak.</li>
        </ul>
        <p className="m-0 max-w-[60ch] text-body text-fg-muted">
          Begitu kursi dibuka lagi, kami kirim email ke alamat yang kamu tinggalkan di sini. Yang lebih dulu masuk daftar dikabari lebih dulu.
        </p>
        <p className="m-0 text-body">
          Sambil menunggu, baca{' '}
          <Link href="/panduan" className="font-bold">
            panduan orang tua
          </Link>{' '}
          atau{' '}
          <Link href="/privasi" className="font-bold">
            cara kami menjaga data anak
          </Link>
          .
        </p>
      </div>
      <div className="flex flex-col gap-4 rounded-card border border-divider bg-surface p-6 max-sm:p-5">
        <h2 className="m-0 text-h2 font-bold">Kabari saya saat kursi dibuka</h2>
        <WaitlistForm turnstileSiteKey={turnstileSiteKey} />
        <p className="m-0 text-small text-fg-muted">
          Kami menyimpan alamat emailmu hanya untuk kabar ini. Setiap email punya tautan berhenti berlangganan, dan kamu bisa berhenti kapan saja.
        </p>
      </div>
    </section>
  )
}
