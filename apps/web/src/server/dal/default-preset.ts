import 'server-only'
import type { OrgContext, Tx } from '../db'

/**
 * Seam untuk preset hari bawaan anak baru yang dibuat orang tua (preset "Seimbang": Latihan wajib, Tes dan
 * Paper opsional). Aturan sesinya dimiliki agen ortu (migrasi 0013). Sampai aturan itu ada, fungsi ini
 * tidak mengubah apa pun dan anak baru memakai nilai bawaan database. Pemanggil: onboarding.addChild,
 * di dalam transaksi keluarga, setelah learner_profile dan guardian_link tersimpan.
 * Integrator: ganti isi fungsi ini dengan pemanggilan ke aturan preset ortu.
 */
export const DEFAULT_DAY_PRESET = 'seimbang' as const

export async function applyDefaultPreset(_tx: Tx, _ctx: OrgContext, _learnerId: string): Promise<void> {
  // Sengaja kosong. Lihat komentar di atas.
}
