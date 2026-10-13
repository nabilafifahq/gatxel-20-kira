import 'server-only'
import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm'
import {
  BADGES,
  computeGate,
  computeStreak,
  difficultyToB,
  earnedBadges,
  initialTheta,
  jakartaDate,
  newCard,
  outcomeScore,
  pushRecent,
  ratingFromOutcome,
  reviewCard,
  isRetired,
  updateTheta,
  weekView,
  weekCompleteCount,
  weekdayNameEn,
  answerXp,
  retryXp,
  DEFAULT_REQUIRED_SESSIONS,
  isAccessoryId,
  type XpTrack,
  type BadgeStats,
  type CardState,
  type DayRecord,
  type IsoDate,
} from '@kira/core'
import { tables } from '@kira/db'
import type { Item } from '@kira/content'
import type { Jenjang, LearnerShell, StreakDTO, AvatarName } from '@/lib/dto'
import type { OrgContext, Tx } from '../db'
import { notFound } from '../errors'
import { awardArenaBadges } from './arena-badges'
import { gradeOfSkill, subjectOfSkill } from './content'

const { learnerProfile, skillState, reviewCard: reviewCardT, xpEvent, dayRecord, restDay, badgeAward, response, attempt, quest } = tables

export type LearnerRow = typeof learnerProfile.$inferSelect

export function jenjangOf(grade: number): Jenjang {
  return grade <= 2 ? '1-2' : grade <= 4 ? '3-4' : '5-6'
}

export async function loadLearner(tx: Tx, learnerId: string): Promise<LearnerRow> {
  const rows = await tx.select().from(learnerProfile).where(and(eq(learnerProfile.userId, learnerId), isNull(learnerProfile.deletedAt))).limit(1)
  if (!rows[0]) throw notFound('Learner tidak ditemukan.')
  return rows[0]
}

/** XP satu jalur (bawaan: Belajar). Level dan bar Belajar tidak ikut XP arena. */
export async function totalXp(tx: Tx, learnerId: string, track: XpTrack = 'belajar'): Promise<number> {
  const rows = await tx.select({ n: sql<number>`coalesce(sum(${xpEvent.amount}), 0)::int` }).from(xpEvent).where(and(eq(xpEvent.learnerId, learnerId), eq(xpEvent.track, track)))
  return rows[0]?.n ?? 0
}

export async function dueReviewCount(tx: Tx, learnerId: string, today: IsoDate): Promise<number> {
  const endOfDay = new Date(Date.parse(`${today}T23:59:59+07:00`))
  const rows = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(reviewCardT)
    .where(and(eq(reviewCardT.learnerId, learnerId), eq(reviewCardT.retired, false), lte(reviewCardT.dueAt, endOfDay)))
  return rows[0]?.n ?? 0
}

export async function learnerShell(tx: Tx, learner: LearnerRow, today: IsoDate = jakartaDate()): Promise<LearnerShell> {
  return {
    learnerId: learner.userId,
    name: learner.name,
    avatar: learner.avatar as AvatarName,
    accessory: isAccessoryId(learner.avatarAccessory) ? learner.avatarAccessory : null,
    grade: learner.grade,
    jenjang: jenjangOf(learner.grade),
    showReview: learner.reviewEnabled,
    dueReviewCount: learner.reviewEnabled ? await dueReviewCount(tx, learner.userId, today) : 0,
  }
}

export async function isRestDay(tx: Tx, learner: LearnerRow, date: IsoDate): Promise<boolean> {
  const rows = await tx.select({ rest: restDay.rest }).from(restDay).where(and(eq(restDay.learnerId, learner.userId), eq(restDay.date, date))).limit(1)
  if (rows[0]) return rows[0].rest
  return learner.restWeekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay())
}

export async function dayRecords(tx: Tx, learner: LearnerRow, since: IsoDate): Promise<DayRecord[]> {
  const records = await tx
    .select({ date: dayRecord.date, questsDone: dayRecord.questsDone, questsRequired: dayRecord.questsRequired, rest: dayRecord.rest })
    .from(dayRecord)
    .where(and(eq(dayRecord.learnerId, learner.userId), gte(dayRecord.date, since)))
  const rests = await tx
    .select({ date: restDay.date, rest: restDay.rest })
    .from(restDay)
    .where(and(eq(restDay.learnerId, learner.userId), gte(restDay.date, since)))
  const byDate = new Map<string, DayRecord>()
  for (const r of records) byDate.set(r.date, { date: r.date, questsDone: r.questsDone, questsRequired: r.questsRequired, rest: r.rest })
  for (const r of rests) {
    const cur = byDate.get(r.date) ?? { date: r.date, questsDone: 0, questsRequired: DEFAULT_REQUIRED_SESSIONS }
    byDate.set(r.date, { ...cur, rest: r.rest })
  }
  return [...byDate.values()]
}

const DAY_LETTER: Record<string, string> = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' }

export async function streakFor(tx: Tx, learner: LearnerRow, today: IsoDate) {
  const since = learner.startedOn ?? today
  const days = await dayRecords(tx, learner, since)
  const result = computeStreak({ days, today, restWeekdays: learner.restWeekdays, since })
  return result
}

export async function streakDTO(tx: Tx, learner: LearnerRow, today: IsoDate): Promise<StreakDTO> {
  const result = await streakFor(tx, learner, today)
  const week = weekView(result, today, learner.restWeekdays)
  return {
    current: result.current,
    freezes: result.freezes,
    weekDone: weekCompleteCount(week),
    week: week.map((d) => {
      const long = weekdayNameEn(d.date)
      return { date: d.date, label: DAY_LETTER[long] ?? long.slice(0, 3), longLabel: long, status: d.status, isToday: d.isToday }
    }),
  }
}

/** Catat menit layar dari heartbeat (paling banyak 1 menit per 50 detik nyata). */
export async function addMinutes(tx: Tx, ctx: OrgContext, learnerId: string, date: IsoDate): Promise<{ minutes: number }> {
  const now = new Date()
  const rows = await tx
    .insert(dayRecord)
    .values({ orgId: ctx.orgId, learnerId, date, minutes: 0, lastPingAt: now })
    .onConflictDoUpdate({
      target: [dayRecord.learnerId, dayRecord.date],
      set: {
        minutes: sql`case when ${dayRecord.lastPingAt} is null or ${dayRecord.lastPingAt} < now() - interval '50 seconds' then ${dayRecord.minutes} + 1 else ${dayRecord.minutes} end`,
        lastPingAt: sql`case when ${dayRecord.lastPingAt} is null or ${dayRecord.lastPingAt} < now() - interval '50 seconds' then now() else ${dayRecord.lastPingAt} end`,
      },
    })
    .returning({ minutes: dayRecord.minutes })
  return { minutes: rows[0]?.minutes ?? 0 }
}

export async function minutesOn(tx: Tx, learnerId: string, date: IsoDate): Promise<number> {
  const rows = await tx.select({ m: dayRecord.minutes }).from(dayRecord).where(and(eq(dayRecord.learnerId, learnerId), eq(dayRecord.date, date))).limit(1)
  return rows[0]?.m ?? 0
}

export async function refreshDayRecord(tx: Tx, ctx: OrgContext, learnerId: string, date: IsoDate): Promise<void> {
  const counts = await tx
    .select({
      done: sql<number>`count(*) filter (where ${quest.status} = 'done' and ${quest.kind} = 'daily')::int`,
      required: sql<number>`count(*) filter (where ${quest.kind} = 'daily')::int`,
    })
    .from(quest)
    .where(and(eq(quest.learnerId, learnerId), eq(quest.date, date)))
  const done = counts[0]?.done ?? 0
  const required = counts[0]?.required ?? 0
  await tx
    .insert(dayRecord)
    .values({ orgId: ctx.orgId, learnerId, date, questsDone: done, questsRequired: required })
    .onConflictDoUpdate({ target: [dayRecord.learnerId, dayRecord.date], set: { questsDone: done, questsRequired: required } })
}

/**
 * Terapkan hasil satu jawaban ke mesin belajar: theta, gerbang, kartu Buku Koreksi.
 * Hanya percobaan pertama yang mengubah theta. Mengembalikan XP jawaban.
 */
export async function applyOutcome(
  tx: Tx,
  ctx: OrgContext,
  input: {
    learner: LearnerRow
    item: Item
    ref: string
    correct: boolean
    hintsUsed: number
    attemptNo: number
    timeMs: number
    mode: string
    date: IsoDate
    attemptId: string
    /** Percobaan ulang seluruh sesi: tidak mengubah penguasaan, dan XP hanya 25 persen. */
    retry?: boolean
  },
): Promise<number> {
  const { learner, item } = input
  if (input.attemptNo === 1 && !input.retry) {
    const rows = await tx
      .select()
      .from(skillState)
      .where(and(eq(skillState.learnerId, learner.userId), eq(skillState.skillId, item.skill)))
      .limit(1)
    const cur = rows[0]
    const theta0 = cur?.theta ?? initialTheta(learner.grade, gradeOfSkill(item.skill))
    const n0 = cur?.nAnswers ?? 0
    const s = outcomeScore({ correct: input.correct, hintsUsed: input.hintsUsed })
    const theta = updateTheta(theta0, n0, difficultyToB(item.difficulty), s)
    const recent = pushRecent(cur?.recent ?? [], s)
    const gate = computeGate({ nAnswers: n0 + 1, recentScores: recent, theta })
    await tx
      .insert(skillState)
      .values({ orgId: ctx.orgId, learnerId: learner.userId, skillId: item.skill, theta, nAnswers: n0 + 1, recent, gate: gate.gate, stars: gate.stars, lastPracticed: input.date })
      .onConflictDoUpdate({
        target: [skillState.learnerId, skillState.skillId],
        set: { theta, nAnswers: n0 + 1, recent, gate: gate.gate, stars: gate.stars, lastPracticed: input.date, updatedAt: new Date() },
      })

    // Buku Koreksi
    const now = new Date()
    const existing = await tx
      .select({ id: reviewCardT.id, card: reviewCardT.card })
      .from(reviewCardT)
      .where(and(eq(reviewCardT.learnerId, learner.userId), eq(reviewCardT.itemRef, input.ref)))
      .limit(1)
    const rating = ratingFromOutcome({ correct: input.correct, hintsUsed: input.hintsUsed, timeMs: input.timeMs, expectedMs: (item.expectedSeconds ?? 45) * 1000 })
    if (existing[0]) {
      const next = reviewCard(existing[0].card as CardState, rating, now)
      await tx
        .update(reviewCardT)
        .set({ card: next, dueAt: new Date(next.due), retired: isRetired(next), updatedAt: now })
        .where(eq(reviewCardT.id, existing[0].id))
    } else if (rating === 'again' || rating === 'hard') {
      const next = reviewCard(newCard(now), rating, now)
      await tx
        .insert(reviewCardT)
        .values({ orgId: ctx.orgId, learnerId: learner.userId, itemRef: input.ref, skillId: item.skill, subject: subjectOfSkill(item.skill), card: next, dueAt: new Date(next.due) })
        .onConflictDoNothing()
    }
  }
  const full = answerXp({ difficulty: item.difficulty, correct: input.correct, hintsUsed: input.hintsUsed, attemptNo: input.attemptNo })
  const xp = input.retry ? retryXp(full) : full
  if (xp > 0) {
    await tx.insert(xpEvent).values({ orgId: ctx.orgId, learnerId: learner.userId, amount: xp, reason: 'answer', ref: input.attemptId, date: input.date })
  }
  return xp
}

export async function grantXp(tx: Tx, ctx: OrgContext, learnerId: string, amount: number, reason: string, ref: string, date: IsoDate): Promise<void> {
  if (amount <= 0) return
  await tx.insert(xpEvent).values({ orgId: ctx.orgId, learnerId, amount, reason, ref, date })
}

/** Hitung statistik lencana lalu berikan lencana baru. Mengembalikan lencana yang baru didapat. */
export async function awardBadges(tx: Tx, ctx: OrgContext, learner: LearnerRow, today: IsoDate): Promise<{ id: string; title: string; description: string }[]> {
  const lid = learner.userId
  const one = async <T>(q: Promise<T[]>): Promise<T | undefined> => (await q)[0]
  const quests = await one(
    tx
      .select({
        done: sql<number>`count(*) filter (where ${quest.status} = 'done')::int`,
        subjectsToday: sql<number>`count(distinct ${quest.subject}) filter (where ${quest.status} = 'done' and ${quest.date} = ${today})::int`,
      })
      .from(quest)
      .where(eq(quest.learnerId, lid)),
  )
  const attempts = await one(
    tx
      .select({
        perfect: sql<number>`count(*) filter (where (${attempt.result}->>'perfect')::boolean is true and ${attempt.retryOf} is null)::int`,
        reviews: sql<number>`count(*) filter (where ${attempt.kind} = 'review' and ${attempt.submittedAt} is not null)::int`,
        sims: sql<number>`count(*) filter (where ${attempt.kind} in ('simulation', 'esmo-mock') and ${attempt.submittedAt} is not null)::int`,
        olympiad: sql<number>`count(*) filter (where (${attempt.result}->>'olympiad')::boolean is true and ${attempt.submittedAt} is not null and ${attempt.retryOf} is null)::int`,
        papers: sql<number>`count(*) filter (where ${attempt.result}->>'session' = 'paper' and ${attempt.submittedAt} is not null and ${attempt.retryOf} is null)::int`,
        papersPassed: sql<number>`count(*) filter (where ${attempt.result}->>'session' = 'paper' and (${attempt.result}->>'passed')::boolean is true and ${attempt.retryOf} is null)::int`,
        testsPerfect: sql<number>`count(*) filter (where ${attempt.result}->>'session' = 'tes' and (${attempt.result}->>'perfect')::boolean is true and ${attempt.retryOf} is null)::int`,
        testsEarly: sql<number>`count(*) filter (where ${attempt.result}->>'session' = 'tes' and (${attempt.result}->>'early')::boolean is true and ${attempt.retryOf} is null)::int`,
        retriesImproved: sql<number>`count(*) filter (where ${attempt.retryOf} is not null and (${attempt.result}->>'improved')::boolean is true)::int`,
        esmo: sql<number>`count(*) filter (where ${attempt.kind} = 'esmo-pack' and ${attempt.submittedAt} is not null)::int`,
      })
      .from(attempt)
      .where(eq(attempt.learnerId, lid)),
  )
  const responses = await one(
    tx
      .select({
        total: sql<number>`count(*)::int`,
        hintThenRight: sql<number>`count(*) filter (where ${response.status} = 'correct' and ${response.hintsUsed} > 0)::int`,
        speak: sql<number>`count(*) filter (where ${response.itemType} = 'speak' and ${response.status} <> 'blank')::int`,
        write: sql<number>`count(*) filter (where ${response.itemType} = 'write' and ${response.status} <> 'blank')::int`,
      })
      .from(response)
      .where(eq(response.learnerId, lid)),
  )
  const skills = await one(
    tx
      .select({
        mastered: sql<number>`count(*) filter (where ${skillState.gate} = 'mastered')::int`,
        lessons: sql<number>`count(*) filter (where ${skillState.lessonDoneAt} is not null)::int`,
      })
      .from(skillState)
      .where(eq(skillState.learnerId, lid)),
  )
  const streak = await streakFor(tx, learner, today)
  const stats: BadgeStats = {
    questsDone: quests?.done ?? 0,
    perfectQuests: attempts?.perfect ?? 0,
    answersTotal: responses?.total ?? 0,
    currentStreak: streak.current,
    bestStreak: streak.best,
    masteredSkills: skills?.mastered ?? 0,
    reviewSessions: attempts?.reviews ?? 0,
    simulationsDone: attempts?.sims ?? 0,
    olympiadPapersDone: attempts?.olympiad ?? 0,
    lessonsDone: skills?.lessons ?? 0,
    subjectsToday: quests?.subjectsToday ?? 0,
    hintsUsedThenCorrect: responses?.hintThenRight ?? 0,
    esmoPackagesDone: attempts?.esmo ?? 0,
    speakingDone: responses?.speak ?? 0,
    writingDone: responses?.write ?? 0,
    papersDone: attempts?.papers ?? 0,
    papersPassed: attempts?.papersPassed ?? 0,
    testsPerfect: attempts?.testsPerfect ?? 0,
    testsEarlyPerfect: attempts?.testsEarly ?? 0,
    retriesImproved: attempts?.retriesImproved ?? 0,
  }
  const have = new Set((await tx.select({ id: badgeAward.badgeId }).from(badgeAward).where(eq(badgeAward.learnerId, lid))).map((r) => r.id))
  const fresh = earnedBadges(stats, have)
  for (const b of fresh) {
    await tx.insert(badgeAward).values({ orgId: ctx.orgId, learnerId: lid, badgeId: b.id }).onConflictDoNothing()
  }
  const arena = await awardArenaBadges(tx, ctx, lid)
  return [...fresh, ...arena].map((b) => ({ id: b.id, title: b.title, description: b.description }))
}

export async function recentSeen(tx: Tx, learnerId: string, days = 30): Promise<Map<string, number>> {
  const since = new Date(Date.now() - days * 86400000)
  const rows = await tx
    .select({ ref: response.itemRef, at: sql<Date>`max(${response.answeredAt})` })
    .from(response)
    .where(and(eq(response.learnerId, learnerId), gte(response.answeredAt, since)))
    .groupBy(response.itemRef)
  const out = new Map<string, number>()
  for (const r of rows) out.set(r.ref, Math.floor((Date.now() - new Date(r.at).getTime()) / 86400000))
  return out
}

export async function skillStates(tx: Tx, learnerId: string) {
  const rows = await tx.select().from(skillState).where(eq(skillState.learnerId, learnerId))
  return new Map(rows.map((r) => [r.skillId, r]))
}

export async function badgesOf(tx: Tx, learnerId: string) {
  const rows = await tx.select().from(badgeAward).where(eq(badgeAward.learnerId, learnerId)).orderBy(desc(badgeAward.awardedAt))
  return rows
}

export { BADGES }
