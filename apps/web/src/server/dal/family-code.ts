import 'server-only'
import { eq } from 'drizzle-orm'
import { tables } from '@kira/db'
import { inOrg } from '../db'
import { orgCtx, type Actor } from '../auth/actor'
import { listDevices } from '../auth/admin'
import { rotateFamilyCodeFor } from '../auth/family-code'
import { audit } from '../audit'

const { familyCode, learnerProfile } = tables

/** Kode keluarga untuk orang dewasa di org ini (RLS: sesi anak tidak bisa membacanya). */
export async function familyCodeFor(actor: Actor): Promise<string | null> {
  const rows = await inOrg(orgCtx(actor), (tx) => tx.select({ code: familyCode.code }).from(familyCode).where(eq(familyCode.orgId, actor.orgId)).limit(1))
  return rows[0]?.code ?? null
}

/** Ganti kode: kode lama langsung gugur, perangkat yang sudah terdaftar tetap masuk. */
export async function rotateFamilyCode(actor: Actor): Promise<string> {
  const code = await rotateFamilyCodeFor(actor.orgId)
  if (!code) throw new Error('kode keluarga tidak bisa diganti')
  await audit(orgCtx(actor), 'family_code.rotated', actor.orgId)
  return code
}

export type FamilyDevice = { id: string; name: string; learners: string[]; lastSeenAt: string | null; expiresAt: string }

/** Perangkat yang dipakai anak orang dewasa ini. RLS membatasi orang tua ke anak yang tertaut. */
export async function familyDevicesFor(actor: Actor): Promise<FamilyDevice[]> {
  const kids = await inOrg(orgCtx(actor), (tx) => tx.select({ id: learnerProfile.userId, name: learnerProfile.name }).from(learnerProfile))
  const nameOf = new Map(kids.map((k) => [k.id, k.name]))
  return (await listDevices(actor.orgId))
    .filter((d) => d.learnerIds.some((id) => nameOf.has(id)))
    .map((d) => ({
      id: d.id,
      name: d.name,
      learners: d.learnerIds.map((id) => nameOf.get(id)).filter((n): n is string => Boolean(n)),
      lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
      expiresAt: d.expiresAt.toISOString(),
    }))
}
