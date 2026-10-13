'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import type { ActionResult, ConsentPurpose } from '@/lib/dto'
import { inOrg } from '../db'
import { forbidden, runAction } from '../errors'
import { auditTx } from '../audit'
import { orgCtx, requireActor, requireAdult } from '../auth/actor'
import { revokeUserSessions } from '../auth/session'
import { CONSENT_PURPOSES, syncLearnerActive } from '../dal/consent'
import { learnerExport } from '../dal/data-export'
import { assertGuardianOf, cancelDeletionTx, queueDeletionConfirmation, requestDeletionTx, setConsentTx } from '../dal/privacy'
import { log } from '../log'

/**
 * G02 Privasi keluarga. Persetujuan dan penghapusan hanya oleh orang tua yang tertaut ke learner
 * (RLS ditambah pemeriksaan guardian_link). Salinan data boleh diunduh orang tua dan tutor.
 */

async function requireGuardian() {
  const actor = await requireActor()
  if (actor.role !== 'guardian') throw forbidden('Hanya orang tua yang bisa mengubah persetujuan dan meminta penghapusan dari halaman ini.')
  return actor
}

const uuid = z.string().uuid()

export async function setConsentAction(input: { learnerId: string; purpose: ConsentPurpose['id']; granted: boolean }): Promise<ActionResult> {
  return runAction('setConsent', async () => {
    const actor = await requireGuardian()
    const data = z.object({ learnerId: uuid, purpose: z.enum(CONSENT_PURPOSES), granted: z.boolean() }).strict().parse(input)
    const ctx = orgCtx(actor)
    const r = await inOrg(ctx, (tx) => setConsentTx(tx, ctx, { guardianId: actor.userId, learnerId: data.learnerId, purpose: data.purpose, granted: data.granted }))
    if (r.changed && data.purpose === 'learning') {
      await syncLearnerActive(actor.orgId, data.learnerId)
      // Tanpa persetujuan belajar, tablet anak langsung keluar.
      if (!data.granted) await revokeUserSessions(data.learnerId)
    }
    refresh()
    return undefined
  })
}

export async function exportDataAction(learnerId: string): Promise<ActionResult<{ filename: string; json: string }>> {
  return runAction('exportData', async () => {
    const actor = await requireAdult()
    const id = uuid.parse(learnerId)
    const ctx = orgCtx(actor)
    const out = await inOrg(ctx, async (tx) => {
      if (actor.role === 'guardian') await assertGuardianOf(tx, actor.userId, id)
      const e = await learnerExport(tx, id)
      await auditTx(tx, ctx, 'data.exported', id, { from: 'privacy', pseudonym: false })
      return e
    })
    return { filename: out.filename, json: out.json }
  })
}

export async function requestDeletionAction(input: { learnerId: string; confirmName: string }): Promise<ActionResult<{ reference: string; scheduledFor: string }>> {
  return runAction('requestDeletion', async () => {
    const actor = await requireGuardian()
    const data = z.object({ learnerId: uuid, confirmName: z.string().max(120) }).strict().parse(input)
    const ctx = orgCtx(actor)
    const res = await inOrg(ctx, (tx) => requestDeletionTx(tx, ctx, { guardianId: actor.userId, learnerId: data.learnerId, confirmName: data.confirmName }))
    await revokeUserSessions(data.learnerId)
    if (actor.email) {
      try {
        await queueDeletionConfirmation(actor.orgId, actor.email, { ...res, learnerId: data.learnerId })
      } catch {
        // Permintaan sudah tercatat; email konfirmasi gagal tidak membatalkannya.
        log.warn('email konfirmasi hapus gagal masuk kotak keluar', { reference: res.reference })
      }
    }
    refresh()
    return { reference: res.reference, scheduledFor: res.scheduledFor }
  })
}

export async function cancelDeletionAction(learnerId: string): Promise<ActionResult> {
  return runAction('cancelDeletion', async () => {
    const actor = await requireGuardian()
    const id = uuid.parse(learnerId)
    const ctx = orgCtx(actor)
    await inOrg(ctx, (tx) => cancelDeletionTx(tx, ctx, { guardianId: actor.userId, learnerId: id }))
    await syncLearnerActive(actor.orgId, id)
    refresh()
    return undefined
  })
}
