import 'server-only'

const DEFAULT_CLAIM = 'Materi mengacu pada kerangka Cambridge Primary'

/**
 * Kalimat kurikulum di halaman depan. KIRA_CURRICULUM_CLAIM menggantinya; nilai kosong menyembunyikannya.
 * Jangan menulis bahwa Kira resmi, bersertifikat, atau didukung Cambridge. Laporan pemetaan sudah selesai
 * (docs/laporan-cambridge.md), dan kalimat yang diizinkan hanya: "mengacu pada kerangka Cambridge Primary".
 * Dibaca langsung dari process.env karena env() menganggap nilai kosong sebagai tidak diisi.
 */
export function curriculumClaim(): string | null {
  const raw = process.env.KIRA_CURRICULUM_CLAIM
  if (raw === undefined) return DEFAULT_CLAIM
  const v = raw.trim()
  return v === '' ? null : v.slice(0, 200)
}
