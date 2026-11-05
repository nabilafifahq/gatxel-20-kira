import 'server-only'
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { accessoryById, addDays, ARENA_BADGES, BADGES, createRng, formatDateEn, formatDateId, jakartaDate, levelProgress, weekday, weekdayNameEn, weekdayNameId, type IsoDate } from '@kira/core'
import { activeSubjects, effectiveOn, skillAllowed } from '@kira/core/features'
import { tables } from '@kira/db'
import { AVATARS, type AvatarName } from '@kira/figures/spec'
import type { CorrectionBookDTO, LessonDTO, MapDTO, MapSkillDTO, MeDTO, Subject } from '@/lib/dto'
import { dictFor, type UiLang } from '@/lib/i18n'
import type { OrgContext, Tx } from '../db'
import { invalid, notFound } from '../errors'
import { lesson, promptPreview, resolveItems, skill, skillsFor, strandName, toClient } from './content'
import { guardAttemptItems } from './session-guard'
import { accessoryDTOs, trackDTOs, tracksFor } from './arena-tracks'
import { featureMapFor } from './learner-features'
import { trackTotals } from './arena-state'
import { badgesOf, learnerShell, loadLearner, lockLearnerScope, skillStates, streakFor, totalXp, type LearnerRow } from './learner-core'
import { assertFeatureOnTx } from './learner-features'
import { completeLinkedSession } from './learner-session'
import { buildQuestItems, SUBJECT_ORDER } from './learner-today'
import { withSayId } from './translations'

const { reviewCard, attempt, skillState, quest } = tables

export async function mapDTO(tx: Tx, learnerId: string, selected: Subject | null, lang: UiLang = 'en'): Promise<MapDTO> {
  const t = dictFor(lang)
  const learner = await loadLearner(tx, learnerId)
  const states = await skillStates(tx, learnerId)
  const today = jakartaDate()
  const todays = await tx.select({ skillId: quest.skillId }).from(quest).where(and(eq(quest.learnerId, learnerId), eq(quest.date, today)))
  const todaySkills = new Set(todays.map((t) => t.skillId))
  // Mapel yang dimatikan orang tua tidak muncul di peta. Skill olimpiade mengikuti saklar Olimpiade mapelnya.
  const features = await featureMapFor(tx, learnerId)
  const active = activeSubjects(features)
  const subjects = SUBJECT_ORDER.filter((s) => active.includes(s)).map((subject) => {
    const list = skillsFor(subject, learner.grade).filter((s) => skillAllowed(features, subject, s.strand))
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
      const chapter = s.strand === 'Oly' ? t.shell.map.olympiadChapter : strandName(s.strand)
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
  const selectedSubject = selected && active.includes(selected) ? selected : (subjects[0]?.subject ?? 'math')
  return { shell: await learnerShell(tx, learner), grade: learner.grade, subjects, selectedSubject }
}

export async function meDTO(tx: Tx, learnerId: string, lang: UiLang = 'en'): Promise<MeDTO> {
  const t = dictFor(lang)
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
  const monthName = (lang === 'id' ? formatDateId(first) : formatDateEn(first)).split(' ').slice(1).join(' ')
  const totals = await trackTotals(tx, learnerId)
  const features = await featureMapFor(tx, learnerId)
  return {
    shell: await learnerShell(tx, learner, today),
    level: lp.level,
    xp,
    xpIntoLevel: lp.into,
    xpLevelSpan: lp.span,
    xpToNext: lp.toNext,
    // Lencana Quick Maths yang belum didapat tidak ditampilkan bila Hitung cepat dimatikan orang tua.
    badges: [...BADGES, ...ARENA_BADGES].filter((b) => !b.id.startsWith('qm-') || effectiveOn(features, 'mental-math') || awarded.has(b.id)).map((b) => {
      const got = awarded.get(b.id)
      const text = t.shell.badges[b.id]
      return { id: b.id, title: text?.title ?? b.title, description: text?.desc ?? b.description, earnedAt: got ? got.awardedAt.toISOString() : null, isNew: Boolean(got && !got.seen), ...('glyph' in b ? { glyph: b.glyph } : {}) }
    }),
    tracks: tracksFor(trackDTOs(totals), features),
    accessories: accessoryDTOs(totals, features).map((a) => {
      const def = accessoryById(a.id)
      return { ...a, label: t.shell.accessories[a.id], howToEarn: def ? t.shell.accessoryHowToEarn(t.shell.accessoryEarnAt[def.track], def.level) : a.howToEarn }
    }),
    monthLabel: monthName,
    calendar: cells,
    streakLine: streak.current > 0 ? t.shell.me.streakLine(streak.current, streak.best) : t.shell.me.streakLineNone,
    avatars: [...AVATARS] as AvatarName[],
  }
}

export async function markBadgesSeen(tx: Tx, learnerId: string): Promise<void> {
  await tx.update(tables.badgeAward).set({ seen: true }).where(and(eq(tables.badgeAward.learnerId, learnerId), eq(tables.badgeAward.seen, false)))
}

export async function correctionBookDTO(tx: Tx, learnerId: string, lang: UiLang = 'en'): Promise<CorrectionBookDTO> {
  const t = dictFor(lang)
  const book = t.shell.reviewBook
  const learner = await loadLearner(tx, learnerId)
  const today = jakartaDate()
  const end = new Date(Date.parse(`${today}T23:59:59+07:00`))
  const features = await featureMapFor(tx, learnerId)
  const allDue = await tx
    .select()
    .from(reviewCard)
    .where(and(eq(reviewCard.learnerId, learnerId), eq(reviewCard.retired, false), lte(reviewCard.dueAt, end)))
    .orderBy(asc(reviewCard.dueAt))
  const due = allDue.filter((d) => skillAllowed(features, d.subject as Subject, skill(d.skillId)?.strand)).slice(0, 30)
  const resolved = await resolveItems(tx, due.map((d) => d.itemRef))
  const groups = SUBJECT_ORDER.map((s) => {
    const n = due.filter((d) => d.subject === s).length
    return { subject: s, title: t.common.subject[s], count: n, note: n === 0 ? book.nothingToday : book.cardsFromQuests(n) }
  }).filter((g) => g.count > 0)
  const upcoming = await tx
    .select({ day: sql<string>`to_char(${reviewCard.dueAt} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
    .from(reviewCard)
    .where(and(eq(reviewCard.learnerId, learnerId), eq(reviewCard.retired, false), gte(reviewCard.dueAt, end), inArray(reviewCard.subject, activeSubjects(features))))
    .groupBy(sql`1`)
    .orderBy(sql`1`)
    .limit(2)
  const comingBack = upcoming.length
    ? book.comingBack(upcoming.map((u) => (u.day === addDays(today, 1) ? book.cardsTomorrow(u.n) : book.cardsOn(u.n, lang === 'id' ? weekdayNameId(u.day as IsoDate) : weekdayNameEn(u.day as IsoDate)))).join(book.comingBackJoin))
    : null
  return {
    shell: await learnerShell(tx, learner, today),
    dueCount: due.length,
    groups,
    cards: due.slice(0, 12).map((d) => {
      const item = resolved.get(d.itemRef)
      return { subject: d.subject as Subject, prompt: item ? promptPreview(item, 80) : book.question, meta: `${t.common.subject[d.subject as Subject]}, ${skill(d.skillId)?.title ?? ''}` }
    }),
    comingBack,
    startHref: due.length > 0 ? '/review/start' : null,
  }
}

/** Sesi review: paling banyak 10 kartu jatuh tempo, mode review dengan umpan balik. */
export async function startReviewSession(tx: Tx, ctx: OrgContext, learnerId: string, lang: UiLang = 'en'): Promise<string> {
  const t = dictFor(lang)
  const today = jakartaDate()
  const open = await tx
    .select({ id: attempt.id })
    .from(attempt)
    .where(and(eq(attempt.learnerId, learnerId), eq(attempt.kind, 'review'), eq(attempt.status, 'in_progress')))
    .limit(1)
  if (open[0]) return open[0].id
  const end = new Date(Date.parse(`${today}T23:59:59+07:00`))
  const features = await featureMapFor(tx, learnerId)
  const allDue = await tx
    .select()
    .from(reviewCard)
    .where(and(eq(reviewCard.learnerId, learnerId), eq(reviewCard.retired, false), lte(reviewCard.dueAt, end)))
    .orderBy(asc(reviewCard.dueAt))
  const due = allDue.filter((d) => skillAllowed(features, d.subject as Subject, skill(d.skillId)?.strand)).slice(0, 10)
  if (due.length === 0) throw invalid(t.shell.reviewBook.noCards)
  const resolved = await resolveItems(tx, due.map((d) => d.itemRef))
  const dueItems = due
    .filter((d) => resolved.has(d.itemRef))
    .map((d, i) => ({ ref: d.itemRef, section: 'warmup' as const, position: i + 1, difficulty: resolved.get(d.itemRef)!.difficulty }))
  const items = await guardAttemptItems(tx, dueItems, { seed: `${learnerId}:${today}:review`, mode: 'review' })
  const subject = (due[0]!.subject as Subject) ?? 'math'
  const [row] = await tx
    .insert(attempt)
    .values({ orgId: ctx.orgId, learnerId, kind: 'review', mode: 'review', subject, title: t.shell.session.review, items })
    .returning({ id: attempt.id })
  return row!.id
}

/** Latihan cepat satu skill dari peta atau tombol Try a similar one. */
export async function startPractice(tx: Tx, ctx: OrgContext, learnerId: string, skillId: string): Promise<string> {
  const sk = skill(skillId)
  if (!sk) throw notFound()
  if (!skillAllowed(await featureMapFor(tx, learnerId), sk.subject, sk.strand)) throw notFound()
  const learner = await loadLearner(tx, learnerId)
  const items = await buildQuestItems(tx, ctx, learner, {
    skillId,
    subject: sk.subject,
    mode: 'latihan',
    date: jakartaDate(),
    seedKey: `${learnerId}:${Date.now()}:${skillId}`,
    length: 5,
  })
  // buildQuestItems sudah melewati penjaga set.
  const [row] = await tx
    .insert(attempt)
    .values({ orgId: ctx.orgId, learnerId, kind: 'test', mode: 'latihan', subject: sk.subject, title: sk.title, items })
    .returning({ id: attempt.id })
  return row!.id
}

export async function lessonDTO(tx: Tx, learnerId: string, skillId: string, then: string | null, lang: UiLang = 'en'): Promise<LessonDTO> {
  const learner = await loadLearner(tx, learnerId)
  const l = lesson(skillId)
  const sk = skill(skillId)
  if (!l || !sk) throw notFound('Pelajaran belum ada untuk skill ini.')
  if (!skillAllowed(await featureMapFor(tx, learnerId), sk.subject, sk.strand)) throw notFound('Pelajaran ini sedang dimatikan.')
  const minutes = Math.max(2, Math.round((l.steps.length * 20 + l.check.length * 45) / 60))
  return {
    shell: await learnerShell(tx, learner),
    skillId,
    subject: sk.subject,
    title: l.title,
    meta: dictFor(lang).shell.lessonMeta(strandName(sk.strand), minutes),
    steps: l.steps.map(withSayId),
    check: l.check.map((c) => toClient(c, { ref: c.id, seed: `${learnerId}:${skillId}`, includeKey: true, includeHints: true })),
    practiseHref: then && then.startsWith('/run/') ? then : `/practice/${skillId}`,
    backHref: then && then.startsWith('/run/') ? then : '/map',
  }
}

/**
 * Batas XP pelajaran per hari. Soal cek pelajaran dinilai di perangkat, jadi angka benar dari klien tidak bisa dipercaya
 * sepenuhnya. Sepuluh pelajaran sehari jauh di atas pemakaian anak sungguhan, tetapi skrip tidak bisa memanen XP dari semua skill.
 */
export const LESSON_XP_DAILY_CAP = 100

export async function completeLesson(tx: Tx, ctx: OrgContext, learnerId: string, skillId: string, correct: number, total: number): Promise<void> {
  const sk = skill(skillId)
  if (!sk) throw notFound()
  await assertFeatureOnTx(tx, learnerId, sk.subject)
  await lockLearnerScope(tx, 'lesson', learnerId)
  const today = jakartaDate()
  await tx
    .insert(skillState)
    .values({ orgId: ctx.orgId, learnerId, skillId, lessonDoneAt: new Date() })
    .onConflictDoUpdate({ target: [skillState.learnerId, skillState.skillId], set: { lessonDoneAt: new Date() } })
  // XP pelajaran sekali per skill per hari (indeks unik xp_event_lesson_once); panggilan ulang tidak menambah XP.
  if (correct > 0) {
    const [used] = await tx
      .select({ n: sql<number>`coalesce(sum(${tables.xpEvent.amount}), 0)::int` })
      .from(tables.xpEvent)
      .where(and(eq(tables.xpEvent.learnerId, learnerId), eq(tables.xpEvent.reason, 'lesson'), eq(tables.xpEvent.date, today)))
    const amount = Math.min(10, Math.min(correct, total) * 5, LESSON_XP_DAILY_CAP - (used?.n ?? 0))
    if (amount > 0) await tx.insert(tables.xpEvent).values({ orgId: ctx.orgId, learnerId, amount, reason: 'lesson', ref: skillId, date: today }).onConflictDoNothing()
  }
  // Sesi opsional "Lesson" untuk skill ini ikut selesai.
  await completeLinkedSession(tx, learnerId, jakartaDate(), { session: 'lesson', skillId })
}

export function randomFor(key: string) {
  return createRng(key)
}

export type { LearnerRow }
