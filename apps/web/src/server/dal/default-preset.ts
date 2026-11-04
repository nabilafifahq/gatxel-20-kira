import 'server-only'
import { DEFAULT_PRESET } from '@kira/core'
import { tables } from '@kira/db'
import type { OrgContext, Tx } from '../db'

/**
 * Preset hari bawaan anak baru yang dibuat orang tua: Seimbang (Latihan wajib, Tes dan Paper opsional),
 * aturan milik ortu (migrasi 0013, `@kira/core` day-rules). Disimpan sebagai baris eksplisit supaya pilihan
 * bawaan tidak ikut berubah bila bawaan kode berubah. Pemanggil: onboarding.addChild, di dalam transaksi
 * keluarga, setelah learner_profile dan guardian_link tersimpan.
 */
export const DEFAULT_DAY_PRESET = DEFAULT_PRESET

export async function applyDefaultPreset(tx: Tx, ctx: OrgContext, learnerId: string): Promise<void> {
  await tx
    .insert(tables.dayRules)
    .values({ orgId: ctx.orgId, learnerId, preset: DEFAULT_DAY_PRESET, rules: null })
    .onConflictDoNothing({ target: tables.dayRules.learnerId })
}
