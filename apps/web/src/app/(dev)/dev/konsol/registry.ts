/**
 * Daftar pratinjau di /dev/konsol/[name]?state=... (bukan modul client, supaya
 * bisa dibaca halaman server dan galeri).
 */
export type PreviewArea = 'console' | 'family' | 'public' | 'print'

export type PreviewEntry = { name: string; title: string; area: PreviewArea; states: string[]; board: string }

export const PREVIEWS: PreviewEntry[] = [
  { name: 'hari-ini', title: 'Hari ini (T01)', area: 'console', states: ['default', 'beres', 'sebagian', 'error', 'kosong'], board: 'TutorHariIni' },
  { name: 'detail-learner', title: 'Detail learner (T02)', area: 'console', states: ['default', 'baru', 'error'], board: 'DetailLearner' },
  { name: 'rencana', title: 'Rencana mingguan (T03)', area: 'console', states: ['default', 'terbit', 'kosong', 'error'], board: 'Perencana' },
  { name: 'paper', title: 'Penyusun paper (T04)', area: 'console', states: ['default', 'baru', 'error'], board: 'PenyusunPaper' },
  { name: 'hasil', title: 'Kotak hasil (T05)', area: 'console', states: ['default', 'saran-ai', 'audio', 'gambar', 'selesai', 'kosong', 'error'], board: 'KotakHasil' },
  { name: 'ljk', title: 'Input LJK (T06)', area: 'console', states: ['default', 'kosong', 'error'], board: 'InputLjk' },
  { name: 'bank-soal', title: 'Bank soal (T07)', area: 'console', states: ['default', 'kosong', 'error'], board: 'BankSoal' },
  { name: 'lomba', title: 'Kalender lomba (T08)', area: 'console', states: ['default', 'kosong', 'error'], board: 'KalenderLomba' },
  { name: 'laporan', title: 'Laporan (T09)', area: 'console', states: ['default', 'tanpa-smtp', 'error'], board: 'Laporan' },
  { name: 'pengaturan', title: 'Pengaturan (T10)', area: 'console', states: ['default', 'cabut', 'error'], board: 'Pengaturan' },
  { name: 'studio-ai', title: 'Studio AI (T11)', area: 'console', states: ['default', 'batas', 'belum-siap', 'error'], board: 'StudioAi' },
  { name: 'impor', title: 'Impor paket (T12)', area: 'console', states: ['default', 'daftar', 'kosong', 'error'], board: 'ImporPaket' },
  { name: 'learner', title: 'Learner dan grade (T13)', area: 'console', states: ['default', 'tambah', 'penuh', 'kosong', 'error'], board: 'LearnerGrade' },
  { name: 'koneksi-claude', title: 'Koneksi Claude (T14)', area: 'console', states: ['default', 'belum', 'error'], board: 'KoneksiClaude' },
  { name: 'ringkasan', title: 'Ringkasan minggu (G01)', area: 'family', states: ['default', 'pertama'], board: 'RingkasanMinggu' },
  { name: 'privasi-keluarga', title: 'Privasi keluarga (G02)', area: 'family', states: ['default', 'ditarik', 'hapus', 'tutor', 'error'], board: 'PrivasiKeluarga' },
  { name: 'email-laporan', title: 'Email laporan (G03)', area: 'family', states: ['default', 'pertama', 'teks'], board: 'EmailLaporan' },
  { name: 'masuk', title: 'Masuk (P01)', area: 'public', states: ['default', 'terkunci', 'reset-selesai', 'tanpa-passkey', 'error'], board: 'MasukDewasa' },
  { name: 'setup', title: 'Setup pertama', area: 'public', states: ['default', 'error'], board: 'MasukDewasa' },
  { name: 'reset-password', title: 'Reset password', area: 'public', states: ['default', 'kedaluwarsa', 'error'], board: 'MasukDewasa' },
  { name: 'undangan', title: 'Terima undangan', area: 'public', states: ['default', 'kedaluwarsa', 'error'], board: 'MasukDewasa' },
  { name: 'daftar-perangkat', title: 'Daftar perangkat', area: 'public', states: ['default', 'terdaftar', 'error'], board: 'Pengaturan' },
  { name: 'error', title: 'Halaman error (P03)', area: 'public', states: ['404', '500', 'offline', 'forbidden', '404-en', 'offline-en'], board: 'HalamanError' },
  { name: 'kebijakan-privasi', title: 'Kebijakan Privasi (P02)', area: 'public', states: ['default'], board: 'Privasi' },
  { name: 'ketentuan', title: 'Syarat dan Ketentuan (P02)', area: 'public', states: ['default'], board: 'Ketentuan' },
  { name: 'cetak-paper', title: 'Paper A4 (C01)', area: 'print', states: ['default', 'kunci', 'kosong-nama'], board: 'PaperA4Hal1' },
  { name: 'cetak-ljk', title: 'LJK A4 (C02)', area: 'print', states: ['default', 'lima-pilihan'], board: 'LjkA4' },
]

export function findPreview(name: string): PreviewEntry | undefined {
  return PREVIEWS.find((p) => p.name === name)
}
