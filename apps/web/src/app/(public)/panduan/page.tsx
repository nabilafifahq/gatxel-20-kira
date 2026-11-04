import type { Metadata } from 'next'
import Link from 'next/link'
import { GuideLayout, GuideSection } from '@/screens/public/GuideLayout'
import { privacyNoticeData } from '@/server/legal'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Panduan orang tua' }

/** Panduan orang tua: dari pendaftaran sampai membaca ringkasan mingguan. */
export default function ParentGuidePage() {
  const contact = privacyNoticeData().entity.email
  return (
    <GuideLayout
      title="Panduan orang tua"
      intro="Dari daftar sampai anak mulai belajar, biasanya cukup beberapa menit. Panduan ini menjelaskan setiap langkah dengan contoh."
      other={{ href: '/panduan/anak', label: 'Panduan untuk anak' }}
    >
      <GuideSection id="daftar" title="1. Daftar dan konfirmasi email">
        <p className="m-0">
          Buka <Link href="/daftar">halaman daftar</Link>, isi nama, email, dan password, lalu centang persetujuan. Password paling sedikit 15 karakter. Kalimat panjang yang mudah kamu ingat lebih aman daripada kata acak.
        </p>
        <p className="m-0">
          Kami mengirim email berisi tautan konfirmasi. Buka tautan itu, masukkan lagi password yang tadi kamu buat, lalu tekan Konfirmasi email. Pada saat itu keluarga Kira kamu dibuat dan satu kursi beta menjadi milikmu. Tautan berlaku 24 jam. Email belum sampai? Cek folder spam, lalu pakai Kirim ulang email.
        </p>
        <p className="m-0">Email sementara atau sekali pakai tidak diterima. Pakai email yang kamu baca setiap hari.</p>
      </GuideSection>

      <GuideSection id="anak" title="2. Tambahkan anak">
        <p className="m-0">
          Setelah konfirmasi kamu masuk ke halaman Mulai. Isi nama panggilan anak (tidak perlu nama lengkap), pilih kelas 1 sampai 6, pilih avatar, lalu buat PIN dari empat gambar. Contoh: matahari, bulan, bintang, kucing. Anak masuk dengan PIN gambar itu, jadi pilih urutan yang mudah ia ingat.
        </p>
        <p className="m-0">Satu keluarga bisa menambahkan sampai lima anak.</p>
      </GuideSection>

      <GuideSection id="izin" title="3. Atur izin data">
        <p className="m-0">
          Untuk setiap anak ada empat izin: belajar di Kira, laporan mingguan lewat email, rekaman suara, dan foto jawaban. Tidak ada yang tercentang dari awal. Anak baru bisa masuk setelah izin Belajar di Kira dicentang dan disimpan.
        </p>
        <p className="m-0">
          Izin bisa diubah kapan saja di halaman <Link href="/keluarga/privasi">Privasi keluarga</Link>. Di halaman yang sama kamu bisa mengunduh salinan data anak atau meminta penghapusan akunnya.
        </p>
      </GuideSection>

      <GuideSection id="perangkat" title="4. Buka Kira di perangkat anak">
        <p className="m-0">
          Di tablet atau HP yang akan dipakai anak, buka Kira lalu masuk dengan akunmu. Di halaman Mulai tekan Buka Kira untuk anak di perangkat ini. Perangkat itu lalu menampilkan pilihan nama anak dan PIN gambar, dan kamu otomatis keluar dari akun di perangkat tersebut supaya anak tidak membuka area orang tua.
        </p>
        <p className="m-0">Perangkat yang hilang atau dipinjam orang lain bisa dicabut dari Pengaturan.</p>
      </GuideSection>

      <GuideSection id="harian" title="5. Hari belajar anak">
        <p className="m-0">
          Setiap hari anak membuka halaman Today dan mengerjakan sesinya satu per satu: Math, English, dan Science. Sesi yang menunggu penilaian orang dewasa, seperti menulis, berbicara, menggambar, dan foto jawaban, tidak dihitung sebagai sesi wajib bagi keluarga tanpa tutor.
        </p>
        <p className="m-0">Setelah sesi selesai anak boleh bermain di Quick Maths (berhitung cepat) dan Quiz Arena (kuis pengetahuan umum).</p>
      </GuideSection>

      <GuideSection id="ringkasan" title="6. Baca ringkasan mingguan">
        <p className="m-0">
          Halaman <Link href="/keluarga">Keluarga</Link> menampilkan ringkasan minggu: berapa lama anak belajar, apa yang sudah lancar, dan apa yang perlu diulang. Kalau izin laporan email dicentang, ringkasan yang sama dikirim ke emailmu seminggu sekali.
        </p>
      </GuideSection>

      <GuideSection id="lupa" title="Lupa password">
        <p className="m-0">
          Di halaman <Link href="/masuk">Masuk</Link> tekan Lupa password, tulis emailmu, dan ikuti tautan yang dikirim. Tautan berlaku 30 menit dan hanya bisa dipakai sekali. Jawaban di layar sama apakah email itu terdaftar atau tidak, supaya alamat orang lain tidak bisa ditebak.
        </p>
      </GuideSection>

      <GuideSection id="bantuan" title="Butuh bantuan">
        <p className="m-0">
          Tulis ke <a href={`mailto:${contact}`}>{contact}</a>. Aturan data lengkap ada di <Link href="/privasi">Kebijakan Privasi</Link> dan <Link href="/ketentuan">Syarat dan Ketentuan</Link>.
        </p>
      </GuideSection>
    </GuideLayout>
  )
}
