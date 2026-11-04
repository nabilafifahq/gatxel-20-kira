import 'server-only'
import { and, eq } from 'drizzle-orm'
import { effectiveOn, FEATURE_KEYS, type FeatureKey, type FeatureMap } from '@kira/core/features'
import { tables } from '@kira/db'
import { inOrg, type Tx } from '../db'
import { getActor, orgCtx } from '../auth/actor'

const { learnerFeature } = tables

/** Saklar tersimpan satu learner. Kunci yang tidak ada berarti menyala. */
export async function featureMapFor(tx: Tx, learnerId: string): Promise<FeatureMap> {
  const rows = await tx.select({ key: learnerFeature.key, enabled: learnerFeature.enabled }).from(learnerFeature).where(eq(learnerFeature.learnerId, learnerId))
  const out: FeatureMap = {}
  for (const r of rows) if ((FEATURE_KEYS as readonly string[]).includes(r.key)) out[r.key as FeatureKey] = r.enabled
  return out
}

/** Versi dalam transaksi yang sudah ada. Memperhitungkan ketergantungan (Math mati mematikan Drill Math). */
export async function isFeatureOnTx(tx: Tx, learnerId: string, key: FeatureKey): Promise<boolean> {
  return effectiveOn(await featureMapFor(tx, learnerId), key)
}

/**
 * Kontrak untuk semua agen: apakah fitur menyala bagi learner ini. Memakai sesi yang sedang berjalan untuk
 * konteks RLS. Tanpa sesi atau saat gagal membaca, fitur dianggap menyala (gagal terbuka agar anak tidak terkunci).
 */
export async function isFeatureOn(learnerId: string, key: FeatureKey): Promise<boolean> {
  const actor = await getActor()
  if (!actor) return true
  try {
    return await inOrg(orgCtx(actor), (tx) => isFeatureOnTx(tx, learnerId, key))
  } catch {
    return true
  }
}

/** Simpan satu set saklar. Hanya baris yang berbeda dari bawaan (mati) disimpan; menyala menghapus baris. */
export async function saveFeatureMap(tx: Tx, orgId: string, learnerId: string, map: FeatureMap): Promise<void> {
  for (const key of FEATURE_KEYS) {
    if (map[key] === false) {
      await tx
        .insert(learnerFeature)
        .values({ learnerId, orgId, key, enabled: false })
        .onConflictDoUpdate({ target: [learnerFeature.learnerId, learnerFeature.key], set: { enabled: false, updatedAt: new Date() } })
    } else {
      await tx.delete(learnerFeature).where(and(eq(learnerFeature.learnerId, learnerId), eq(learnerFeature.key, key)))
    }
  }
}
