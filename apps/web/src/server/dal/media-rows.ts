import 'server-only'
import { and, eq, isNull } from 'drizzle-orm'
import { tables } from '@kira/db'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import { systemCtx } from '../audit'
import { inOrg } from '../db'
import type { MediaKind } from '../media'
import { hasConsent } from './consent'

/** Baris media untuk unggah dan unduh berkas. Berkasnya sendiri diurus server/media.ts. */

/** Attempt milik learner ini yang masih berjalan (tempat rekaman atau foto boleh diunggah). */
export async function openAttemptOfLearner(actor: Actor, attemptId: string): Promise<boolean> {
  const rows = await inOrg(orgCtx(actor), (tx) =>
    tx
      .select({ id: tables.attempt.id })
      .from(tables.attempt)
      .where(and(eq(tables.attempt.id, attemptId), eq(tables.attempt.learnerId, actor.userId), eq(tables.attempt.status, 'in_progress')))
      .limit(1),
  )
  return Boolean(rows[0])
}

/**
 * Persetujuan rekaman atau foto. Role learner tidak boleh membaca consent_event (RLS), jadi
 * pemeriksaan ini memakai konteks sistem dan hanya mengembalikan ya atau tidak.
 */
export function learnerConsent(orgId: string, learnerId: string, purpose: 'audio' | 'photo'): Promise<boolean> {
  return inOrg(systemCtx(orgId), (tx) => hasConsent(tx, learnerId, purpose))
}

export async function insertMedia(
  actor: Actor,
  input: { kind: MediaKind; path: string; mime: string; size: number; sha256: string; expiresAt: Date | null },
): Promise<string> {
  const [row] = await inOrg(orgCtx(actor), (tx) =>
    tx
      .insert(tables.media)
      .values({
        orgId: actor.orgId,
        learnerId: actor.role === 'learner' ? actor.userId : null,
        kind: input.kind,
        path: input.path,
        mime: input.mime,
        size: input.size,
        sha256: input.sha256,
        createdBy: actor.userId,
        expiresAt: input.expiresAt,
      })
      .returning({ id: tables.media.id }),
  )
  return row!.id
}

/** Berkas yang boleh dilihat akun ini (RLS: learner miliknya, orang tua anaknya, tutor semua). */
export async function mediaForViewer(actor: Actor, id: string): Promise<{ path: string; mime: string } | null> {
  const rows = await inOrg(orgCtx(actor), (tx) =>
    tx.select({ path: tables.media.path, mime: tables.media.mime }).from(tables.media).where(and(eq(tables.media.id, id), isNull(tables.media.deletedAt))).limit(1),
  )
  return rows[0] ?? null
}
