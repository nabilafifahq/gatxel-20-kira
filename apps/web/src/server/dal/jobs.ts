import 'server-only'
import { sql } from 'drizzle-orm'
import { tables } from '@kira/db'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'

export type JobKind =
  | 'ai.items'
  | 'ai.variants'
  | 'ai.hints'
  | 'ai.translate'
  | 'ai.rubric'
  | 'ai.grade'
  | 'ai.import'
  | 'ai.test'
  | 'pdf.papers'
  | 'email.send'
  | 'report.week'
  | 'learner.delete'
  | 'media.purge'

/** Tulis job lalu beri tahu worker lewat NOTIFY (dikirim saat transaksi commit). */
export async function enqueueJobTx(tx: Tx, ctx: OrgContext, kind: JobKind, payload: Record<string, unknown>, runAfter?: Date): Promise<string> {
  const [row] = await tx
    .insert(tables.job)
    .values({ orgId: ctx.orgId, kind, payload, createdBy: ctx.userId, ...(runAfter ? { runAfter } : {}) })
    .returning({ id: tables.job.id })
  await tx.execute(sql`select pg_notify('kira_job', ${row!.id})`)
  return row!.id
}

export function enqueueJob(ctx: OrgContext, kind: JobKind, payload: Record<string, unknown>, runAfter?: Date): Promise<string> {
  return inOrg(ctx, (tx) => enqueueJobTx(tx, ctx, kind, payload, runAfter))
}
