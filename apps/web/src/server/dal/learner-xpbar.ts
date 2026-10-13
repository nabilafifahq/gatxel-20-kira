import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { levelProgress } from '@kira/core'
import { tables } from '@kira/db'
import type { XpBarDTO } from '@/lib/dto'
import type { Tx } from '../db'
import { totalXp } from './learner-core'

/**
 * Bar XP di halaman hasil: posisi di level sebelum dan sesudah sesi ini. XP sesi dihitung dari
 * xp_event yang `ref`-nya attempt ini, jadi tetap benar walau learner sudah mengerjakan sesi lain.
 */
export function xpBarFrom(total: number, earned: number): XpBarDTO {
  const after = levelProgress(Math.max(0, total))
  const before = levelProgress(Math.max(0, total - Math.max(0, earned)))
  return {
    before: { level: before.level, into: before.into, span: before.span },
    after: { level: after.level, into: after.into, span: after.span },
  }
}

export async function xpBarFor(tx: Tx, learnerId: string, attemptId: string): Promise<XpBarDTO> {
  const { xpEvent } = tables
  const total = await totalXp(tx, learnerId)
  const rows = await tx
    .select({ n: sql<number>`coalesce(sum(${xpEvent.amount}), 0)::int` })
    .from(xpEvent)
    .where(and(eq(xpEvent.learnerId, learnerId), eq(xpEvent.ref, attemptId)))
  return xpBarFrom(total, rows[0]?.n ?? 0)
}
