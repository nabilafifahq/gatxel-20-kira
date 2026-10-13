import 'server-only'
import { and, asc, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { addDays, bestIndex, daysBetween, formatDateEn, jakartaDate, sessionMinutes, weekdayNameEn, type IsoDate, type SessionType } from '@kira/core'
import { tables } from '@kira/db'
import type { DoneTodayDTO, QuestIntroDTO, QuestStopDTO, SegmentState, Subject, TodayDTO, TodayGroupDTO } from '@/lib/dto'
import type { OrgContext, Tx } from '../db'
import { notFound } from '../errors'
import { lesson, skill } from './content'
import { learnerShell, loadLearner, minutesOn, skillStates, streakDTO, isRestDay } from './learner-core'
import {
  SUBJECT_LABEL,
  SUBJECT_ORDER,
  buildQuestItems,
  createAttemptFor,
  ensureTodayQuests,
  isLinkQuest,
  isTesLocked,
  linkHref,
  scoreOf,
  scoreText,
  type AttemptItem,
  type QuestRow,
  type ScoreText,
} from './learner-session'

const { quest, attempt, response, competitionEvent, orgItem } = tables

export { SUBJECT_LABEL, SUBJECT_ORDER, buildQuestItems, ensureTodayQuests }

/** Nama sesi untuk learner (en-GB). */
export const SESSION_LABEL: Record<SessionType, string> = {
  latihan: 'Practice',
  tes: 'Test',
  paper: 'Paper',
  lesson: 'Lesson',
  simulation: 'Competition practice',
  esmo: 'ESMO practice',
  review: 'Review cards',
  'quick-maths': 'Quick Maths',
  knowledge: 'Quiz',
  'english-skill': 'English task',
  reading: 'Reading',
}

const CORE_ORDER: Record<string, number> = { latihan: 0, tes: 1, paper: 2 }

type Progress = { total: number; answered: number; segments: SegmentState[]; timeLimitS: number | null; mode: string; score: ScoreText | null }

export async function attemptProgress(tx: Tx, attemptIds: string[]): Promise<Map<string, Progress>> {
  const out = new Map<string, Progress>()
  if (attemptIds.length === 0) return out
  const atts = await tx
    .select({
      id: attempt.id,
      items: attempt.items,
      mode: attempt.mode,
      timeLimitS: attempt.timeLimitS,
      status: attempt.status,
      scoreRaw: attempt.scoreRaw,
      scoreMax: attempt.scoreMax,
      scoreScaled: attempt.scoreScaled,
    })
    .from(attempt)
    .where(inArray(attempt.id, attemptIds))
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
    out.set(a.id, {
      total: items.length,
      answered: latest.size,
      segments,
      timeLimitS: a.timeLimitS,
      mode: a.mode,
      score: a.status === 'in_progress' ? null : scoreText(a, items.length),
    })
  }
  return out
}

/** Skor terbaik dari sesi yang diulang, per attempt pertama. Hanya diisi bila sebuah ulangan lebih baik dari yang resmi. */
async function bestScores(
  tx: Tx,
  roots: { id: string; scoreRaw: number | null; scoreMax: number | null; scoreScaled: number | null; total: number }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (roots.length === 0) return out
  const retries = await tx
    .select({ retryOf: attempt.retryOf, scoreRaw: attempt.scoreRaw, scoreMax: attempt.scoreMax, scoreScaled: attempt.scoreScaled, status: attempt.status })
    .from(attempt)
    .where(
      inArray(
        attempt.retryOf,
        roots.map((r) => r.id),
      ),
    )
  for (const root of roots) {
    const mine = retries.filter((r) => r.retryOf === root.id && r.status !== 'in_progress')
    if (mine.length === 0) continue
    const all = [root, ...mine]
    const i = bestIndex(all.map(scoreOf))
    if (i > 0) out.set(root.id, scoreText(all[i]!, root.total)?.text ?? '')
  }
  return out
}

type StopCtx = { progress: Progress | undefined; locked: boolean; best: string | null }

function minutesLabel(n: number): string {
  return n === 1 ? '1 minute' : `${n} minutes`
}

function stopFor(q: QuestRow, c: StopCtx): QuestStopDTO {
  const session = q.session as SessionType
  const link = isLinkQuest(q)
  const p = c.progress
  const total = p?.total ?? 0
  const answered = p?.answered ?? 0
  const timed = Boolean(p?.timeLimitS)
  const state: QuestStopDTO['state'] = q.status === 'done' ? 'done' : c.locked ? 'locked' : answered > 0 ? 'in-progress' : 'ready'
  const minutes = timed ? Math.max(1, Math.round((p!.timeLimitS ?? 0) / 60)) : sessionMinutes({ session, questionCount: total })
  let meta: string
  if (state === 'locked') meta = `Opens after your ${SUBJECT_LABEL[q.subject as Subject]} practice`
  else if (state === 'done') meta = [p?.score?.text ?? 'Done', c.best ? `best ${c.best}` : null].filter(Boolean).join(', ')
  else if (state === 'in-progress') meta = `${answered} of ${total} done${timed ? '' : `, about ${minutesLabel(sessionMinutes({ session, questionCount: Math.max(1, total - answered) }))} left`}`
  else if (link) meta = `About ${minutesLabel(sessionMinutes({ session }))}`
  else meta = `${total} questions, ${timed ? `${minutesLabel(minutes)} on the clock` : `about ${minutesLabel(minutes)}`}`
  const href = link
    ? state === 'done'
      ? null
      : linkHref(q)
    : state === 'locked'
      ? null
      : state === 'done'
        ? q.attemptId
          ? `/results/${q.attemptId}`
          : null
        : state === 'in-progress' && q.attemptId
          ? `/run/${q.attemptId}`
          : `/quest/${q.id}`
  return {
    questId: q.id,
    subject: q.subject as Subject,
    state,
    session,
    sessionLabel: SESSION_LABEL[session],
    required: q.kind !== 'extra',
    timed,
    best: c.best,
    title: q.title,
    meta,
    total,
    answered,
    segments: p?.segments ?? [],
    href,
    ctaLabel: state === 'done' ? 'See answers' : state === 'locked' ? 'Locked' : state === 'in-progress' ? 'Continue' : link ? 'Open' : 'Start',
    offlineReady: Boolean(q.attemptId) && !timed && !link && state !== 'locked',
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

const NUMBER_WORD = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
const numberWord = (n: number) => NUMBER_WORD[n] ?? String(n)

/** Urutan sesi wajib dalam satu mapel: Latihan, Tes, Paper, lalu sesi wajib tambahan. */
function byPath(a: QuestRow, b: QuestRow): number {
  return (CORE_ORDER[a.session] ?? 9) - (CORE_ORDER[b.session] ?? 9) || a.seq - b.seq
}

export async function todayDTO(tx: Tx, ctx: OrgContext, learnerId: string): Promise<TodayDTO> {
  const date = jakartaDate()
  const loaded = await loadLearner(tx, learnerId)
  // started_on diisi oleh ensureStarted() sebelum transaksi ini (learner tidak boleh mengubah profilnya sendiri).
  const learner = loaded.startedOn ? loaded : { ...loaded, startedOn: date }
  const shell = await learnerShell(tx, learner, date)
  const rest = await isRestDay(tx, learner, date)
  const quests = rest ? [] : (await ensureTodayQuests(tx, ctx, learner, date)).filter((q) => q.kind !== 'bonus')
  const progress = await attemptProgress(
    tx,
    quests.map((q) => q.attemptId).filter((x): x is string => Boolean(x)),
  )
  const roots = quests
    .filter((q) => q.status === 'done' && q.attemptId)
    .map((q) => {
      const p = progress.get(q.attemptId!)
      return { id: q.attemptId!, scoreRaw: p?.score?.raw ?? null, scoreMax: p?.score?.max ?? null, scoreScaled: p?.score?.scaled ?? null, total: p?.total ?? 0 }
    })
  const best = await bestScores(tx, roots)

  const latihanDone = new Map<Subject, boolean>()
  for (const s of SUBJECT_ORDER) latihanDone.set(s, quests.filter((q) => q.subject === s && q.session === 'latihan' && q.kind === 'daily').every((q) => q.status === 'done'))
  const stopOf = (q: QuestRow) =>
    stopFor(q, {
      progress: q.attemptId ? progress.get(q.attemptId) : undefined,
      locked: q.session === 'tes' && !latihanDone.get(q.subject as Subject),
      best: q.attemptId ? (best.get(q.attemptId) ?? null) : null,
    })

  const mandatory = quests.filter((q) => q.kind === 'daily')
  const groups: TodayGroupDTO[] = SUBJECT_ORDER.map((subject) => {
    const stops = mandatory.filter((q) => q.subject === subject).sort(byPath).map(stopOf)
    return { subject, label: SUBJECT_LABEL[subject], done: stops.filter((s) => s.state === 'done').length, total: stops.length, stops }
  }).filter((g) => g.stops.length > 0)
  const extras = quests
    .filter((q) => q.kind === 'extra')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
    .map(stopOf)

  const flat = groups.flatMap((g) => g.stops)
  const active = flat.find((s) => s.state === 'in-progress') ?? flat.find((s) => s.state === 'ready') ?? null
  const done = flat.filter((s) => s.state === 'done').length
  const total = flat.length
  const allDone = total > 0 && done === total
  const extraDone = extras.filter((s) => s.state === 'done').length
  const minutes = await minutesOn(tx, learner.userId, date)
  const streak = await streakDTO(tx, learner, date)
  const anyAnswers = [...flat, ...extras].some((s) => s.answered > 0) || streak.current > 0
  const variant: TodayDTO['variant'] = rest
    ? 'rest-day'
    : minutes >= learner.screenLimitMin
      ? 'time-limit'
      : allDone
        ? 'all-done'
        : learner.startedOn === date && !anyAnswers
          ? 'first-day'
          : 'normal'
  const subline =
    variant === 'rest-day'
      ? 'Today is a rest day. Your streak is safe.'
      : variant === 'time-limit'
        ? 'That is enough screen time for today. Well done.'
        : variant === 'all-done'
          ? extras.length > extraDone
            ? `All ${total} sessions are done. Extra sessions are open if you want them.`
            : `All ${total} sessions are done. See you tomorrow.`
          : active?.state === 'in-progress'
            ? `${SUBJECT_LABEL[active.subject as Subject]} ${active.sessionLabel.toLowerCase()} is ${active.answered * 2 >= active.total ? 'half done' : 'started'}.`
            : done === 0
              ? `${numberWord(total)} ${total === 1 ? 'session' : 'sessions'} today. Start with the big one.`
              : `${done} of ${total} done. Keep going.`
  const comp = await nextCompetition(tx, learner.userId, date)
  return {
    shell,
    dateLabel: formatDateEn(date, true),
    headline: variant === 'first-day' ? 'Your first sessions' : `${weekdayNameEn(date)}'s sessions`,
    subline,
    variant,
    streak,
    groups,
    extras,
    activeQuestId: active?.questId ?? null,
    progress: { done, total, extraDone, extraTotal: extras.length },
    nextCompetition: comp ? { name: comp.name, daysToGo: comp.daysToGo } : null,
    esmo: (await hasEsmo(tx, learner.userId, date)) ? { href: '/esmo', label: 'ESMO practice packs' } : null,
    minutesToday: minutes,
    screenLimitMin: learner.screenLimitMin,
  }
}

export type IntroResult = QuestIntroDTO | { locked: true } | { redirect: string }

export async function questIntroDTO(tx: Tx, ctx: OrgContext, learnerId: string, questId: string): Promise<IntroResult> {
  const learner = await loadLearner(tx, learnerId)
  const rows = await tx.select().from(quest).where(and(eq(quest.id, questId), eq(quest.learnerId, learnerId))).limit(1)
  const q = rows[0]
  if (!q) throw notFound()
  if (isLinkQuest(q)) return { redirect: linkHref(q) ?? '/today' }
  if (await isTesLocked(tx, q)) return { locked: true }
  if (!q.attemptId) await createAttemptFor(tx, ctx, learner, q)
  const fresh = (await tx.select().from(quest).where(eq(quest.id, questId)).limit(1))[0]!
  if (!fresh.attemptId) throw notFound('No questions are ready for this session yet.')
  const att = (await tx.select({ items: attempt.items, mode: attempt.mode, timeLimitS: attempt.timeLimitS }).from(attempt).where(eq(attempt.id, fresh.attemptId)).limit(1))[0]
  const items = (att?.items as AttemptItem[]) ?? []
  const sk = q.skillId ? skill(q.skillId) : undefined
  const l = q.skillId ? lesson(q.skillId) : undefined
  const subject = q.subject as Subject
  const session = q.session as SessionType
  const states = q.skillId ? await skillStates(tx, learnerId) : null
  const isNew = q.skillId ? (states?.get(q.skillId)?.nAnswers ?? 0) === 0 : false
  const others = await tx.select().from(quest).where(and(eq(quest.learnerId, learnerId), eq(quest.date, q.date), eq(quest.kind, 'daily')))
  const latihanOpen = (s: string) => others.some((x) => x.subject === s && x.session === 'latihan' && x.status !== 'done')
  const alt = others.find((o) => o.id !== q.id && o.status !== 'done' && o.subject !== q.subject && !isLinkQuest(o) && !(o.session === 'tes' && latihanOpen(o.subject)))
  const timeLimitMin = att?.timeLimitS ? Math.max(1, Math.round(att.timeLimitS / 60)) : null
  const modeLabel =
    session === 'tes' ? 'Timed test' : session === 'paper' ? (timeLimitMin ? 'Timed paper' : 'Paper') : q.mode === 'belajar' ? 'Learn and practise' : session === 'reading' ? 'Reading' : q.kind === 'extra' ? 'Extra practice' : 'Practice'
  const practise = sk ? [sk.title, sk.canDo.replace(/^I can /, '').replace(/\.$/, '')].map((s) => s.charAt(0).toUpperCase() + s.slice(1)) : [q.title]
  return {
    shell: await learnerShell(tx, learner),
    questId: q.id,
    subject,
    title: q.title,
    questionCount: items.length,
    minutes: timeLimitMin ?? sessionMinutes({ session, questionCount: items.length }),
    hintsPerQuestion: att?.mode === 'tes' ? 0 : 3,
    youWillPractise: session === 'paper' ? [q.title] : practise,
    modeLabel,
    timeLimitMin,
    lessonHref:
      l && session !== 'tes' && session !== 'paper'
        ? q.mode === 'belajar' || isNew
          ? `/lesson/${q.skillId}?then=${encodeURIComponent(`/run/${fresh.attemptId}`)}`
          : `/lesson/${q.skillId}`
        : null,
    startHref: `/run/${fresh.attemptId}`,
    alternative: alt ? { subject: alt.subject as Subject, href: `/quest/${alt.id}` } : null,
  }
}

export async function doneTodayDTO(tx: Tx, learnerId: string): Promise<DoneTodayDTO> {
  const date = jakartaDate()
  const learner = await loadLearner(tx, learnerId)
  const quests = (await tx.select().from(quest).where(and(eq(quest.learnerId, learnerId), eq(quest.date, date)))).filter((q) => q.kind !== 'bonus')
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
    line: variant === 'time-limit' ? `You learned for ${minutes} minutes today. Your answers are saved.` : 'You finished your sessions. Your streak grows.',
    xpToday: xp[0]?.n ?? 0,
    minutesToday: minutes,
    quests: quests
      .sort((a, b) => SUBJECT_ORDER.indexOf(a.subject as Subject) - SUBJECT_ORDER.indexOf(b.subject as Subject) || byPath(a, b))
      .map((q) => {
        const a = atts.find((x) => x.id === q.attemptId)
        const items = ((a?.items as AttemptItem[]) ?? []).length
        const s = a && q.status === 'done' ? scoreText(a, items) : null
        return {
          subject: q.subject as Subject,
          session: SESSION_LABEL[q.session as SessionType],
          title: q.title,
          score: q.status === 'done' ? (s?.text ?? 'Done') : 'Not finished',
          required: q.kind !== 'extra',
        }
      }),
    tomorrow: `Tomorrow is ${weekdayNameEn(tomorrow)}. New sessions will be ready.`,
    answersHref: atts.find((a) => a.submittedAt)?.id ? `/results/${atts.find((a) => a.submittedAt)!.id}` : null,
    streak: await streakDTO(tx, learner, date),
  }
}

/**
 * Halaman yang disimpan service worker supaya sesi hari ini tetap bisa dikerjakan saat internet
 * rumah putus: Today, pembuka dan runner setiap sesi tanpa waktu yang belum selesai, pelajarannya, peta, Review.
 * Halaman Me tidak ikut karena membukanya menandai lencana sudah dibaca.
 */
export async function offlineUrlsForToday(tx: Tx, learnerId: string, date: IsoDate = jakartaDate()): Promise<string[]> {
  const rows = await tx
    .select({ id: quest.id, attemptId: quest.attemptId, status: quest.status, skillId: quest.skillId, mode: quest.mode, session: quest.session, timeLimitS: attempt.timeLimitS })
    .from(quest)
    .leftJoin(attempt, eq(attempt.id, quest.attemptId))
    .where(and(eq(quest.learnerId, learnerId), eq(quest.date, date)))
  const urls = ['/today', '/map', '/review']
  for (const q of rows) {
    // Tes dan Paper berwaktu tidak disimpan offline: jam mulai saat halaman runner pertama kali dimuat.
    if (q.status === 'done' || !q.attemptId || q.timeLimitS || q.session === 'tes') continue
    urls.push(`/quest/${q.id}`, `/run/${q.attemptId}`)
    if (q.skillId && q.mode === 'belajar' && lesson(q.skillId)) urls.push(`/lesson/${q.skillId}?then=${encodeURIComponent(`/run/${q.attemptId}`)}`)
  }
  return urls
}
