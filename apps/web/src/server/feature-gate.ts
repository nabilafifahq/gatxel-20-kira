import 'server-only'
import { redirect } from 'next/navigation'
import { featureOn, effectiveOn, type FeatureKey } from '@kira/core/features'
import { getActor, orgCtx } from './auth/actor'
import { inOrg } from './db'
import { featureMapFor } from './dal/learner-features'

/**
 * Penjaga halaman anak: bila semua fitur yang diminta dimatikan orang tua, alihkan ke Latihan Bebas dengan catatan
 * ramah. Hanya berlaku untuk anak; tutor dan orang tua yang melihat layar anak tidak diblokir. Gagal baca = lolos.
 */
export async function gateFeature(...keys: FeatureKey[]): Promise<void> {
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return
  let map
  try {
    map = await inOrg(orgCtx(actor), (tx) => featureMapFor(tx, actor.userId))
  } catch {
    return
  }
  if (keys.some((k) => effectiveOn(map, k))) return
  redirect(`/practice?off=${encodeURIComponent(keys[0]!)}`)
}

export { featureOn }
