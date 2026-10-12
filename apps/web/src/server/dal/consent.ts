import 'server-only'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { tables } from '@kira/db'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { auditTx, systemCtx } from '../audit'
import { NOTICE_VERSION } from '../auth/accounts'

/**
 * Persetujuan orang tua bersifat append-only (satu baris per perubahan, menyimpan versi pemberitahuan).
 * Status terkini satu tujuan = baris terbaru untuk (learner, tujuan).
 * Learner hanya aktif (bisa masuk dan belajar) bila persetujuan `learning` terbaru diberikan.
 */
export const CONSENT_PURPOSES = ['learning', 'progress-email', 'audio', 'photo', 'ai-drafts'] as const
export type ConsentPurposeId = (typeof CONSENT_PURPOSES)[number]

export type ConsentState = { granted: boolean; at: Date; method: 'in-app' | 'offline'; noticeVersion: string }

/** Status terkini per learner per tujuan. Tujuan tanpa baris dianggap belum disetujui. */
export async function latestConsents(tx: Tx, learnerIds: string[]): Promise<Map<string, Map<ConsentPurposeId, ConsentState>>> {
  const out = new Map<string, Map<ConsentPurposeId, ConsentState>>()
  if (learnerIds.length === 0) return out
  const rows = await tx
    .select({
      learnerId: tables.consentEvent.learnerId,
      purpose: tables.consentEvent.purpose,
      granted: tables.consentEvent.granted,
      at: tables.consentEvent.createdAt,
      method: tables.consentEvent.method,
      noticeVersion: tables.consentEvent.noticeVersion,
    })
    .from(tables.consentEvent)
    .where(inArray(tables.consentEvent.learnerId, learnerIds))
    .orderBy(desc(tables.consentEvent.createdAt))
  for (const r of rows) {
    const m = out.get(r.learnerId) ?? new Map<ConsentPurposeId, ConsentState>()
    if (!m.has(r.purpose)) m.set(r.purpose, { granted: r.granted, at: r.at, method: r.method, noticeVersion: r.noticeVersion })
    out.set(r.learnerId, m)
  }
  return out
}

export async function hasConsent(tx: Tx, learnerId: string, purpose: ConsentPurposeId): Promise<boolean> {
  return (await latestConsents(tx, [learnerId])).get(learnerId)?.get(purpose)?.granted ?? false
}

/**
 * Catat satu atau beberapa perubahan persetujuan dalam transaksi pemanggil (role tutor atau guardian).
 * `evidence` untuk persetujuan tertulis di luar aplikasi (nama orang tua, cara, tanggal).
 */
export async function recordConsentTx(
  tx: Tx,
  ctx: OrgContext,
  input: { learnerId: string; purposes: ConsentPurposeId[]; granted: boolean; method: 'in-app' | 'offline'; guardianId: string | null; evidence?: string | null },
): Promise<void> {
  for (const purpose of input.purposes) {
    await tx.insert(tables.consentEvent).values({
      orgId: ctx.orgId,
      learnerId: input.learnerId,
      guardianId: input.guardianId,
      recordedBy: ctx.userId,
      purpose,
      granted: input.granted,
      noticeVersion: NOTICE_VERSION,
      method: input.method,
      evidence: input.evidence ?? null,
    })
  }
  await auditTx(tx, ctx, input.granted ? 'consent.granted' : 'consent.withdrawn', input.learnerId, { purposes: input.purposes, method: input.method })
}

/**
 * Samakan learner_profile.active dengan persetujuan `learning` terbaru.
 * Ditulis dengan konteks sistem karena orang tua tidak boleh mengubah profil learner secara langsung.
 * Dipanggil SETELAH transaksi pencatatan persetujuan selesai.
 */
export async function syncLearnerActive(orgId: string, learnerId: string): Promise<boolean> {
  const ctx = systemCtx(orgId)
  return inOrg(ctx, async (tx) => {
    const granted = await hasConsent(tx, learnerId, 'learning')
    await tx
      .update(tables.learnerProfile)
      .set({ active: granted, updatedAt: new Date() })
      .where(and(eq(tables.learnerProfile.userId, learnerId), eq(tables.learnerProfile.active, !granted)))
    return granted
  })
}
