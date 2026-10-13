import 'server-only'
import { and, count, eq, isNotNull, sql } from 'drizzle-orm'
import {
  DEFAULT_QM_LEVELS,
  FLASH_MAX_LEVEL,
  QM_OPS,
  SOROBAN_MAX_LEVEL,
  STRATEGY_IDS,
  initialQmLevels,
  isIsoDate,
  trackXpFromRows,
  type IsoDate,
  type QmLevels,
  type QmOp,
  type StrategyId,
  type TrackXp,
} from '@kira/core'
import type { KnowMap } from '@kira/content/knowledge'
import { tables } from '@kira/db'
import type { OrgContext, Tx } from '../db'

const { arenaState, arenaSession, xpEvent } = tables

export type ArenaKind = 'hitung' | 'pengetahuan'

// ---------------------------------------------------------------------------
// Kemajuan Quick Maths dan Quiz Arena (arena_state.data)

export type QmState = {
  levels: QmLevels
  ppm: Partial<Record<QmOp, number>>
  flashLevel: number
  flashCleared: number
  soroban: { read: number; set: number; anzan: number }
  sorobanRounds: number
  anzanPassed: number
  opsPlayed: QmOp[]
  tablesMastered: number[]
  strategies: StrategyId[]
  missionDates: IsoDate[]
}

export type QuizState = { know: KnowMap; speedBest: number; perfectRound: boolean }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const int = (v: unknown, min: number, max: number, fallback: number): number => (typeof v === 'number' && Number.isInteger(v) ? Math.max(min, Math.min(max, v)) : fallback)

export function normaliseQmState(raw: unknown, grade: number): QmState {
  const data = isRecord(raw) ? raw : {}
  const base = initialQmLevels(grade)
  const lv = isRecord(data.levels) ? data.levels : {}
  const levels: QmLevels = { ...DEFAULT_QM_LEVELS }
  for (const op of QM_OPS) levels[op] = int(lv[op], 1, 8, base[op])
  const ppm: Partial<Record<QmOp, number>> = {}
  if (isRecord(data.ppm)) for (const op of QM_OPS) if (typeof data.ppm[op] === 'number') ppm[op] = data.ppm[op] as number
  const sob = isRecord(data.soroban) ? data.soroban : {}
  const list = <T>(v: unknown, ok: (x: unknown) => x is T, max = 100): T[] => (Array.isArray(v) ? (v.filter(ok).slice(-max) as T[]) : [])
  return {
    levels,
    ppm,
    flashLevel: int(data.flashLevel, 1, FLASH_MAX_LEVEL, 1),
    flashCleared: int(data.flashCleared, 0, FLASH_MAX_LEVEL, 0),
    soroban: { read: int(sob.read, 1, SOROBAN_MAX_LEVEL, 1), set: int(sob.set, 1, SOROBAN_MAX_LEVEL, 1), anzan: int(sob.anzan, 1, SOROBAN_MAX_LEVEL, 1) },
    sorobanRounds: int(data.sorobanRounds, 0, 100000, 0),
    anzanPassed: int(data.anzanPassed, 0, 100000, 0),
    opsPlayed: list(data.opsPlayed, (x): x is QmOp => typeof x === 'string' && (QM_OPS as readonly string[]).includes(x)),
    tablesMastered: [...new Set(list(data.tablesMastered, (x): x is number => typeof x === 'number' && x >= 2 && x <= 12))],
    strategies: [...new Set(list(data.strategies, (x): x is StrategyId => typeof x === 'string' && (STRATEGY_IDS as readonly string[]).includes(x)))],
    missionDates: list(data.missionDates, (x): x is IsoDate => typeof x === 'string' && isIsoDate(x), 90),
  }
}

export function normaliseQuizState(raw: unknown): QuizState {
  const data = isRecord(raw) ? raw : {}
  const know: KnowMap = {}
  if (isRecord(data.know)) {
    for (const [id, e] of Object.entries(data.know)) {
      if (!isRecord(e) || typeof e.n !== 'number' || typeof e.r !== 'number') continue
      know[id] = { n: Math.max(0, Math.floor(e.n)), r: Math.max(0, Math.floor(e.r)), last: e.last === 1 ? 1 : 0 }
    }
  }
  return { know, speedBest: int(data.speedBest, 0, 1000, 0), perfectRound: data.perfectRound === true }
}

async function readState(tx: Tx, learnerId: string, arena: ArenaKind, lock: boolean): Promise<unknown> {
  const q = tx.select({ data: arenaState.data }).from(arenaState).where(and(eq(arenaState.learnerId, learnerId), eq(arenaState.arena, arena))).limit(1)
  const rows = lock ? await q.for('update') : await q
  return rows[0]?.data ?? {}
}

export async function loadQmState(tx: Tx, learnerId: string, grade: number, lock = false): Promise<QmState> {
  return normaliseQmState(await readState(tx, learnerId, 'hitung', lock), grade)
}

export async function loadQuizState(tx: Tx, learnerId: string, lock = false): Promise<QuizState> {
  return normaliseQuizState(await readState(tx, learnerId, 'pengetahuan', lock))
}

export async function saveArenaState(tx: Tx, ctx: OrgContext, learnerId: string, arena: ArenaKind, data: QmState | QuizState): Promise<void> {
  await tx
    .insert(arenaState)
    .values({ orgId: ctx.orgId, learnerId, arena, data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [arenaState.learnerId, arenaState.arena], set: { data, updatedAt: new Date() } })
}

// ---------------------------------------------------------------------------
// XP per jalur dan ronde hari ini

export async function trackTotals(tx: Tx, learnerId: string): Promise<TrackXp> {
  const rows = await tx
    .select({ track: xpEvent.track, xp: sql<number>`coalesce(sum(${xpEvent.amount}), 0)::int` })
    .from(xpEvent)
    .where(eq(xpEvent.learnerId, learnerId))
    .groupBy(xpEvent.track)
  return trackXpFromRows(rows)
}

/** Ronde arena yang sudah selesai pada hari belajar `date`. */
export async function finishedRoundsOn(tx: Tx, learnerId: string, arena: ArenaKind, date: IsoDate): Promise<number> {
  const rows = await tx
    .select({ n: count() })
    .from(arenaSession)
    .where(and(eq(arenaSession.learnerId, learnerId), eq(arenaSession.arena, arena), eq(arenaSession.date, date), isNotNull(arenaSession.finishedAt)))
  return rows[0]?.n ?? 0
}
