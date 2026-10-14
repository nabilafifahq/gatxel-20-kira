import 'server-only'
import { and, eq, gte, isNotNull, lte, sql } from 'drizzle-orm'
import type { IsoDate } from '@kira/core'
import { isKnown, TOPICS, topicsTried } from '@kira/content/knowledge'
import { tables } from '@kira/db'
import type { ArenaWeekDTO } from '@/lib/dto'
import type { Tx } from '../db'
import { loadQuizState } from './arena-state'

const { arenaSession } = tables

/** Angka arena satu minggu (Senin sampai Minggu) untuk email dan halaman keluarga; null bila tidak ada apa-apa. */
export async function arenaWeekDTO(tx: Tx, learnerId: string, monday: IsoDate, sunday: IsoDate): Promise<ArenaWeekDTO | null> {
  const s = arenaSession
  const rows = await tx
    .select({
      arena: s.arena,
      rounds: sql<number>`count(*) filter (where ${s.arena} = 'hitung' or ${s.mode} in ('quiz', 'speed'))::int`,
      bestPpm: sql<number | null>`max(${s.ppm}) filter (where ${s.mode} in ('sprint60', 'sprint120') and ${s.answered} >= 10 and ${s.correct}::float / nullif(${s.answered}, 0) >= 0.8)`,
    })
    .from(s)
    .where(and(eq(s.learnerId, learnerId), isNotNull(s.finishedAt), gte(s.date, monday), lte(s.date, sunday)))
    .groupBy(s.arena)
  const qm = rows.find((r) => r.arena === 'hitung')
  const quiz = rows.find((r) => r.arena === 'pengetahuan')
  const know = (await loadQuizState(tx, learnerId)).know
  const tried = topicsTried(know)
  const out: ArenaWeekDTO = {
    qmRounds: qm?.rounds ?? 0,
    qmBestPpm: qm?.bestPpm ?? null,
    quizRounds: quiz?.rounds ?? 0,
    topicsTried: tried,
    topicsTotal: TOPICS.length,
    factsKnown: TOPICS.reduce((n, t) => n + t.facts.filter((f) => isKnown(know[f.id])).length, 0),
    factsTotal: TOPICS.reduce((n, t) => n + t.facts.length, 0),
  }
  return out.qmRounds === 0 && out.topicsTried === 0 ? null : out
}
