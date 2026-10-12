import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { formatDateId, jakartaDate, jakartaMidnight } from '@kira/core/time'
import { tables, withOrg } from '@kira/db'
import { JobError, PostponeError } from '../errors'
import { deleteStored } from '../media'
import type { Handler } from './types'

/**
 * Job learner.delete: menjalankan permintaan hapus akun learner yang sudah jatuh tempo.
 * Permintaan dikunci (FOR UPDATE) lalu diperiksa belum dibatalkan dan belum dijalankan, dan
 * tanggalnya sudah tiba (WIB). kira_delete_learner menghapus data di database dan mengembalikan
 * path berkas, yang dihapus setelah transaksi selesai. Baris deletion_request ikut terhapus
 * lewat cascade.
 */

const payloadSchema = z.object({ learnerId: z.uuid(), deletionRequestId: z.uuid() })

type Outcome =
  | { kind: 'missing' }
  | { kind: 'cancelled' }
  | { kind: 'executed' }
  | { kind: 'early'; scheduledFor: string }
  | { kind: 'deleted'; paths: string[]; reference: string }

export const learnerDeleteHandler: Handler = {
  async run(h) {
    const p = payloadSchema.safeParse(h.job.payload)
    if (!p.success) throw new JobError('Payload penghapusan learner tidak lengkap.', { retryable: false })
    const { learnerId, deletionRequestId } = p.data
    const today = jakartaDate(h.now())
    const outcome = await withOrg<Outcome>(h.db, h.org, async (tx) => {
      const [req] = await tx
        .select({
          scheduledFor: tables.deletionRequest.scheduledFor,
          cancelledAt: tables.deletionRequest.cancelledAt,
          executedAt: tables.deletionRequest.executedAt,
          reference: tables.deletionRequest.reference,
        })
        .from(tables.deletionRequest)
        .where(and(eq(tables.deletionRequest.id, deletionRequestId), eq(tables.deletionRequest.learnerId, learnerId)))
        .limit(1)
        .for('update')
      if (!req) return { kind: 'missing' }
      if (req.cancelledAt) return { kind: 'cancelled' }
      if (req.executedAt) return { kind: 'executed' }
      if (req.scheduledFor > today) return { kind: 'early', scheduledFor: req.scheduledFor }
      const rows = await tx.execute(sql`select path from kira_delete_learner(${h.org.orgId}::uuid, ${learnerId}::uuid)`)
      const paths = (rows as unknown as { path: string | null }[]).map((r) => r.path).filter((x): x is string => typeof x === 'string')
      return { kind: 'deleted', paths, reference: req.reference }
    })
    switch (outcome.kind) {
      case 'missing':
        return { skipped: 'Permintaan hapus tidak ditemukan. Data learner mungkin sudah dihapus.' }
      case 'cancelled':
        return { skipped: 'Permintaan hapus sudah dibatalkan.' }
      case 'executed':
        return { skipped: 'Permintaan hapus sudah dijalankan.' }
      case 'early':
        throw new PostponeError(jakartaMidnight(outcome.scheduledFor), `Penghapusan dijadwalkan ${formatDateId(outcome.scheduledFor)}.`)
      case 'deleted': {
        let failed = 0
        for (const path of outcome.paths) {
          try {
            await deleteStored(h.env.KIRA_DATA_DIR, path)
          } catch (e) {
            failed++
            if (failed === 1) h.log.error('berkas learner gagal dihapus', { error: e })
          }
        }
        h.log.info('data learner dihapus', { files: outcome.paths.length, failedFiles: failed })
        return { deleted: true, reference: outcome.reference, files: outcome.paths.length, failedFiles: failed }
      }
    }
  },
}
