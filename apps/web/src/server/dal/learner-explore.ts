import 'server-only'
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm'
import { addDays, BADGES, createRng, formatDateEn, jakartaDate, levelProgress, weekday, type IsoDate } from '@kira/core'
import { tables } from '@kira/db'
import { AVATARS, type AvatarName } from '@kira/figures/spec'
import type { CorrectionBookDTO, LessonDTO, MapDTO, MapSkillDTO, MeDTO, Subject } from '@/lib/dto'
import type { OrgContext, Tx } from '../db'
import { invalid, notFound } from '../errors'
import { lesson, promptPreview, resolveItems, skill, skillsFor, strandName, toClient } from './content'
import { badgesOf, dayRecords, learnerShell, loadLearner, skillStates, streakFor, totalXp, type LearnerRow } from './learner-core'
import { buildQuestItems, SUBJECT_ORDER } from './learner-today'

const { reviewCard, attempt, skillState, quest } = tables

const SUBJECT_LABEL: Record<Subject, string> = { math: 'Math', english: 'English', science: 'Science' }

export async function mapDTO(tx: Tx, learnerId: string, selected: Subject | null): Promise<MapDTO> {
  const learner = await loadLearner(tx, learnerId)
  const states = await skillStates(tx, learnerId)
  const today = jakartaDate()
  const todays = await tx.select({ skillId: quest.skillId }).from(quest).where(and(eq(quest.learnerId, learnerId), eq(quest.date, today)))
  const todaySkills = new Set(todays.map((t) => t.skillId))
  const subjects = SUBJECT_ORDER.map((subject) => {
    const list = skillsFor(subject, learner.grade)
    const gate = (id: string) => states.get(id)?.gate ?? 'new'
    const chapters = new Map<string, MapSkillDTO[]>()
    for (const s of list) {
      const st = states.get(s.id)
      const locked = s.prerequisites.some((p) => {
        const pre = skill(p)
        return pre && pre.grade === learner.grade && !['review', 'mastered'].includes(gate(p))
      })
      const state: MapSkillDTO['state'] = locked && !st
        ? 'locked'
        : !st || st.nAnswers === 0
          ? 'new'
          : st.gate === 'mastered'
            ? 'mastered'
            : st.gate === 'review'
              ? 'review'
              : 'learning'
      const chapter = s.strand === 'Oly' ? 'Olympiad thinking' : strandName(s.strand)
      const entry: MapSkillDTO = {
        id: s.id,
        title: s.title,
        canDo: s.canDo,
        state,
        stars: (st?.stars ?? 0) as 0 | 1 | 2 | 3,
        isToday: todaySkills.has(s.id),
        lessonHref: lesson(s.id) ? `/lesson/${s.id}` : null,
        practiseHref: state === 'locked' ? null : `/practice/${s.id}`,
      }
      chapters.set(chapter, [...(chapters.get(chapter) ?? []), entry])
    }
    return { subject, chapters: [...chapters.entries()].map(([title, skills]) => ({ title, skills })) }
  })
  return { shell: await learnerShell(tx, learner), grade: learner.grade, subjects, selectedSubject: selected ?? 'math' }
}

export async function meDTO(tx: Tx, learnerId: string): Promise<MeDTO> {
  const learner = await loadLearner(tx, learnerId)
  const xp = await totalXp(tx, learnerId)
  const lp = levelProgress(xp)
  const awards = await badgesOf(tx, learnerId)
  const awarded = new Map(awards.map((a) => [a.badgeId, a]))
  const today = jakartaDate()
  const month = today.slice(0, 7)
  const first = `${month}-01` as IsoDate
  const [yy, mm] = today.split('-').map(Number) as [number, number]
  const lastDay = new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10) as IsoDate
  const startPad = (weekday(first) + 6) % 7
  const gridStart = addDays(first, -startPad)
  const streak = await streakFor(tx, learner, today)
  const cells: MeDTO['calendar'] = []
  for (let d = gridStart; d <= lastDay || cells.length % 7 !== 0; d = addDays(d, 1)) {
    const status = streak.statusByDate.get(d) ?? (d > today ? 'upcoming' : 'none')
    cells.push({ date: d, day: Number(d.slice(8, 10)), status, inMonth: d.startsWith(month) })
    if (cells.length > 42) break
  }
  const monthName = formatDateEn(first).split(' ').slice(1).join(' ')
  return {
    shell: await learnerShell(tx, learner, today),
    level: lp.level,
    xp,
    xpIntoLevel: lp.into,
    xpLevelSpan: lp.span,
    xpToNext: lp.toNext,
    badges: BADGES.map((b) => {
      const got = awarded.get(b.id)
      return { id: b.id, title: b.title, description: b.description, earnedAt: got ? got.awardedAt.toISOString() : null, isNew: Boolean(got && !got.seen) }
    }),
    monthLabel: monthName,
    calendar: cells,
    streakLine: streak.current > 0 ? `${streak.current} day streak. Best: ${streak.best}.` : 'Finish today’s quests to start a streak.',
    avatars: [...AVATARS] as AvatarName[],
  }
}

export async function markBadgesSeen(tx: Tx, learnerId: string): Promise<void> {
  await tx.update(tables.badgeAward).set({ seen: true }).where(and(eq(tables.badgeAward.learnerId, learnerId), eq(tables.badgeAward.seen, false)))
}

export async function correctionBookDTO(tx: Tx, learnerId: string): Promise<CorrectionBookDTO> {
  const learner = await loadLearner(tx, learnerId)
  const today = jakartaDate()
  const end = new Date(Date.parse(`${today}T23:59:59+07:00`))
  const due = await tx
    .select()
    .from(reviewCard)
    .where(and(eq(reviewCard.learnerId, learnerId), eq(reviewCard.retired, false), lte(reviewCard.dueAt, end)))
    .orderBy(asc(reviewCard.dueAt))
    .limit(30)
  const resolved = await resolveItems(tx, due.map((d) => d.itemRef))
  const groups = SUBJECT_ORDER.map((s) => {
    const n = due.filter((d) => d.subject === s).length
    return { subject: s, title: SUBJECT_LABEL[s], count: n, note: n === 0 ? 'Nothing today' : `${n} card${n === 1 ? '' : 's'} from your quests` }
  }).filter((g) => g.count > 0)
  const upcoming = await tx
    .select({ day: sql<string>`to_char(${reviewCard.dueAt} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
    .from(reviewCard)
    .where(and(eq(reviewCard.learnerId, learnerId), eq(reviewCard.retired, false), gte(reviewCard.dueAt, end)))
    .groupBy(sql`1`)
    .orderBy(sql`1`)
    .limit(2)
  const comingBack = upcoming.length
    ? `Coming back: ${upcoming.map((u) => `${u.n} card${u.n === 1 ? '' : 's'} ${u.day === addDays(today, 1) ? 'tomorrow' : `on ${formatDateEn(u.day as IsoDate, true).split(' ')[0]}`}`).join(' and ')}.`
    : null
  return {
    shell: await learnerShell(tx, learner, today),
    dueCount: due.length,
    groups,
    cards: due.slice(0, 12).map((d) => {
      const item = resolved.get(d.itemRef)
      return { subject: d.subject as Subject, prompt: item ? promptPreview(item, 80) : 'Question', meta: `${SUBJECT_LABEL[d.subject as Subject]}, ${skill(d.skillId)?.title ?? ''}` }
    }),
    comingBack,
    startHref: due.length > 0 ? '/review/start' : null,
  }
}

/** Sesi review: paling banyak 10 kartu jatuh tempo, mode review dengan umpan balik. */
export async function startReviewSession(tx: Tx, ctx: OrgContext, learnerId: string): Promise<string> {
  const today = jakartaDate()
  const open = await tx
    .select({ id: attempt.id })
    .from(attempt)
    .where(and(eq(attempt.learnerId, learnerId), eq(attempt.kind, 'review'), eq(attempt.status, 'in_progress')))
    .limit(1)
  if (open[0]) return open[0].id
  const end = new Date(Date.parse(`${today}T23:59:59+07:00`))
  const due = await tx
    .select()
    .from(reviewCard)
    .where(and(eq(reviewCard.learnerId, learnerId), eq(reviewCard.retired, false), lte(reviewCard.dueAt, end)))
    .orderBy(asc(reviewCard.dueAt))
    .limit(10)
  if (due.length === 0) throw invalid('No review cards today.')
  const resolved = await resolveItems(tx, due.map((d) => d.itemRef))
  const items = due
    .filter((d) => resolved.has(d.itemRef))
    .map((d, i) => ({ ref: d.itemRef, section: 'warmup' as const, position: i + 1, difficulty: resolved.get(d.itemRef)!.difficulty }))
  const subject = (due[0]!.subject as Subject) ?? 'math'
  const [row] = await tx
    .insert(attempt)
    .values({ orgId: ctx.orgId, learnerId, kind: 'review', mode: 'review', subject, title: 'Review cards', items })
    .returning({ id: attempt.id })
  return row!.id
}

/** Latihan cepat satu skill dari peta atau tombol Try a similar one. */
export async function startPractice(tx: Tx, ctx: OrgContext, learnerId: string, skillId: string): Promise<string> {
  const sk = skill(skillId)
  if (!sk) throw notFound()
  const learner = await loadLearner(tx, learnerId)
  const items = await buildQuestItems(tx, ctx, learner, {
    skillId,
    subject: sk.subject,
    mode: 'latihan',
    date: jakartaDate(),
    seedKey: `${learnerId}:${Date.now()}:${skillId}`,
    length: 5,
  })
  const [row] = await tx
    .insert(attempt)
    .values({ orgId: ctx.orgId, learnerId, kind: 'test', mode: 'latihan', subject: sk.subject, title: sk.title, items })
    .returning({ id: attempt.id })
  return row!.id
}

export async function lessonDTO(tx: Tx, learnerId: string, skillId: string, then: string | null): Promise<LessonDTO> {
  const learner = await loadLearner(tx, learnerId)
  const l = lesson(skillId)
  const sk = skill(skillId)
  if (!l || !sk) throw notFound('Pelajaran belum ada untuk skill ini.')
  const minutes = Math.max(2, Math.round((l.steps.length * 20 + l.check.length * 45) / 60))
  return {
    shell: await learnerShell(tx, learner),
    skillId,
    subject: sk.subject,
    title: l.title,
    meta: `${strandName(sk.strand)}. About ${minutes} minutes.`,
    steps: l.steps,
    check: l.check.map((c) => toClient(c, { ref: c.id, seed: `${learnerId}:${skillId}`, includeKey: true, includeHints: true })),
    practiseHref: then && then.startsWith('/run/') ? then : `/practice/${skillId}`,
    backHref: then && then.startsWith('/run/') ? then : '/map',
  }
}

export async function completeLesson(tx: Tx, ctx: OrgContext, learnerId: string, skillId: string, correct: number, total: number): Promise<void> {
  if (!skill(skillId)) throw notFound()
  await tx
    .insert(skillState)
    .values({ orgId: ctx.orgId, learnerId, skillId, lessonDoneAt: new Date() })
    .onConflictDoUpdate({ target: [skillState.learnerId, skillState.skillId], set: { lessonDoneAt: new Date() } })
  if (correct > 0) {
    await tx.insert(tables.xpEvent).values({ orgId: ctx.orgId, learnerId, amount: Math.min(10, correct * 5), reason: 'lesson', ref: skillId, date: jakartaDate() })
  }
  void total
}

export function randomFor(key: string) {
  return createRng(key)
}

export type { LearnerRow }
