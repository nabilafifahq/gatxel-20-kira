import 'server-only'
import { and, count, eq, isNotNull, sql } from 'drizzle-orm'
import { earnedArenaBadges, emptyArenaBadgeStats, jakartaDate, missionStreak, trackLevels, type ArenaBadgeDef, type ArenaBadgeStats } from '@kira/core'
import { knowledgeCounts, topicsTried } from '@kira/content/knowledge'
import { tables } from '@kira/db'
import type { OrgContext, Tx } from '../db'
import { loadQmState, loadQuizState, loadRolled, trackTotals } from './arena-state'

const { arenaSession, badgeAward } = tables

const SPRINTS = sql`('sprint60', 'sprint120')`

/** Angka untuk aturan lencana arena, dari ronde yang selesai dan kemajuan tersimpan. */
export async function arenaBadgeStats(tx: Tx, learnerId: string): Promise<ArenaBadgeStats> {
  const s = arenaSession
  const qm = (
    await tx
      .select({
        rounds: count(),
        bestPpm: sql<number | null>`max(${s.ppm}) filter (where ${s.mode} in ${SPRINTS} and ${s.answered} >= 10 and ${s.correct}::float / nullif(${s.answered}, 0) >= 0.8)`,
        perfect: sql<boolean>`coalesce(bool_or(${s.mode} in ${SPRINTS} and ${s.answered} >= 15 and ${s.correct} = ${s.answered}), false)`,
        target: sql<number | null>`min(${s.durationMs}) filter (where ${s.mode} = 'target20' and ${s.answered} = 20 and ${s.correct} = 20)`,
      })
      .from(s)
      .where(and(eq(s.learnerId, learnerId), eq(s.arena, 'hitung'), isNotNull(s.finishedAt)))
  )[0]
  const quiz = (
    await tx
      .select({
        rounds: count(),
        speedBest: sql<number | null>`max(${s.correct}) filter (where ${s.mode} = 'speed')`,
        perfect: sql<boolean>`coalesce(bool_or(${s.mode} = 'quiz' and ${s.answered} >= 10 and ${s.correct} = ${s.answered}), false)`,
      })
      .from(s)
      .where(and(eq(s.learnerId, learnerId), eq(s.arena, 'pengetahuan'), isNotNull(s.finishedAt), sql`${s.mode} in ('quiz', 'speed')`))
  )[0]
  const qmRolled = await loadRolled(tx, learnerId, 'hitung')
  const quizRolled = await loadRolled(tx, learnerId, 'pengetahuan')
  const qmState = await loadQmState(tx, learnerId, 2)
  const quizState = await loadQuizState(tx, learnerId)
  const levels = trackLevels(await trackTotals(tx, learnerId))
  const base = emptyArenaBadgeStats()
  return {
    ...base,
    qmRounds: (qm?.rounds ?? 0) + qmRolled.rounds,
    qmBestSprintPpm: Math.max(qm?.bestPpm ?? 0, qmRolled.bestSprintPpm ?? 0),
    qmPerfectSprint: (qm?.perfect ?? false) || qmRolled.perfectSprint,
    qmOpsPlayed: qmState.opsPlayed.length,
    qmFlashCleared: qmState.flashCleared,
    qmSorobanRounds: qmState.sorobanRounds,
    qmAnzanPassed: qmState.anzanPassed,
    qmTablesMastered: qmState.tablesMastered.length,
    qmTarget20Sec: (() => {
      const ms = [qm?.target, qmRolled.bestTargetMs].filter((x): x is number => x != null)
      return ms.length ? Math.round(Math.min(...ms) / 100) / 10 : null
    })(),
    qmMissionsDone: qmState.missionDates.length,
    qmMissionStreak: missionStreak(qmState.missionDates, jakartaDate()),
    qmStrategies: qmState.strategies.length,
    quizRounds: (quiz?.rounds ?? 0) + quizRolled.rounds,
    quizTopicsTried: topicsTried(quizState.know),
    quizSpeedBest: Math.max(quiz?.speedBest ?? 0, quizRolled.speedBest),
    quizPerfectRound: (quiz?.perfect ?? false) || quizRolled.perfectQuiz,
    ...knowledgeCounts(quizState.know),
    levels,
  }
}

/** Beri lencana arena yang baru terpenuhi. Dipanggil dari awardBadges; mengembalikan yang baru didapat. */
export async function awardArenaBadges(tx: Tx, ctx: OrgContext, learnerId: string): Promise<ArenaBadgeDef[]> {
  const have = new Set((await tx.select({ id: badgeAward.badgeId }).from(badgeAward).where(eq(badgeAward.learnerId, learnerId))).map((r) => r.id))
  const fresh = earnedArenaBadges(await arenaBadgeStats(tx, learnerId), have)
  for (const b of fresh) await tx.insert(badgeAward).values({ orgId: ctx.orgId, learnerId, badgeId: b.id }).onConflictDoNothing()
  return fresh
}
