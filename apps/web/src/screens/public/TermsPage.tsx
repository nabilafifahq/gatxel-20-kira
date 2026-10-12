import Link from 'next/link'
import { dateId } from '@/components/console/format'
import { FAMILY_ROUTES, PUBLIC_ROUTES } from '@/components/console/routes'
import type { TermsData } from './legal'
import { LegalLayout, LegalSection } from './LegalLayout'

/**
 * P02 Syarat dan Ketentuan (papan Ketentuan). Komponen server, halaman terpisah dari
 * Kebijakan Privasi supaya persetujuan data tidak digabung dengan ketentuan layanan
 * (GTX-ENG-001 legal pages). Teks Bahasa Indonesia ini yang berlaku. Tanpa klausul
 * "dapat diubah sewaktu-waktu" dan tanpa batas tanggung jawab menyeluruh.
 */

export type TermsPageProps = { data: TermsData }

const TOC = [
  { id: 'k-pengelola', label: '1. Pengelola' },
  { id: 'k-layanan', label: '2. Layanan Kira' },
  { id: 'k-pengguna', label: '3. Siapa yang boleh memakai' },
  { id: 'k-setuju', label: '4. Cara ketentuan berlaku' },
  { id: 'k-larangan', label: '5. Yang tidak boleh dilakukan' },
  { id: 'k-konten', label: '6. Soal dan hak cipta' },
  { id: 'k-tanggung', label: '7. Tanggung jawab Pengelola' },
  { id: 'k-lapor', label: '8. Melaporkan masalah' },
  { id: 'k-berhenti', label: '9. Berhenti memakai Kira' },
  { id: 'k-ubah', label: '10. Perubahan ketentuan' },
  { id: 'k-hukum', label: '11. Hukum dan sengketa' },
]

export function TermsPage({ data }: TermsPageProps) {
  const { entity, meta } = data
  const contact = entity.phone ? `email ${entity.email}, telepon ${entity.phone}` : `email ${entity.email}`
  return (
    <LegalLayout
      current="terms"
      title="Syarat dan Ketentuan"
      meta={
        <>
          Versi {meta.version}, berlaku {dateId(meta.effectiveDate)}. Ditulis dalam Bahasa Indonesia, dan teks ini yang berlaku. Data pribadi diatur terpisah di{' '}
          <Link href={PUBLIC_ROUTES.privacyNotice}>Kebijakan Privasi</Link>.
        </>
      }
      toc={TOC}
      footerNote={`${entity.name}, ${entity.address}`}
    >
      <LegalSection id="k-pengelola" title="1. Pengelola">
        <p className="m-0">
          Kira dikelola oleh {entity.name}, beralamat di {entity.address}, {contact}. Di dokumen ini pihak tersebut disebut Pengelola.
        </p>
      </LegalSection>

      <LegalSection id="k-layanan" title="2. Layanan Kira">
        <p className="m-0">
          Kira menyediakan latihan harian Math, English, dan Science untuk anak kelas 1 sampai 6 kurikulum Cambridge Primary, tes berwaktu, simulasi lomba,
          pembahasan soal, dan laporan mingguan untuk Orang Tua. Kira tidak memungut biaya dan tidak memuat iklan.
        </p>
        <p className="m-0">
          Kira tidak berafiliasi dengan penyelenggara ESMO, IKMC, SASMO, KMNR, KSNR, atau lomba lain. Preset simulasi disusun dari petunjuk teknis yang tersedia,
          dan preset yang belum dicocokkan dengan petunjuk teknis terbaru ditandai belum terverifikasi.
        </p>
      </LegalSection>

      <LegalSection id="k-pengguna" title="3. Siapa yang boleh memakai">
        <p className="m-0">
          Akun keluarga dibuat oleh orang dewasa berusia 18 tahun atau lebih. Pengguna anak, yaitu yang berusia di bawah 18 tahun, hanya bisa memakai Kira lewat
          akun yang dibuat orang dewasa dan setelah Orang Tua memberi persetujuan sesuai Kebijakan Privasi.
        </p>
        <p className="m-0">
          Anak masuk dengan PIN gambar di perangkat yang didaftarkan orang dewasa. Perangkat yang hilang atau dipinjam orang lain bisa dicabut dari Pengaturan.
        </p>
      </LegalSection>

      <LegalSection id="k-setuju" title="4. Cara ketentuan ini berlaku">
        <p className="m-0">
          Ketentuan ini berlaku saat orang dewasa mencentang kotak persetujuan Syarat dan Ketentuan ketika membuat akun. Kotak itu kosong saat dibuka dan terpisah
          dari persetujuan pemrosesan data. Kira mencatat ID akun, waktu, alamat IP, dan versi ketentuan yang disetujui.
        </p>
      </LegalSection>

      <LegalSection id="k-larangan" title="5. Yang tidak boleh dilakukan">
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-[22px]">
          <li>Memakai akun keluarga untuk anak dari keluarga lain.</li>
          <li>Membagikan password, passkey, atau PIN gambar kepada orang di luar keluarga.</li>
          <li>Mencoba membuka data akun lain atau mengganggu kerja sistem.</li>
          <li>Menyalin dan menyebarkan paket soal resmi lomba yang diimpor ke Kira.</li>
        </ul>
      </LegalSection>

      <LegalSection id="k-konten" title="6. Soal dan hak cipta">
        <p className="m-0">
          Soal buatan Kira, ilustrasi, dan desain aplikasi adalah milik Pengelola. Paket soal resmi lomba tetap milik penyelenggaranya. Paket itu hanya dipakai
          untuk latihan pribadi di akun keluarga dan tidak ikut diekspor.
        </p>
      </LegalSection>

      <LegalSection id="k-tanggung" title="7. Tanggung jawab Pengelola">
        <p className="m-0">
          Pengelola bertanggung jawab menjalankan layanan seperti dijelaskan di bagian 2. Kalau soal atau kunci jawaban ternyata salah, Pengelola memperbaikinya
          dan menilai ulang semua attempt yang terdampak.
        </p>
      </LegalSection>

      <LegalSection id="k-lapor" title="8. Melaporkan masalah">
        <p className="m-0">
          Soal yang salah, konten yang tidak pantas untuk anak, penyalahgunaan akun, atau keluhan lain dilaporkan ke {entity.email}. Setiap laporan mendapat kode
          referensi dan ditanggapi paling lambat {data.reportResponseWorkdays} hari kerja.
        </p>
      </LegalSection>

      <LegalSection id="k-berhenti" title="9. Berhenti memakai Kira">
        <p className="m-0">
          Pemilik akun dan Orang Tua bisa berhenti kapan saja dan menghapus akun dari halaman <Link href={FAMILY_ROUTES.privacy}>Privasi keluarga</Link>.
          Pengelola bisa menangguhkan akun yang melanggar bagian 5 setelah memberi tahu pemilik akun beserta alasannya, dan akun dibuka lagi setelah pelanggaran
          dihentikan.
        </p>
      </LegalSection>

      <LegalSection id="k-ubah" title="10. Perubahan ketentuan">
        <p className="m-0">
          Perubahan ketentuan dikirim ke email pemilik akun dan Orang Tua paling lambat 14 hari sebelum berlaku, bersama tanggal berlakunya. Pemilik akun yang
          tidak setuju bisa menghentikan dan menghapus akun sebelum tanggal itu. Versi baru meminta persetujuan ulang lewat kotak centang saat masuk pertama kali
          setelah tanggal berlaku.
        </p>
      </LegalSection>

      <LegalSection id="k-hukum" title="11. Hukum dan penyelesaian sengketa">
        <p className="m-0">
          Ketentuan ini tunduk pada hukum Republik Indonesia. Sengketa diselesaikan lebih dulu dengan musyawarah. Kalau musyawarah tidak berhasil, pengguna bisa
          menempuh Badan Penyelesaian Sengketa Konsumen atau Pengadilan Negeri {entity.courtCity}.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
