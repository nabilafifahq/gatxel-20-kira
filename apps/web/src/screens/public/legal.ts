/**
 * Data untuk halaman Kebijakan Privasi dan Syarat dan Ketentuan (papan Privasi, Ketentuan).
 * Teks dokumen ada di komponen halaman; nilai yang berbeda per pemasangan (identitas
 * Pengelola, tanggal berlaku, penerima data, masa simpan) datang dari sini supaya
 * tidak ada isian kosong seperti [ALAMAT] yang tampil ke pengguna.
 * Nilai produksi wajib dicek pemilik (Nabila) sebelum terbit.
 */

export type LegalEntity = {
  /** Nama pengendali data, misalnya nama orang atau badan yang mengelola Kira. */
  name: string
  /** Alamat sampai tingkat kelurahan. */
  address: string
  email: string
  phone: string | null
  /** Kota Pengadilan Negeri untuk sengketa. */
  courtCity: string
}

export type LegalDocMeta = {
  version: string
  /** Tanggal berlaku, ISO "YYYY-MM-DD". */
  effectiveDate: string
}

export type PrivacyNoticeData = {
  entity: LegalEntity
  meta: LegalDocMeta
  /** Lokasi penyimpanan utama, dipakai di kalimat "Data disimpan di ...". */
  storageLocation: string
  /** Tujuan persetujuan, sama dengan tujuan di halaman Privasi keluarga. */
  purposes: { title: string; description: string }[]
  /** Baris tabel data. Masa simpan selalu dalam satuan waktu. */
  dataRows: { data: string; detail: string; purpose: string; basis: string; retention: string }[]
  /** Penerima data. `abroad` menandai penerima di luar Indonesia. */
  recipients: { name: string; data: string; location: string; abroad: boolean }[]
  /** Masa berlaku cookie sesi orang dewasa (jam) dan token perangkat tablet (hari). */
  sessionHours: number
  deviceTokenDays: number
}

export type TermsData = {
  entity: LegalEntity
  meta: LegalDocMeta
  /** Batas waktu menanggapi laporan masalah, dalam hari kerja. */
  reportResponseWorkdays: number
}

const NUMBER_WORD = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh']

/** "tiga" untuk 3; angka di atas 10 tetap angka. */
export function numberWordId(n: number): string {
  return NUMBER_WORD[n] ?? String(n)
}
