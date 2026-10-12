import 'server-only'
import { and, asc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'
import {
  addDays,
  assembleQuest,
  chooseSkill,
  createRng,
  daysBetween,
  estimateMinutes,
  formatDateEn,
  jakartaDate,
  weekdayNameEn,
  type IsoDate,
  type QuestSlot,
} from '@kira/core'
import { tables } from '@kira/db'
import { genRef, newSeed } from '@kira/content/math'
import type { DoneTodayDTO, QuestIntroDTO, QuestStopDTO, SegmentState, Subject, TodayDTO } from '@/lib/dto'
import type { OrgContext, Tx } from '../db'
import { notFound } from '../errors'
import { lesson, poolForSkill, skill, skillsFor, resolveItems } from './content'
import { learnerShell, loadLearner, minutesOn, recentSeen, refreshDayRecord, skillStates, streakDTO, isRestDay, type LearnerRow } from './learner-core'

const { quest, attempt, response, planSlot, planWeek, reviewCard, competitionEvent, paper, orgItem } = tables

export const SUBJECT_ORDER: Subject[] = ['math', 'english', 'science']
export const SUBJECT_LABEL: Record<Subject, string> = { math: 'Math', english: 'English', science: 'Science' }

type QuestRow = typeof quest.$inferSelect
type AttemptItem = { ref: string; section: QuestSlot['section']; position: number; difficulty: number }

const MANUAL_STRANDS = new Set(['Wc', 'SL', 'Wp'])

function questLength(learner: LearnerRow, mode: string): number {
  if (mode === 'belajar') return 6
  return learner.grade <= 1 ? 8 : 10
}

/** Ubah kandidat generator tanpa seed menjadi ref lengkap dengan seed baru. */
function materialise(ref: string, rng: ReturnType<typeof createRng>): string {
  const m = /^gen:([mes][1-6]\.[a-z0-9-]+):([1-5])$/.exec(ref)
  return m ? genRef(m[1]!, Number(m[2]) as 1 | 2 | 3 | 4 | 5, newSeed(rng)) : ref
}

export async function buildQuestItems(
  tx: Tx,
  ctx: OrgContext,
  learner: LearnerRow,
  input: { skillId: string; subject: Subject; mode: 'belajar' | 'latihan'; date: IsoDate; seedKey: string; length?: number },
): Promise<AttemptItem[]> {
  const rng = createRng(input.seedKey)
  const sk = skill(input.skillId)
  const allowManual = sk ? MANUAL_STRANDS.has(sk.strand) : false
  const pool = await poolForSkill(tx, ctx.orgId, input.skillId, { allowManual })
  const seen = await recentSeen(tx, learner.userId)
  const states = await skillStates(tx, learner.userId)
  const theta = states.get(input.skillId)?.theta ?? 0
  const due = learner.reviewEnabled
    ? await tx
        .select({ ref: reviewCard.itemRef })
        .from(reviewCard)
        .where(and(eq(reviewCard.learnerId, learner.userId), eq(reviewCard.subject, input.subject), eq(reviewCard.retired, false), lte(reviewCard.dueAt, new Date(Date.parse(`${input.date}T23:59:59+07:00`)))))
        .orderBy(asc(reviewCard.dueAt))
        .limit(3)
    : []
  const dueItems = await resolveItems(tx, due.map((d) => d.ref))
  const length = input.length ?? questLength(learner, input.mode)
  let slots: QuestSlot[]
  const manual = pool.filter((p) => p.manual)
  if (allowManual && manual.length > 0) {
    // Skill menulis atau berbicara: satu tugas yang dinilai tutor ditambah soal otomatis.
    const auto = pool.filter((p) => !p.manual)
    const pickManual = rng.pick(manual.filter((m) => !seen.has(m.ref)).length ? manual.filter((m) => !seen.has(m.ref)) : manual)
    const rest = assembleQuest({ mode: input.mode, theta, dueRefs: [], candidates: auto.map((c) => ({ ...c, ...(seen.has(c.ref) ? { seenDaysAgo: seen.get(c.ref)! } : {}) })), length: Math.max(0, Math.min(4, auto.length)), rng })
    slots = [...rest, { ref: pickManual.ref, section: 'core', difficulty: pickManual.difficulty }]
  } else {
    slots = assembleQuest({
      mode: input.mode,
      theta,
      dueRefs: [...dueItems.entries()].map(([ref, item]) => ({ ref, difficulty: item.difficulty })),
      candidates: pool.map((c) => ({ ...c, ...(seen.has(c.ref) && !c.unlimited ? { seenDaysAgo: seen.get(c.ref)! } : {}) })),
      length,
      rng,
    })
  }
  return slots.map((s, i) => ({ ref: materialise(s.ref, rng), section: s.section, position: i + 1, difficulty: s.difficulty }))
}

/** Pilih skill otomatis untuk satu mapel bila tutor belum merencanakan. */
function autoSkill(learner: LearnerRow, subject: Subject, states: Awaited<ReturnType<typeof skillStates>>, seedKey: string) {
  const list = skillsFor(subject, learner.grade).filter((s) => s.strand !== 'Oly')
  const progress = list.map((s) => ({
    id: s.id,
    order: s.order,
    gate: states.get(s.id)?.gate ?? ('new' as const),
    prerequisites: s.prerequisites,
    lastPracticed: states.get(s.id)?.lastPracticed ?? null,
  }))
  return chooseSkill(progress, createRng(seedKey))
}

async function createAttemptFor(tx: Tx, ctx: OrgContext, learner: LearnerRow, q: { id: string; subject: Subject; skillId: string | null; paperId: string | null; mode: string; title: string; kind: string; date: IsoDate }): Promise<string> {
  let items: AttemptItem[] = []
  let timeLimit: number | null = null
  let mode = q.mode
  if (q.paperId) {
    const p = await tx.select().from(paper).where(eq(paper.id, q.paperId)).limit(1)
    if (p[0]) {
      const resolved = await resolveItems(tx, p[0].itemRefs)
      items = p[0].itemRefs.map((ref, i) => ({ ref, section: 'core' as const, position: i + 1, difficulty: resolved.get(ref)?.difficulty ?? 3 }))
      if (p[0].mode === 'tes') {
        timeLimit = p[0].minutes * 60
        mode = 'tes'
      }
    }
  } else if (q.skillId) {
    items = await buildQuestItems(tx, ctx, learner, {
      skillId: q.skillId,
      subject: q.subject,
      mode: q.mode === 'belajar' ? 'belajar' : 'latihan',
      date: q.date,
      seedKey: `${learner.userId}:${q.date}:${q.subject}:${q.kind}`,
      ...(q.kind === 'bonus' ? { length: 6 } : {}),
    })
  }
  const [row] = await tx
    .insert(attempt)
    .values({
      orgId: ctx.orgId,
      learnerId: learner.userId,
      kind: 'quest',
      refId: q.id,
      mode: (mode === 'kertas' ? 'kertas' : mode) as 'belajar' | 'latihan' | 'tes' | 'kertas',
      subject: q.subject,
      title: q.title,
      items,
      timeLimitS: timeLimit,
    })
    .returning({ id: attempt.id })
  await tx.update(quest).set({ attemptId: row!.id }).where(eq(quest.id, q.id))
  return row!.id
}

/** Buat quest hari ini bila belum ada: dari rencana tutor yang sudah terbit, atau dipilih otomatis. */
export async function ensureTodayQuests(tx: Tx, ctx: OrgContext, learner: LearnerRow, date: IsoDate): Promise<QuestRow[]> {
  const existing = await tx.select().from(quest).where(and(eq(quest.learnerId, learner.userId), eq(quest.date, date)))
  if (existing.some((q) => q.kind === 'daily')) {
    for (const q of existing) if (!q.attemptId) await createAttemptFor(tx, ctx, learner, { ...q, date })
    return tx.select().from(quest).where(and(eq(quest.learnerId, learner.userId), eq(quest.date, date)))
  }
  if (await isRestDay(tx, learner, date)) return existing
  const slots = await tx
    .select({ subject: planSlot.subject, kind: planSlot.kind, skillId: planSlot.skillId, paperId: planSlot.paperId, mode: planSlot.mode })
    .from(planSlot)
    .innerJoin(planWeek, eq(planSlot.planWeekId, planWeek.id))
    .where(and(eq(planSlot.learnerId, learner.userId), eq(planSlot.date, date), eq(planWeek.status, 'published')))
  const states = await skillStates(tx, learner.userId)
  const papers = new Map<string, string>()
  const paperIds = slots.map((s) => s.paperId).filter((x): x is string => Boolean(x))
  if (paperIds.length) for (const p of await tx.select({ id: paper.id, title: paper.title }).from(paper).where(inArray(paper.id, paperIds))) papers.set(p.id, p.title)

  for (const subject of SUBJECT_ORDER) {
    const slot = slots.find((s) => s.subject === subject && s.kind === 'quest')
    let skillId = slot?.skillId ?? null
    let mode: 'belajar' | 'latihan' | 'tes' | 'kertas' = slot?.mode ?? 'latihan'
    if (!slot) {
      const chosen = autoSkill(learner, subject, states, `${learner.userId}:${date}:${subject}`)
      if (!chosen) continue
      skillId = chosen.id
      mode = chosen.gate === 'new' && lesson(chosen.id) ? 'belajar' : 'latihan'
    }
    const title = slot?.paperId ? (papers.get(slot.paperId) ?? 'Paper') : (skill(skillId ?? '')?.title ?? SUBJECT_LABEL[subject])
    const [q] = await tx
      .insert(quest)
      .values({ orgId: ctx.orgId, learnerId: learner.userId, date, subject, kind: 'daily', skillId, paperId: slot?.paperId ?? null, mode, title })
      .onConflictDoNothing()
      .returning()
    if (q) await createAttemptFor(tx, ctx, learner, { ...q, date })
  }
  await refreshDayRecord(tx, ctx, learner.userId, date)
  return tx.select().from(quest).where(and(eq(quest.learnerId, learner.userId), eq(quest.date, date)))
}

/** Quest bonus terbuka setelah tiga quest harian selesai. */
export async function ensureBonusQuest(tx: Tx, ctx: OrgContext, learner: LearnerRow, date: IsoDate, quests: QuestRow[]): Promise<QuestRow | null> {
  const bonus = quests.find((q) => q.kind === 'bonus')
  if (bonus) return bonus
  const daily = quests.filter((q) => q.kind === 'daily')
  if (daily.length === 0 || daily.some((q) => q.status !== 'done')) return null
  const slot = await tx
    .select({ subject: planSlot.subject, skillId: planSlot.skillId })
    .from(planSlot)
    .innerJoin(planWeek, eq(planSlot.planWeekId, planWeek.id))
    .where(and(eq(planSlot.learnerId, learner.userId), eq(planSlot.date, date), eq(planSlot.kind, 'bonus'), eq(planWeek.status, 'published')))
    .limit(1)
  const states = await skillStates(tx, learner.userId)
  let subject: Subject = (slot[0]?.subject as Subject) ?? 'math'
  let skillId = slot[0]?.skillId ?? null
  if (!skillId) {
    // Mapel dengan skill reteach atau review paling banyak di grade ini.
    const scores = SUBJECT_ORDER.map((s) => ({
      s,
      weak: skillsFor(s, learner.grade).filter((sk) => ['reteach', 'review'].includes(states.get(sk.id)?.gate ?? 'new')).length,
    })).sort((a, b) => b.weak - a.weak)
    subject = scores[0]!.s
    skillId = autoSkill(learner, subject, states, `${learner.userId}:${date}:bonus`)?.id ?? null
  }
  if (!skillId) return null
  const [q] = await tx
    .insert(quest)
    .values({ orgId: ctx.orgId, learnerId: learner.userId, date, subject, kind: 'bonus', skillId, mode: 'latihan', title: skill(skillId)?.title ?? 'Bonus quest' })
    .onConflictDoNothing()
    .returning()
  if (!q) return null
  await createAttemptFor(tx, ctx, learner, { ...q, date })
  const fresh = await tx.select().from(quest).where(eq(quest.id, q.id)).limit(1)
  return fresh[0] ?? null
}

type Progress = { total: number; answered: number; segments: SegmentState[] }

export async function attemptProgress(tx: Tx, attemptIds: string[]): Promise<Map<string, Progress>> {
  const out = new Map<string, Progress>()
  if (attemptIds.length === 0) return out
  const atts = await tx.select({ id: attempt.id, items: attempt.items, mode: attempt.mode }).from(attempt).where(inArray(attempt.id, attemptIds))
  const resp = await tx
    .select({ attemptId: response.attemptId, position: response.position, attemptNo: response.attemptNo, status: response.status })
    .from(response)
    .where(inArray(response.attemptId, attemptIds))
  for (const a of atts) {
    const items = (a.items as AttemptItem[]) ?? []
    const latest = new Map<number, { no: number; status: string }>()
    for (const r of resp.filter((x) => x.attemptId === a.id)) {
      const cur = latest.get(r.position)
      if (!cur || r.attemptNo > cur.no) latest.set(r.position, { no: r.attemptNo, status: r.status })
    }
    const hide = a.mode === 'tes' || a.mode === 'simulasi' || a.mode === 'kertas'
    let currentMarked = false
    const segments: SegmentState[] = items.map((it) => {
      const l = latest.get(it.position)
      if (!l) {
        if (!currentMarked) {
          currentMarked = true
          return 'current'
        }
        return 'todo'
      }
      if (hide) return 'answered'
      return l.status === 'correct' ? 'correct' : l.status === 'pending' ? 'answered' : 'not-yet'
    })
    out.set(a.id, { total: items.length, answered: latest.size, segments })
  }
  return out
}

function stopFor(q: QuestRow, p: Progress | undefined, active: boolean): QuestStopDTO {
  const total = p?.total ?? 0
  const answered = p?.answered ?? 0
  const label = SUBJECT_LABEL[q.subject as Subject]
  const minutesLeft = estimateMinutes(Math.max(1, total - answered))
  const state: QuestStopDTO['state'] = q.status === 'done' ? 'done' : answered > 0 ? 'in-progress' : 'ready'
  const meta =
    state === 'done'
      ? `${label}, done`
      : state === 'in-progress'
        ? `${label}, ${answered} of ${total} done, about ${minutesLeft} minutes left`
        : `${total} questions, about ${estimateMinutes(total)} minutes`
  return {
    questId: q.id,
    subject: q.kind === 'bonus' ? 'bonus' : (q.subject as Subject),
    state,
    title: q.title,
    meta,
    total,
    answered,
    segments: p?.segments ?? [],
    href: state === 'done' ? (q.attemptId ? `/results/${q.attemptId}` : null) : state === 'in-progress' && q.attemptId ? `/run/${q.attemptId}` : `/quest/${q.id}`,
    ctaLabel: state === 'done' ? 'See answers' : state === 'in-progress' ? 'Continue' : active ? 'Start' : 'Start',
    offlineReady: Boolean(q.attemptId),
  }
}

export async function nextCompetition(tx: Tx, learnerId: string, today: IsoDate) {
  const rows = await tx
    .select({ name: competitionEvent.name, date: competitionEvent.date, ids: competitionEvent.learnerIds })
    .from(competitionEvent)
    .where(and(gte(competitionEvent.date, today), eq(competitionEvent.dateIsEstimate, false)))
    .orderBy(asc(competitionEvent.date))
  const r = rows.find((x) => x.ids.length === 0 || x.ids.includes(learnerId))
  return r?.date ? { name: r.name, daysToGo: daysBetween(today, r.date), date: r.date } : null
}

export async function hasEsmo(tx: Tx, learnerId: string, today: IsoDate): Promise<boolean> {
  const ev = await tx
    .select({ id: competitionEvent.id, ids: competitionEvent.learnerIds })
    .from(competitionEvent)
    .where(and(eq(competitionEvent.competitionId, 'esmo'), gte(competitionEvent.date, today)))
  if (ev.some((e) => e.ids.length === 0 || e.ids.includes(learnerId))) return true
  const packs = await tx.select({ n: sql<number>`count(*)::int` }).from(orgItem).where(and(sql`${orgItem.collection} like 'esmo:%'`, isNull(orgItem.retiredAt)))
  return (packs[0]?.n ?? 0) > 0
}

export async function todayDTO(tx: Tx, ctx: OrgContext, learnerId: string): Promise<TodayDTO> {
  const date = jakartaDate()
  const loaded = await loadLearner(tx, learnerId)
  // started_on diisi oleh ensureStarted() sebelum transaksi ini (learner tidak boleh mengubah profilnya sendiri).
  const learner = loaded.startedOn ? loaded : { ...loaded, startedOn: date }
  const shell = await learnerShell(tx, learner, date)
  const rest = await isRestDay(tx, learner, date)
  let quests = rest ? [] : await ensureTodayQuests(tx, ctx, learner, date)
  const bonus = await ensureBonusQuest(tx, ctx, learner, date, quests)
  if (bonus && !quests.some((q) => q.id === bonus.id)) quests = [...quests, bonus]
  const daily = quests.filter((q) => q.kind === 'daily').sort((a, b) => SUBJECT_ORDER.indexOf(a.subject as Subject) - SUBJECT_ORDER.indexOf(b.subject as Subject))
  const progress = await attemptProgress(tx, quests.map((q) => q.attemptId).filter((x): x is string => Boolean(x)))
  const activeIdx = daily.findIndex((q) => q.status !== 'done')
  const stops = daily.map((q, i) => stopFor(q, q.attemptId ? progress.get(q.attemptId) : undefined, i === activeIdx))
  const bonusQ = quests.find((q) => q.kind === 'bonus')
  const allDone = daily.length > 0 && activeIdx === -1
  const bonusStop: QuestStopDTO | null = bonusQ
    ? stopFor(bonusQ, bonusQ.attemptId ? progress.get(bonusQ.attemptId) : undefined, false)
    : daily.length > 0
      ? { questId: null, subject: 'bonus', state: 'locked', title: 'Bonus quest', meta: 'Opens after all three', total: 0, answered: 0, segments: [], href: null, ctaLabel: 'Locked', offlineReady: false }
      : null
  const minutes = await minutesOn(tx, learner.userId, date)
  const streak = await streakDTO(tx, learner, date)
  const anyAnswers = stops.some((s) => s.answered > 0) || streak.current > 0
  const variant: TodayDTO['variant'] = rest
    ? 'rest-day'
    : minutes >= learner.screenLimitMin
      ? 'time-limit'
      : allDone
        ? 'all-done'
        : learner.startedOn === date && !anyAnswers
          ? 'first-day'
          : 'normal'
  const active = activeIdx >= 0 ? stops[activeIdx] : undefined
  const doneCount = daily.filter((q) => q.status === 'done').length
  const subline =
    variant === 'rest-day'
      ? 'Today is a rest day. Your streak is safe.'
      : variant === 'time-limit'
        ? 'That is enough screen time for today. Well done.'
        : variant === 'all-done'
          ? bonusQ && bonusQ.status !== 'done'
            ? 'All three are done. A bonus quest is open.'
            : 'All three quests are done. See you tomorrow.'
          : active?.state === 'in-progress'
            ? `${SUBJECT_LABEL[(active.subject === 'bonus' ? 'math' : active.subject) as Subject]} is ${active.answered * 2 >= active.total ? 'half done' : 'started'}.`
            : doneCount === 0
              ? 'Three quests today. Start with the big one.'
              : `${doneCount} of ${daily.length} done. Keep going.`
  const comp = await nextCompetition(tx, learner.userId, date)
  return {
    shell,
    dateLabel: formatDateEn(date, true),
    headline: variant === 'first-day' ? 'Your first quests' : `${weekdayNameEn(date)}'s quests`,
    subline,
    variant,
    streak,
    stops,
    activeIndex: activeIdx >= 0 ? activeIdx : null,
    bonus: bonusStop,
    nextCompetition: comp ? { name: comp.name, daysToGo: comp.daysToGo } : null,
    esmo: (await hasEsmo(tx, learner.userId, date)) ? { href: '/esmo', label: 'ESMO practice packs' } : null,
    minutesToday: minutes,
    screenLimitMin: learner.screenLimitMin,
  }
}

export async function questIntroDTO(tx: Tx, ctx: OrgContext, learnerId: string, questId: string): Promise<QuestIntroDTO> {
  const learner = await loadLearner(tx, learnerId)
  const rows = await tx.select().from(quest).where(and(eq(quest.id, questId), eq(quest.learnerId, learnerId))).limit(1)
  const q = rows[0]
  if (!q) throw notFound()
  if (!q.attemptId) await createAttemptFor(tx, ctx, learner, { ...q, date: q.date })
  const fresh = (await tx.select().from(quest).where(eq(quest.id, questId)).limit(1))[0]!
  const att = (await tx.select({ items: attempt.items, mode: attempt.mode }).from(attempt).where(eq(attempt.id, fresh.attemptId!)).limit(1))[0]
  const items = (att?.items as AttemptItem[]) ?? []
  const sk = q.skillId ? skill(q.skillId) : undefined
  const l = q.skillId ? lesson(q.skillId) : undefined
  const subject = q.subject as Subject
  const others = await tx.select().from(quest).where(and(eq(quest.learnerId, learnerId), eq(quest.date, q.date), eq(quest.kind, 'daily')))
  const alt = others.find((o) => o.id !== q.id && o.status !== 'done')
  const modeLabel = att?.mode === 'tes' ? 'Timed test' : q.mode === 'belajar' ? 'Learn and practise' : q.kind === 'bonus' ? 'Bonus practice' : 'Practice'
  const practise = sk ? [sk.title, sk.canDo.replace(/^I can /, '').replace(/\.$/, '')].map((s) => s.charAt(0).toUpperCase() + s.slice(1)) : [q.title]
  return {
    shell: await learnerShell(tx, learner),
    questId: q.id,
    subject,
    title: q.title,
    questionCount: items.length,
    minutes: estimateMinutes(items.length),
    hintsPerQuestion: att?.mode === 'tes' ? 0 : 3,
    youWillPractise: practise,
    modeLabel,
    lessonHref: l && q.mode === 'belajar' ? `/lesson/${q.skillId}?then=${encodeURIComponent(`/run/${fresh.attemptId}`)}` : l ? `/lesson/${q.skillId}` : null,
    startHref: `/run/${fresh.attemptId}`,
    alternative: alt ? { subject: alt.subject as Subject, href: `/quest/${alt.id}` } : null,
  }
}

export async function doneTodayDTO(tx: Tx, ctx: OrgContext, learnerId: string): Promise<DoneTodayDTO> {
  const date = jakartaDate()
  const learner = await loadLearner(tx, learnerId)
  const quests = await tx.select().from(quest).where(and(eq(quest.learnerId, learnerId), eq(quest.date, date)))
  const attIds = quests.map((q) => q.attemptId).filter((x): x is string => Boolean(x))
  const atts = attIds.length ? await tx.select().from(attempt).where(inArray(attempt.id, attIds)) : []
  const minutes = await minutesOn(tx, learnerId, date)
  const xp = await tx
    .select({ n: sql<number>`coalesce(sum(${tables.xpEvent.amount}), 0)::int` })
    .from(tables.xpEvent)
    .where(and(eq(tables.xpEvent.learnerId, learnerId), eq(tables.xpEvent.date, date)))
  const limit = minutes >= learner.screenLimitMin
  const allDone = quests.filter((q) => q.kind === 'daily').every((q) => q.status === 'done')
  const variant: DoneTodayDTO['variant'] = limit && !allDone ? 'time-limit' : 'all-done'
  const tomorrow = addDays(date, 1)
  return {
    shell: await learnerShell(tx, learner, date),
    variant,
    title: variant === 'time-limit' ? 'Time for a break' : 'Done for today',
    line: variant === 'time-limit' ? `You learned for ${minutes} minutes today. Your answers are saved.` : 'You finished your quests. Your streak grows.',
    xpToday: xp[0]?.n ?? 0,
    minutesToday: minutes,
    quests: quests
      .sort((a, b) => SUBJECT_ORDER.indexOf(a.subject as Subject) - SUBJECT_ORDER.indexOf(b.subject as Subject))
      .map((q) => {
        const a = atts.find((x) => x.id === q.attemptId)
        const items = ((a?.items as AttemptItem[]) ?? []).length
        return {
          subject: q.subject as Subject,
          title: q.title,
          score: q.status === 'done' && a?.scoreRaw !== null && a?.scoreRaw !== undefined ? `${Math.round(a.scoreRaw)} of ${items}` : q.status === 'done' ? 'Done' : 'Not finished',
        }
      }),
    tomorrow: `Tomorrow is ${weekdayNameEn(tomorrow)}. New quests will be ready.`,
    answersHref: atts.find((a) => a.submittedAt)?.id ? `/results/${atts.find((a) => a.submittedAt)!.id}` : null,
    streak: await streakDTO(tx, learner, date),
  }
}
