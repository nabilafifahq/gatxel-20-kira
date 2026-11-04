import 'server-only'

const DEFAULT_CLAIM = 'Materinya disusun untuk anak SD kelas 1 sampai 6 dan diperiksa terus selama beta.'

/**
 * Kalimat kurikulum di halaman depan. KIRA_CURRICULUM_CLAIM menggantinya; nilai kosong menyembunyikannya.
 * Jangan menulis bahwa Kira resmi, bersertifikat, atau didukung Cambridge. Setelah laporan pemetaan selesai,
 * kalimat yang diizinkan hanya: "mengacu pada kerangka Cambridge Primary".
 * Dibaca langsung dari process.env karena env() menganggap nilai kosong sebagai tidak diisi.
 */
export function curriculumClaim(): string | null {
  const raw = process.env.KIRA_CURRICULUM_CLAIM
  if (raw === undefined) return DEFAULT_CLAIM
  const v = raw.trim()
  return v === '' ? null : v.slice(0, 200)
}
