import 'server-only'
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'
import { addDays, daysBetween, formatDateId, jakartaDate, type IsoDate } from '@kira/core/time'
import { tables } from '@kira/db'
import type { AttentionItem, SubjectTodayStatus, TrendPoint, TutorTodayDTO } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import type { Tx } from '../db'
import { inOrg } from '../db'
import { newReference } from '../errors'
import { log } from '../log'
import { accuracyPct, daysLeftLabel, shortDateId, skillTitle, SUBJECT_ID_LABEL, SUBJECT_ORDER, thisWeekStart } from './console-common'
import { shellIn, type ShellLearner } from './console-shell'
import { attemptProgress } from './learner-today'
import { isRestDay, loadLearner } from './learner-core'

const { skillState, response, attempt, quest, planSlot, planWeek, competitionEvent, problemReport, aiDraft, learnerProfile } = tables

export type TodaySection = 'attention' | 'today' | 'trend'
export type TutorTodayResult = { data: TutorTodayDTO; failed: { section: TodaySection; reference: string }[] }

const REASON_LABEL: Record<string, string> = {
  'wrong-answer': 'kunci jawaban diragukan',
  confusing: 'soal membingungkan',
  picture: 'gambar bermasalah',
  other: 'catatan lain',
}

/** T01 Hari ini. Setiap bagian dimuat sendiri; bagian yang gagal dilaporkan lewat `failed`. */
export async function tutorTodayDTO(actor: Actor, learnerParam: string | null): Promise<TutorTodayResult> {
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  const { shell, learner, learners } = await inOrg(ctx, (tx) => shellIn(tx, actor, learnerParam))
  const failed: TutorTodayResult['failed'] = []

  async function section<T>(name: TodaySection, fallback: T, fn: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      return await inOrg(ctx, fn)
    } catch (e) {
      const reference = newReference()
      log.error('bagian Hari ini gagal dimuat', { section: name, reference, error: e })
      failed.push({ section: name, reference })
      return fallback
    }
  }

  const attention = await section('attention', [] as AttentionItem[], (tx) => attentionItems(tx, learner, learners, today))
  const todayRows = learner ? await section('today', [] as SubjectTodayStatus[], (tx) => todayStatus(tx, learner.id, today)) : []
  const trend = learner ? await section('trend', [] as TutorTodayDTO['trend'], (tx) => trendFor(tx, learner.id, today)) : []
  const upcoming = await inOrg(ctx, (tx) => upcomingFor(tx, learner?.id ?? null, today)).catch((e) => {
    log.error('lomba berikutnya gagal dimuat', { error: e })
    return []
  })

  return {
    data: {
      shell,
      dateLabel: formatDateId(today, true),
      learner: learner ? { id: learner.id, name: learner.name, grade: learner.grade } : null,
      attention,
      today: todayRows,
      trend,
      partial: [],
      upcoming,
    },
    failed,
  }
}

async function attentionItems(tx: Tx, learner: ShellLearner | null, learners: ShellLearner[], today: IsoDate): Promise<AttentionItem[]> {
  const out: AttentionItem[] = []
  const q = learner ? `?learner=${learner.id}` : ''

  // 1. Skill dengan ketepatan rendah di 10 jawaban terakhir (learner terpilih).
  if (learner) {
    const states = await tx
      .select({ skillId: skillState.skillId, recent: skillState.recent, n: skillState.nAnswers })
      .from(skillState)
      .where(and(eq(skillState.learnerId, learner.id), gte(skillState.nAnswers, 10)))
    const low = states
      .map((s) => {
        const last = s.recent.slice(-10)
        const right = last.filter((x) => x > 0).length
        return { skillId: s.skillId, pct: last.length >= 10 ? Math.round((100 * right) / last.length) : 100 }
      })
      .filter((s) => s.pct < 70)
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3)
    for (const s of low) {
      const subject = s.skillId[0] === 'm' ? 'math' : s.skillId[0] === 'e' ? 'english' : 'science'
      out.push({
        id: `skill-${s.skillId}`,
        kind: 'skill-low',
        title: `${skillTitle(s.skillId)} baru ${s.pct}% benar di 10 soal terakhir`,
        detail: `${SUBJECT_ID_LABEL[subject]}, di bawah batas 70%. Tambah latihan skill ini di rencana minggu ini.`,
        actionLabel: 'Buka rencana',
        href: `/konsol/rencana${q}`,
      })
    }
  }

  // 2. Jawaban yang menunggu nilai tutor (semua learner).
  const pending = await tx
    .select({ subject: response.subject, n: sql<number>`count(*)::int` })
    .from(response)
    .where(eq(response.status, 'pending'))
    .groupBy(response.subject)
  const pendingTotal = pending.reduce((a, r) => a + r.n, 0)
  if (pendingTotal > 0) {
    const subjects = SUBJECT_ORDER.filter((s) => pending.some((p) => p.subject === s)).map((s) => SUBJECT_ID_LABEL[s])
    out.push({
      id: 'needs-grading',
      kind: 'needs-grading',
      title: `${pendingTotal} jawaban menunggu nilai`,
      detail: `${subjects.join(', ')}. Jawaban tulisan, rekaman, atau foto yang dinilai tutor.`,
      actionLabel: 'Nilai sekarang',
      href: '/konsol/hasil',
    })
  }

  // 3. Pendaftaran lomba yang segera tutup.
  const regs = await tx
    .select({ id: competitionEvent.id, name: competitionEvent.name, close: competitionEvent.registrationClose, ids: competitionEvent.learnerIds })
    .from(competitionEvent)
    .where(and(eq(competitionEvent.status, 'not-registered'), gte(competitionEvent.registrationClose, today), lte(competitionEvent.registrationClose, addDays(today, 14))))
    .orderBy(asc(competitionEvent.registrationClose))
  for (const r of regs) {
    const names = learners.filter((l) => r.ids.includes(l.id)).map((l) => l.name)
    out.push({
      id: `reg-${r.id}`,
      kind: 'registration',
      title: `Pendaftaran ${r.name} tutup ${daysLeftLabel(daysBetween(today, r.close!))}`,
      detail: names.length > 0 ? `${names.join(' dan ')} belum terdaftar.` : 'Belum ada learner yang dipilih untuk lomba ini.',
      actionLabel: 'Buka kalender lomba',
      href: '/konsol/lomba',
    })
  }

  // 4. Learner yang belum aktif (persetujuan orang tua belum ada).
  for (const l of learners.filter((x) => !x.active)) {
    out.push({
      id: `consent-${l.id}`,
      kind: 'consent',
      title: `${l.name} belum bisa masuk`,
      detail: 'Persetujuan orang tua belum tercatat. Kirim undangan ke orang tua atau catat persetujuan tertulis.',
      actionLabel: 'Buka daftar learner',
      href: '/konsol/learner',
    })
  }

  // 5. Laporan soal dari learner.
  const reports = await tx
    .select({ itemRef: problemReport.itemRef, reason: problemReport.reason })
    .from(problemReport)
    .where(eq(problemReport.status, 'open'))
    .orderBy(desc(problemReport.createdAt))
    .limit(50)
  if (reports.length > 0) {
    const first = reports[0]!
    out.push({
      id: 'reports',
      kind: 'problem-report',
      title: reports.length === 1 ? '1 laporan soal belum ditinjau' : `${reports.length} laporan soal belum ditinjau`,
      detail: `Terbaru: ${REASON_LABEL[first.reason] ?? first.reason} di soal ${first.itemRef}.`,
      actionLabel: 'Lihat soal',
      href: `/konsol/bank-soal?q=${encodeURIComponent(first.itemRef)}`,
    })
  }

  // 6. Draf AI yang menunggu ditinjau.
  const [drafts] = await tx.select({ n: sql<number>`count(*)::int` }).from(aiDraft).where(eq(aiDraft.status, 'pending'))
  if ((drafts?.n ?? 0) > 0) {
    out.push({
      id: 'ai-drafts',
      kind: 'ai-draft',
      title: `${drafts!.n} draf soal dari Studio AI menunggu ditinjau`,
      detail: 'Draf tidak dipakai di quest sebelum disetujui.',
      actionLabel: 'Tinjau draf',
      href: '/konsol/studio-ai',
    })
  }
  return out
}

async function todayStatus(tx: Tx, learnerId: string, today: IsoDate): Promise<SubjectTodayStatus[]> {
  const learner = await loadLearner(tx, learnerId)
  if (await isRestDay(tx, learner, today)) {
    return SUBJECT_ORDER.map((subject) => ({ subject, questTitle: null, state: 'rest', answered: 0, total: 0, accuracy: null, minutes: 0, syncedAt: null }))
  }
  const quests = await tx
    .select({ id: quest.id, subject: quest.subject, title: quest.title, status: quest.status, attemptId: quest.attemptId })
    .from(quest)
    .where(and(eq(quest.learnerId, learnerId), eq(quest.date, today), eq(quest.kind, 'daily')))
  const attemptIds = quests.map((q) => q.attemptId).filter((x): x is string => Boolean(x))
  const progress = await attemptProgress(tx, attemptIds)
  const stats = attemptIds.length
    ? await tx
        .select({
          attemptId: response.attemptId,
          correct: sql<number>`count(*) filter (where ${response.attemptNo} = 1 and ${response.status} = 'correct')::int`,
          graded: sql<number>`count(*) filter (where ${response.attemptNo} = 1 and ${response.status} in ('correct','wrong'))::int`,
          last: sql<number | null>`(extract(epoch from max(${response.answeredAt})) * 1000)::float8`,
        })
        .from(response)
        .where(inArray(response.attemptId, attemptIds))
        .groupBy(response.attemptId)
    : []
  const elapsed = attemptIds.length
    ? await tx.select({ id: attempt.id, s: attempt.elapsedS }).from(attempt).where(inArray(attempt.id, attemptIds))
    : []
  const slots = await tx
    .select({ subject: planSlot.subject, skillId: planSlot.skillId })
    .from(planSlot)
    .innerJoin(planWeek, eq(planWeek.id, planSlot.planWeekId))
    .where(and(eq(planSlot.learnerId, learnerId), eq(planSlot.date, today), eq(planSlot.kind, 'quest'), eq(planWeek.status, 'published')))

  return SUBJECT_ORDER.map((subject): SubjectTodayStatus => {
    const q = quests.find((x) => x.subject === subject)
    if (!q) {
      const slot = slots.find((s) => s.subject === subject)
      return { subject, questTitle: slot ? skillTitle(slot.skillId) : null, state: 'not-started', answered: 0, total: 0, accuracy: null, minutes: 0, syncedAt: null }
    }
    const p = q.attemptId ? progress.get(q.attemptId) : undefined
    const st = stats.find((s) => s.attemptId === q.attemptId)
    const secs = elapsed.find((e) => e.id === q.attemptId)?.s ?? 0
    const answered = p?.answered ?? 0
    return {
      subject,
      questTitle: q.title,
      state: q.status === 'done' ? 'done' : answered > 0 ? 'in-progress' : 'not-started',
      answered,
      total: p?.total ?? 0,
      accuracy: st ? accuracyPct(st.correct, st.graded) : null,
      minutes: Math.round(secs / 60),
      syncedAt: st?.last ? new Date(Number(st.last)).toISOString() : null,
    }
  })
}

async function trendFor(tx: Tx, learnerId: string, today: IsoDate): Promise<TutorTodayDTO['trend']> {
  const monday = thisWeekStart(today)
  const weeks = [21, 14, 7, 0].map((d) => addDays(monday, -d))
  const since = new Date(`${weeks[0]}T00:00:00+07:00`)
  const rows = await tx
    .select({
      subject: response.subject,
      week: sql<string>`to_char(date_trunc('week', ${response.answeredAt} at time zone 'Asia/Jakarta'), 'YYYY-MM-DD')`,
      total: sql<number>`count(*)::int`,
      correct: sql<number>`count(*) filter (where ${response.status} = 'correct')::int`,
    })
    .from(response)
    .where(and(eq(response.learnerId, learnerId), eq(response.attemptNo, 1), inArray(response.status, ['correct', 'wrong']), gte(response.answeredAt, since)))
    .groupBy(response.subject, sql`2`)
  return SUBJECT_ORDER.map((subject) => ({
    subject,
    points: weeks.map((w): TrendPoint => {
      const r = rows.find((x) => x.subject === subject && x.week === w)
      return { weekStart: w, label: shortDateId(w), accuracy: r ? accuracyPct(r.correct, r.total) : null, answers: r?.total ?? 0 }
    }),
  }))
}

async function upcomingFor(tx: Tx, learnerId: string | null, today: IsoDate): Promise<TutorTodayDTO['upcoming']> {
  const rows = await tx
    .select({ name: competitionEvent.name, date: competitionEvent.date, close: competitionEvent.registrationClose, ids: competitionEvent.learnerIds, status: competitionEvent.status })
    .from(competitionEvent)
    .where(gte(competitionEvent.date, today))
    .orderBy(asc(competitionEvent.date))
  return rows
    .filter((r) => r.status !== 'skip' && r.status !== 'done' && (!learnerId || r.ids.length === 0 || r.ids.includes(learnerId)))
    .slice(0, 3)
    .map((r) => ({ name: r.name, date: r.date!, daysToGo: daysBetween(today, r.date!), registrationClose: r.close }))
}

/** Dipakai halaman lain: nama learner aktif pertama untuk teks default. */
export async function firstActiveLearner(tx: Tx): Promise<{ id: string; name: string } | null> {
  const rows = await tx
    .select({ id: learnerProfile.userId, name: learnerProfile.name })
    .from(learnerProfile)
    .where(and(eq(learnerProfile.active, true), isNull(learnerProfile.deletedAt)))
    .orderBy(asc(learnerProfile.name))
    .limit(1)
  return rows[0] ?? null
}
