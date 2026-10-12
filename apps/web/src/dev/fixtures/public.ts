// __GTX_SEED__
/**
 * Data contoh halaman publik dan dokumen hukum untuk pratinjau. Identitas Pengelola,
 * alamat, dan penerima data di sini buatan; nilai produksi diisi pemilik sebelum terbit.
 */
import type { AcceptInviteScreenProps, RegisterDeviceScreenProps } from '@/lib/dto'
import type { LegalEntity, PrivacyNoticeData, TermsData } from '@/screens/public/legal'
import { privacy } from './family'
import { wib } from './console-shared'

export const LEGAL_ENTITY: LegalEntity = {
  name: 'Dina Pratiwi, pengelola Kira Keluarga Wiratama',
  address: 'Jl. Kenanga 12, Kelurahan Tunggulwulung, Kecamatan Lowokwaru, Kota Malang, Jawa Timur 65143',
  email: 'privasi@keluarga-wiratama.test',
  phone: null,
  courtCity: 'Malang',
}

const META = { version: '1.0', effectiveDate: '2026-10-12' }

export const PRIVACY_NOTICE: PrivacyNoticeData = {
  entity: LEGAL_ENTITY,
  meta: META,
  storageLocation: 'Indonesia, di server rumah milik Pengelola',
  purposes: privacy.purposes.map((p) => ({ title: p.title, description: p.description })),
  dataRows: [
    {
      data: 'Profil learner',
      detail: 'Nama tampilan, avatar ilustrasi, grade',
      purpose: 'Memilih soal sesuai grade dan menampilkan profil',
      basis: 'Persetujuan Orang Tua, huruf a',
      retention: 'Selama akun aktif; dihapus paling lambat 30 hari setelah permintaan hapus',
    },
    {
      data: 'Data belajar',
      detail: 'Jawaban, waktu, skor, rating skill, kartu review, streak',
      purpose: 'Quest harian, rapor, laporan mingguan',
      basis: 'Persetujuan Orang Tua, huruf a',
      retention: 'Selama akun aktif; dihapus paling lambat 30 hari setelah permintaan hapus',
    },
    {
      data: 'Rekaman suara',
      detail: 'Jawaban soal berbicara',
      purpose: 'Penilaian oleh tutor',
      basis: 'Persetujuan Orang Tua, huruf a',
      retention: 'Dihapus otomatis 30 hari setelah direkam',
    },
    {
      data: 'Foto lembar jawaban',
      detail: 'Foto kertas yang sudah dikerjakan',
      purpose: 'Penilaian oleh tutor',
      basis: 'Persetujuan Orang Tua, huruf a',
      retention: 'Dihapus otomatis 90 hari setelah diunggah',
    },
    {
      data: 'Akun orang dewasa',
      detail: 'Email, hash password, passkey',
      purpose: 'Masuk ke Kira dan menerima laporan',
      basis: 'Pelaksanaan perjanjian dalam Syarat dan Ketentuan, huruf b',
      retention: 'Selama akun aktif; dihapus paling lambat 30 hari setelah akun ditutup',
    },
    {
      data: 'Bukti persetujuan',
      detail: 'Versi pemberitahuan, tujuan, waktu, cara',
      purpose: 'Membuktikan persetujuan sesuai Pasal 24 UU PDP',
      basis: 'Kewajiban hukum, huruf c',
      retention: '1 tahun setelah akun ditutup',
    },
    {
      data: 'Event pemakaian',
      detail: 'Nama event dan waktu, tanpa teks bebas',
      purpose: 'Statistik di konsol tutor',
      basis: 'Persetujuan Orang Tua, huruf a',
      retention: '13 bulan',
    },
    {
      data: 'Log aplikasi dan error',
      detail: 'ID permintaan dan pesan error, tanpa data pribadi',
      purpose: 'Memperbaiki gangguan',
      basis: 'Kepentingan yang sah, huruf f',
      retention: 'Paling lama 90 hari',
    },
    {
      data: 'Log audit',
      detail: 'Siapa membuka atau mengubah data anak, dan kapan',
      purpose: 'Akuntabilitas Pengelola',
      basis: 'Kewajiban hukum, huruf c',
      retention: '2 tahun',
    },
  ],
  recipients: [
    { name: 'Resend', data: 'Email Orang Tua dan isi laporan mingguan', location: 'Amerika Serikat', abroad: true },
    {
      name: 'Anthropic (Claude)',
      data: 'Teks atau foto tulisan tanpa nama dan tanpa data EXIF, hanya bila Orang Tua menyetujui saran nilai dari AI',
      location: 'Amerika Serikat',
      abroad: true,
    },
    { name: 'Tailscale', data: 'Nama dan alamat jaringan perangkat untuk koneksi pribadi ke server rumah, tanpa isi data belajar', location: 'Kanada dan Amerika Serikat', abroad: true },
    { name: 'GitHub', data: 'Kode aplikasi dan konten soal, tanpa data anak', location: 'Amerika Serikat', abroad: true },
  ],
  sessionHours: 24,
  deviceTokenDays: 90,
}

export const TERMS: TermsData = { entity: LEGAL_ENTITY, meta: META, reportResponseWorkdays: 3 }

export const INVITE: NonNullable<AcceptInviteScreenProps['invite']> = {
  orgName: 'Keluarga Wiratama',
  email: 'ratna@keluarga-wiratama.test',
  role: 'guardian',
  learnerNames: ['Alya', 'Bima'],
  expiresAt: wib('2026-10-19', '20:00'),
}

export const DEVICE_LEARNERS: RegisterDeviceScreenProps['learners'] = [
  { id: 'lrn_seed_alya', name: 'Alya', avatar: 'fox' },
  { id: 'lrn_seed_bima', name: 'Bima', avatar: 'owl' },
]
