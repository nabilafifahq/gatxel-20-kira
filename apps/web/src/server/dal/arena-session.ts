import 'server-only'
import { and, eq, isNull, lt, sql } from 'drizzle-orm'
import { FULL_XP_ROUNDS, jakartaDate, type IsoDate } from '@kira/core'
import { tables } from '@kira/db'
import type { Tx } from '../db'
import { AppError, conflict, notFound } from '../errors'
import { minutesOn, type LearnerRow } from './learner-core'
import type { ArenaKind } from './arena-state'

const { arenaSession } = tables

export type SessionRow = typeof arenaSession.$inferSelect

/** Ronde milik learner ini. RLS sudah membatasi, jadi ronde learner lain tidak pernah terbaca. */
export async function loadSession(tx: Tx, learnerId: string, id: string, arena: ArenaKind, lock = false): Promise<SessionRow> {
  const q = tx.select().from(arenaSession).where(and(eq(arenaSession.id, id), eq(arenaSession.learnerId, learnerId), eq(arenaSession.arena, arena))).limit(1)
  const rows = lock ? await q.for('update') : await q
  if (!rows[0]) throw notFound('That round could not be found.')
  return rows[0]
}

/** Batas layar harian berlaku juga di arena. */
export async function assertCanPlay(tx: Tx, learner: LearnerRow, today: IsoDate = jakartaDate()): Promise<void> {
  if ((await minutesOn(tx, learner.userId, today)) >= learner.screenLimitMin) {
    throw new AppError('forbidden', 'Time for a break. You have used your minutes for today.')
  }
}

/** Ronde yang dimulai tetapi tidak pernah selesai dibersihkan setelah dua hari. */
export async function dropStaleRounds(tx: Tx, learnerId: string): Promise<void> {
  await tx
    .delete(arenaSession)
    .where(and(eq(arenaSession.learnerId, learnerId), isNull(arenaSession.finishedAt), lt(arenaSession.startedAt, sql`now() - interval '2 days'`)))
}

export function assertOpen(row: SessionRow): void {
  if (row.finishedAt) throw conflict('This round is already finished.')
}

export function xpNote(roundsBefore: number): string | null {
  return roundsBefore >= FULL_XP_ROUNDS ? 'You have played a lot today, so each round gives a little less XP now. Taking a break is a good idea.' : null
}

export function clampMs(ms: number): number {
  return Math.max(0, Math.min(10 * 60 * 1000, Math.round(ms)))
}
