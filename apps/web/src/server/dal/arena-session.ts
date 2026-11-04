import 'server-only'
import { and, eq, isNull, lt, sql } from 'drizzle-orm'
import { FULL_XP_ROUNDS, jakartaDate, type IsoDate } from '@kira/core'
import { tables } from '@kira/db'
import { dictFor, type Dict, type UiLang } from '@/lib/i18n'
import { getLang } from '@/lib/i18n/server'
import type { Tx } from '../db'
import { AppError, conflict, notFound } from '../errors'
import { minutesOn, type LearnerRow } from './learner-core'
import type { ArenaKind } from './arena-state'

const { arenaSession } = tables

export type SessionRow = typeof arenaSession.$inferSelect

/** Bawaan fungsi DAL bila pemanggil tidak memberi kamus (tes, pemanggil non-anak). */
export const EN_DICT = dictFor('en')

/** Bahasa anak untuk pemuat halaman yang tidak memegang aktor. Ikut terbaca bersama sesi; di luar request (tes DAL): Inggris. */
export async function requestLang(): Promise<UiLang> {
  try {
    return await getLang()
  } catch {
    return 'en'
  }
}

export async function requestDict(): Promise<Dict> {
  return dictFor(await requestLang())
}

/** Ronde milik learner ini. RLS sudah membatasi, jadi ronde learner lain tidak pernah terbaca. */
export async function loadSession(tx: Tx, learnerId: string, id: string, arena: ArenaKind, lock = false, t: Dict = EN_DICT): Promise<SessionRow> {
  const q = tx.select().from(arenaSession).where(and(eq(arenaSession.id, id), eq(arenaSession.learnerId, learnerId), eq(arenaSession.arena, arena))).limit(1)
  const rows = lock ? await q.for('update') : await q
  if (!rows[0]) throw notFound(t.arena.errors.roundNotFound)
  return rows[0]
}

/** Batas layar harian berlaku juga di arena. */
export async function assertCanPlay(tx: Tx, learner: LearnerRow, today: IsoDate = jakartaDate(), t: Dict = EN_DICT): Promise<void> {
  if ((await minutesOn(tx, learner.userId, today)) >= learner.screenLimitMin) {
    throw new AppError('forbidden', t.arena.breakTime)
  }
}

/** Ronde yang dimulai tetapi tidak pernah selesai dibersihkan setelah dua hari. */
export async function dropStaleRounds(tx: Tx, learnerId: string): Promise<void> {
  await tx
    .delete(arenaSession)
    .where(and(eq(arenaSession.learnerId, learnerId), isNull(arenaSession.finishedAt), lt(arenaSession.startedAt, sql`now() - interval '2 days'`)))
}

export function assertOpen(row: SessionRow, t: Dict = EN_DICT): void {
  if (row.finishedAt) throw conflict(t.arena.errors.alreadyFinished)
}

export function xpNote(roundsBefore: number, t: Dict = EN_DICT): string | null {
  return roundsBefore >= FULL_XP_ROUNDS ? t.arena.xpNote : null
}

export function clampMs(ms: number): number {
  return Math.max(0, Math.min(10 * 60 * 1000, Math.round(ms)))
}
