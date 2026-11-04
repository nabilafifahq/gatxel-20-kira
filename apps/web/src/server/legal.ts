import 'server-only'
import type { PrivacyNoticeData, TermsData } from '@/screens/public/legal'
import { NOTICE_VERSION, TERMS_VERSION } from './auth/accounts'

/**
 * Isi halaman Kebijakan Privasi dan Ketentuan untuk pemasangan server rumah.
 * Identitas pengelola diambil dari .env (KIRA_LEGAL_*) supaya tidak ada isian kosong.
 */
/** Nilai .env yang kosong dianggap belum diisi. */
function legalEnv(name: string): string | null {
  const v = process.env[name]?.trim()
  return v ? v : null
}

function entity() {
  return {
    name: legalEnv('KIRA_LEGAL_NAME') ?? 'Gatxel',
    address: legalEnv('KIRA_LEGAL_ADDRESS') ?? 'Alamat pengelola belum diisi (KIRA_LEGAL_ADDRESS)',
    email: legalEnv('KIRA_LEGAL_EMAIL') ?? 'email-pengelola@belum-diisi.invalid',
    phone: legalEnv('KIRA_LEGAL_PHONE'),
    courtCity: legalEnv('KIRA_LEGAL_COURT') ?? 'Jakarta Selatan',
  }
}

export function privacyNoticeData(): PrivacyNoticeData {
  return {
    entity: entity(),
    meta: { version: NOTICE_VERSION, effectiveDate: legalEnv('KIRA_LEGAL_EFFECTIVE') ?? '2026-11-04' },
    storageLocation: 'komputer server di rumah pengelola di Indonesia, di folder data yang dicadangkan setiap hari',
    purposes: [
      { title: 'Belajar di Kira', description: 'Menyimpan jawaban, skor, dan kemajuan supaya soal berikutnya sesuai kemampuan anak. Lalu lintas ke Kira melewati Cloudflare (Cloudflare Tunnel), termasuk pusat data di luar Indonesia. Wajib untuk memakai Kira.' },
      { title: 'Laporan mingguan lewat email', description: 'Mengirim ringkasan belajar seminggu sekali ke email orang tua.' },
      { title: 'Rekaman suara', description: 'Menyimpan rekaman latihan berbicara supaya orang tua atau tutor bisa mendengar dan menilai.' },
      { title: 'Foto dan gambar jawaban', description: 'Menyimpan gambar dan foto jawaban di kertas supaya orang tua atau tutor bisa menilai.' },
      { title: 'Bantuan AI untuk tutor', description: 'Mengirim teks soal atau foto jawaban tanpa nama anak ke layanan AI untuk membuat draf soal dan saran nilai yang selalu diperiksa tutor. Selama beta publik, keluarga yang mendaftar sendiri tidak memakai bantuan ini.' },
    ],
    dataRows: [
      { data: 'Akun orang dewasa', detail: 'Nama, email, hash password, passkey', purpose: 'Masuk dan keamanan akun', basis: 'Persetujuan dan pelaksanaan layanan', retention: 'Selama akun aktif, dihapus paling lambat 30 hari setelah permintaan hapus ke Pengelola' },
      { data: 'Profil anak', detail: 'Nama panggilan, kelas, avatar, hash PIN gambar', purpose: 'Masuk di tablet dan menyesuaikan soal', basis: 'Persetujuan orang tua', retention: 'Selama akun aktif, dihapus 7 hari setelah permintaan hapus' },
      { data: 'Data belajar', detail: 'Jawaban, skor, waktu, XP, streak, catatan tutor', purpose: 'Belajar, laporan, rencana mingguan', basis: 'Persetujuan orang tua', retention: 'Selama akun aktif, dihapus 7 hari setelah permintaan hapus' },
      { data: 'Rincian ronde arena', detail: 'Soal, jawaban, dan waktu tiap ronde Quick Maths dan Quiz Arena', purpose: 'Rekor, statistik, dan laporan', basis: 'Persetujuan orang tua', retention: '90 hari; setelah itu hanya ringkasan rekor dan jumlah ronde yang disimpan, selama akun aktif' },
      { data: 'Rekaman suara dan gambar jawaban', detail: 'Berkas audio dan gambar', purpose: 'Penilaian oleh orang tua atau tutor', basis: 'Persetujuan khusus orang tua', retention: '90 hari setelah diunggah' },
      { data: 'Log keamanan', detail: 'Waktu masuk, percobaan gagal, hash alamat IP, catatan audit', purpose: 'Mencegah dan menyelidiki penyalahgunaan', basis: 'Kepentingan sah dan kewajiban hukum', retention: 'Percobaan masuk 30 hari, catatan audit 12 bulan' },
      { data: 'Pendaftaran yang belum dikonfirmasi', detail: 'Nama orang tua, email, hash password, hash alamat IP', purpose: 'Memastikan email milik pendaftar sebelum akun dibuat', basis: 'Persetujuan', retention: '24 jam, lalu dihapus otomatis' },
      { data: 'Daftar tunggu kabar', detail: 'Alamat email, waktu persetujuan, status konfirmasi dan berhenti berlangganan', purpose: 'Mengabari saat kursi beta dibuka lagi', basis: 'Persetujuan', retention: 'Sampai berhenti berlangganan, lalu dihapus dalam 30 hari; konfirmasi yang tidak diklik dihapus dalam 14 hari' },
      { data: 'Email keluar', detail: 'Alamat tujuan dan isi email (laporan, undangan, konfirmasi pendaftaran, kabar kursi)', purpose: 'Pengiriman laporan, undangan, konfirmasi, dan kabar', basis: 'Persetujuan', retention: '90 hari' },
      { data: 'Cadangan database', detail: 'Salinan seluruh data di atas', purpose: 'Pemulihan bila server rusak', basis: 'Kepentingan sah', retention: '14 cadangan harian dan 8 cadangan mingguan, paling lama 8 minggu' },
    ],
    recipients: [
      { name: 'Cloudflare, Inc. (Cloudflare Tunnel, jalur HTTPS ke server; dan Turnstile di halaman daftar dan masuk bila diaktifkan)', data: 'Alamat IP dan metadata koneksi. Isi halaman dan jawaban ikut lewat saat diteruskan ke server, tanpa disimpan (Kira meminta Cloudflare tidak menyimpannya)', location: 'Pusat data Cloudflare di banyak negara, sebagian di luar Indonesia', abroad: true },
      { name: 'Anthropic PBC (Claude), hanya untuk keluarga bertutor yang menyetujui Bantuan AI. Tidak dipakai keluarga yang mendaftar sendiri selama beta publik', data: 'Teks soal, jawaban, dan foto jawaban tanpa nama atau identitas anak', location: 'Amerika Serikat', abroad: true },
      { name: 'Penyedia email yang diatur pengelola', data: 'Email orang tua dan isi email: konfirmasi pendaftaran, atur ulang password, kabar kursi, dan ringkasan mingguan bila disetujui', location: 'Mengikuti penyedia yang dipilih pengelola', abroad: true },
      { name: 'Have I Been Pwned (cek kebocoran password)', data: 'Lima karakter awal hash password, tanpa email atau nama', location: 'Australia', abroad: true },
    ],
    sessionHours: 24,
    deviceTokenDays: 90,
  }
}

export function termsData(): TermsData {
  return {
    entity: entity(),
    meta: { version: TERMS_VERSION, effectiveDate: legalEnv('KIRA_LEGAL_EFFECTIVE') ?? '2026-11-04' },
    reportResponseWorkdays: 3,
  }
}
