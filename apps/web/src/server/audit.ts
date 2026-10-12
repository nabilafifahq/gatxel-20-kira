import 'server-only'
import { tables } from '@kira/db'
import type { OrgContext, Tx } from './db'
import { inOrg } from './db'
import { log } from './log'

export const SYSTEM_USER = '00000000-0000-0000-0000-000000000000'

/** Konteks untuk tulisan yang dibuat server sendiri (kotak keluar, audit), bukan oleh pengguna. */
export function systemCtx(orgId: string): OrgContext {
  return { orgId, userId: SYSTEM_USER, role: 'tutor' }
}

export async function auditTx(tx: Tx, ctx: OrgContext, action: string, target?: string | null, meta?: Record<string, unknown>): Promise<void> {
  await tx.insert(tables.auditLog).values({
    orgId: ctx.orgId,
    actorId: ctx.userId === SYSTEM_USER ? null : ctx.userId,
    actorKind: ctx.userId === SYSTEM_USER ? 'system' : ctx.role,
    action,
    target: target ?? null,
    meta: meta ?? null,
  })
}

export async function audit(ctx: OrgContext, action: string, target?: string | null, meta?: Record<string, unknown>): Promise<void> {
  try {
    await inOrg(ctx, (tx) => auditTx(tx, ctx, action, target, meta))
  } catch (e) {
    log.error('audit gagal ditulis', { action, error: e })
  }
}
