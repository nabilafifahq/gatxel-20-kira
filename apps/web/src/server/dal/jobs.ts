import 'server-only'
import { sql } from 'drizzle-orm'
import { tables, type JobKind, type JobPayload } from '@kira/db'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'

export type { JobKind }

/** Tulis job lalu beri tahu worker lewat NOTIFY (dikirim saat transaksi commit). */
export async function enqueueJobTx<K extends JobKind>(tx: Tx, ctx: OrgContext, kind: K, payload: JobPayload<K>, runAfter?: Date): Promise<string> {
  const [row] = await tx
    .insert(tables.job)
    .values({ orgId: ctx.orgId, kind, payload, createdBy: ctx.userId, ...(runAfter ? { runAfter } : {}) })
    .returning({ id: tables.job.id })
  await tx.execute(sql`select pg_notify('kira_job', ${row!.id})`)
  return row!.id
}

export function enqueueJob<K extends JobKind>(ctx: OrgContext, kind: K, payload: JobPayload<K>, runAfter?: Date): Promise<string> {
  return inOrg(ctx, (tx) => enqueueJobTx(tx, ctx, kind, payload, runAfter))
}
