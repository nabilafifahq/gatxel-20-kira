import 'server-only'
import { readingSummary } from './reading-room'
import { and, desc, eq, gte, inArray, isNull, ne, sql } from 'drizzle-orm'
import { jakartaDate, levelForXp, weekStart, type IsoDate } from '@kira/core'
import { answerText, MANUAL_TYPES } from '@kira/content'
import { tables } from '@kira/db'
import type { AvatarName, Subject } from '@/lib/dto'
import type { ParentChildCard, ParentChildDTO, ParentChildStatus, ParentHomeDTO, ParentResultDTO, ParentSessionDTO, ParentSkillDTO, ParentWorkDTO } from '@/lib/dto-parent'
import type { Actor } from '../auth/actor'
import { withFamilyAdmin, type ParentScope } from '../auth/parent'
import { learnerUiPrefs } from '../auth/accounts'
import type { Tx } from '../db'
import { env } from '../env'
import { notFound } from '../errors'
import { skillTitle, SUBJECT_ID_LABEL, SUBJECT_ORDER } from './console-common'
import { answerTextId } from './console-learner-logic'
import { clip, recentAttempts } from './console-learner'
import { apkInfo } from './console-settings'
import { arenaTutorDTO } from './arena-tutor'
import { xpTracksDTO } from './arena-tracks'
import { promptPreview, resolveItems, skill, skillsFor } from './content'
import { dayRulesFor } from './learner-rules'
import { featureMapFor } from './learner-features'
import { loadLearner, markerFor, streakFor, streakDTO, totalXp, type LearnerRow } from './learner-core'
import { yourAnswerText } from './learner-results'
import { openMistakes } from './mistake-book'
import { parentPlacement } from './placement'
import { topSkills } from './mistake-logic'
import { answeredByAttempt } from './parent-skill-change'
import { sessionName, sessionState, skillChangeView, type SkillSession } from './session-skill-logic'
import { weekSummaryDTO } from './week-summary'

/**
 * Data dashboard orang tua. Semua pembacaan lewat withFamilyAdmin: transaksi berperan guardian, jadi RLS
 * (guardian_link) sudah membatasi ke anak yang tertaut; `assertParentOf` menambah pemeriksaan eksplisit untuk
 * satu anak. Teks untuk orang tua dalam bahasa Indonesia.
 */

const { learnerProfile, quest, attempt, response, skillState, guardianLink, org } = tables

const CORE = new Set(['latihan', 'tes', 'paper'])
const SESSION_LABEL_ID: Record<string, string> = {
  latihan: 'Latihan',
  tes: 'Tes',
  paper: 'Paper',
  review: 'Ulasan',
  'quick-maths': 'Quick Maths',
  knowledge: 'Quiz Arena',
  lesson: 'Pelajaran',
  reading: 'Membaca',
  simulation: 'Simulasi lomba',
  esmo: 'ESMO',
  'english-skill': 'Tugas English',
}

function statusLabel(s: ParentChildStatus, c: { requiredDone: number; requiredTotal: number; optionalDone: number }): string {
  switch (s) {
    case 'rest':
      return 'Hari istirahat'
    case 'none':
      return c.optionalDone > 0 ? 'Tidak ada sesi wajib hari ini, sudah mencoba sesi opsional' : 'Tidak ada sesi wajib hari ini, streak aman'
    case 'not-started':
      return `Belum mulai, ${c.requiredTotal} sesi wajib menunggu`
    case 'in-progress':
      return `${c.requiredDone} dari ${c.requiredTotal} sesi wajib selesai`
    case 'done':
      return 'Semua sesi wajib hari ini selesai'
  }
}

async function todayCounts(tx: Tx, learnerId: string, date: IsoDate) {
  const rows = await tx
    .select({ kind: quest.kind, status: quest.status, n: sql<number>`count(*)::int` })
    .from(quest)
    .where(and(eq(quest.learnerId, learnerId), eq(quest.date, date), ne(quest.kind, 'bonus')))
    .groupBy(quest.kind, quest.status)
  const sum = (kind: string, status?: string) => rows.filter((r) => r.kind === kind && (!status || r.status === status)).reduce((a, r) => a + r.n, 0)
  // Status quest tetap ready sampai selesai; sesi yang sudah dijawab sebagian terlihat dari jawabannya, seperti di Today anak.
  const [answered] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(response)
    .innerJoin(quest, eq(quest.attemptId, response.attemptId))
    .where(and(eq(quest.learnerId, learnerId), eq(quest.date, date), ne(quest.kind, 'bonus')))
  return {
    requiredTotal: sum('daily'),
    requiredDone: sum('daily', 'done'),
    optionalTotal: sum('extra'),
    optionalDone: sum('extra', 'done'),
    anyStarted: rows.some((r) => r.status !== 'ready') || (answered?.n ?? 0) > 0,
  }
}

export async function childCard(tx: Tx, learner: LearnerRow, today: IsoDate): Promise<ParentChildCard> {
  const c = await todayCounts(tx, learner.userId, today)
  const rest = learner.restWeekdays.includes(new Date(`${today}T00:00:00Z`).getUTCDay())
  const status: ParentChildStatus = rest && c.requiredTotal === 0 && c.optionalTotal === 0
    ? 'rest'
    : c.requiredTotal === 0
      ? 'none'
      : c.requiredDone >= c.requiredTotal
        ? 'done'
        : c.anyStarted
          ? 'in-progress'
          : 'not-started'
  const streak = await streakDTO(tx, learner, today)
  const minutes = (await tx.select({ m: tables.dayRecord.minutes }).from(tables.dayRecord).where(and(eq(tables.dayRecord.learnerId, learner.userId), eq(tables.dayRecord.date, today))).limit(1))[0]?.m ?? 0
  const xp = await totalXp(tx, learner.userId)
  return {
    id: learner.userId,
    name: learner.name,
    grade: learner.grade,
    avatar: learner.avatar as AvatarName,
    status,
    statusLabel: statusLabel(status, c),
    requiredDone: c.requiredDone,
    requiredTotal: c.requiredTotal,
    optionalDone: c.optionalDone,
    optionalTotal: c.optionalTotal,
    streak: streak.current,
    minutesToday: minutes,
    screenLimitMin: learner.screenLimitMin,
    xp,
    level: levelForXp(xp),
    tracks: await xpTracksDTO(tx, learner.userId),
    reading: await readingSummary(tx, learner.userId, today),
    active: learner.active,
    href: `/keluarga/anak/${learner.userId}`,
  }
}

/** Beranda: anak yang tertaut ke orang tua ini, dengan status hari ini. */
export async function parentHomeDTO(actor: Actor): Promise<ParentHomeDTO> {
  const today = jakartaDate()
  const apk = await apkInfo()
  return withFamilyAdmin(actor, async (tx, scope) => {
    const ids = await tx.select({ id: guardianLink.learnerId }).from(guardianLink).where(eq(guardianLink.guardianId, scope.ctx.userId))
    const children: ParentChildCard[] = []
    for (const { id } of ids) {
      const [row] = await tx.select({ id: learnerProfile.userId }).from(learnerProfile).where(and(eq(learnerProfile.userId, id), isNull(learnerProfile.deletedAt))).limit(1)
      if (!row) continue
      children.push(await childCard(tx, await loadLearner(tx, id), today))
    }
    children.sort((a, b) => a.name.localeCompare(b.name))
    const [o] = await tx.select({ name: org.name }).from(org).where(eq(org.id, actor.orgId)).limit(1)
    const marker = ids[0] ? await markerFor(tx) : 'grownup'
    return {
      parentName: actor.name,
      familyName: o?.name ?? 'Keluarga',
      children,
      maxChildren: env().KIRA_MAX_LEARNERS_PER_FAMILY,
      apk: { available: apk.available, size: apk.size },
      hasTutor: marker === 'tutor',
    }
  })
}

function sessionLabel(session: string): string {
  return SESSION_LABEL_ID[session] ?? session
}

async function todaySessions(tx: Tx, learnerId: string, date: IsoDate): Promise<ParentSessionDTO[]> {
  const rows = await tx
    .select({
      id: quest.id,
      subject: quest.subject,
      session: quest.session,
      kind: quest.kind,
      status: quest.status,
      attemptId: quest.attemptId,
      seq: quest.seq,
      skillId: quest.skillId,
      title: quest.title,
      raw: attempt.scoreRaw,
      max: attempt.scoreMax,
      scaled: attempt.scoreScaled,
      aStatus: attempt.status,
      openedAt: attempt.openedAt,
      count: sql<number | null>`case when ${attempt.items} is null then null else jsonb_array_length(${attempt.items}) end`,
    })
    .from(quest)
    .leftJoin(attempt, eq(attempt.id, quest.attemptId))
    .where(and(eq(quest.learnerId, learnerId), eq(quest.date, date), ne(quest.kind, 'bonus')))
  const order = (s: string) => ['latihan', 'tes', 'paper'].indexOf(s)
  const answered = await answeredByAttempt(tx, rows.map((r) => r.attemptId))
  const plans: SkillSession[] = rows.map((r) => ({ id: r.id, subject: r.subject as Subject, session: r.session, required: r.kind === 'daily', seq: r.seq, skillId: r.skillId, state: sessionState(r.status, answered.get(r.attemptId ?? '') ?? 0, r.openedAt !== null) }))
  return rows
    .sort((a, b) => Number(b.kind === 'daily') - Number(a.kind === 'daily') || SUBJECT_ORDER.indexOf(a.subject as Subject) - SUBJECT_ORDER.indexOf(b.subject as Subject) || order(a.session) - order(b.session) || a.seq - b.seq)
    .map((r) => {
      const submitted = r.aStatus !== null && r.aStatus !== 'in_progress'
      const plan = plans.find((p) => p.id === r.id)!
      const view = skillChangeView(plan, plans, sessionName)
      const sk = r.skillId ? skill(r.skillId) : undefined
      return {
        questId: r.id,
        subject: r.subject as Subject,
        label: sessionLabel(r.session),
        session: r.session,
        required: r.kind === 'daily',
        state: plan.state,
        started: plan.state !== 'ready',
        score: submitted ? (r.scaled != null ? `${Math.round(r.scaled)} dari 100` : r.raw != null ? `${r.raw} dari ${r.max ?? r.count ?? 0}` : null) : null,
        questionCount: r.count ?? null,
        core: CORE.has(r.session),
        attemptId: r.attemptId,
        resultHref: submitted && r.attemptId ? `/keluarga/anak/${learnerId}/hasil/${r.attemptId}` : null,
        skill: sk ? { title: sk.titleId, titleEn: sk.title } : null,
        contentTitle: sk ? null : r.title,
        canChangeSkill: view.canChange,
        skillNote: view.note,
      } satisfies ParentSessionDTO
    })
}

const STATE_OF_GATE: Record<string, ParentSkillDTO['state']> = { new: 'baru', reteach: 'diulang', review: 'ditinjau', mastered: 'dikuasai' }

async function skillMap(tx: Tx, learner: LearnerRow): Promise<{ map: ParentChildDTO['skillMap']; weak: ParentChildDTO['weakSkills'] }> {
  const states = await tx.select({ skillId: skillState.skillId, stars: skillState.stars, gate: skillState.gate, n: skillState.nAnswers }).from(skillState).where(eq(skillState.learnerId, learner.userId))
  const by = new Map(states.map((s) => [s.skillId, s]))
  const weak: ParentChildDTO['weakSkills'] = []
  const map = SUBJECT_ORDER.map((subject) => {
    const skills = skillsFor(subject, learner.grade)
      .filter((s) => s.strand !== 'Oly' || by.has(s.id))
      .sort((a, b) => a.order - b.order)
      .map((s) => {
        const st = by.get(s.id)
        const mastery = st ? (st.gate === 'mastered' ? 100 : Math.round((st.stars / 3) * 100)) : 0
        if (st && st.gate === 'reteach' && st.n > 0) weak.push({ subject, title: s.title, note: 'Perlu diulang, Kira akan menjadwalkannya lagi.' })
        return { id: s.id, title: s.title, stars: st?.stars ?? 0, mastery, state: STATE_OF_GATE[st?.gate ?? 'new'] ?? 'baru', answered: st?.n ?? 0 } satisfies ParentSkillDTO
      })
    return { subject, label: SUBJECT_ID_LABEL[subject], skills }
  }).filter((g) => g.skills.length > 0)
  return { map, weak: weak.slice(0, 8) }
}

async function fixItSummary(tx: Tx, learnerId: string): Promise<ParentChildDTO['fixIt']> {
  const open = (await openMistakes(tx, learnerId)).filter((o) => skill(o.skillId))
  return {
    open: open.length,
    cleared: 0,
    bySkill: topSkills(open.map((o) => o.skillId), 5).map((s) => ({ title: skillTitle(s.skillId), subject: (skill(s.skillId)?.subject ?? 'math') as Subject, count: s.count })),
  }
}

/** Hasil tulis, bicara, gambar, dan foto anak yang bisa dilihat dan, kalau mau, dinilai orang tua. */
async function workFor(tx: Tx, learnerId: string): Promise<ParentWorkDTO[]> {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const rows = await tx
    .select({
      id: response.id,
      attemptId: response.attemptId,
      ref: response.itemRef,
      type: response.itemType,
      status: response.status,
      answer: response.answer,
      mediaId: response.mediaId,
      feedback: response.feedback,
      subject: response.subject,
      title: attempt.title,
      answeredAt: response.answeredAt,
    })
    .from(response)
    .innerJoin(attempt, eq(attempt.id, response.attemptId))
    .where(and(eq(response.learnerId, learnerId), inArray(response.itemType, MANUAL_TYPES as unknown as string[]), gte(response.answeredAt, since), ne(attempt.status, 'in_progress')))
    .orderBy(desc(response.answeredAt))
    .limit(30)
  if (rows.length === 0) return []
  const items = await resolveItems(tx, rows.map((r) => r.ref))
  const out: ParentWorkDTO[] = []
  for (const r of rows) {
    const item = items.get(r.ref)
    if (!item) continue
    const a = (r.answer ?? {}) as { text?: string; value?: string; mediaId?: string }
    out.push({
      responseId: r.id,
      attemptId: r.attemptId,
      subject: r.subject as Subject,
      title: r.title,
      prompt: promptPreview(item, 200),
      type: r.type as ParentWorkDTO['type'],
      text: typeof a.text === 'string' ? a.text : typeof a.value === 'string' ? a.value : null,
      mediaId: r.mediaId ?? (typeof a.mediaId === 'string' ? a.mediaId : null),
      status: r.status === 'pending' ? 'pending' : r.status === 'correct' ? 'correct' : 'wrong',
      criteria: 'rubric' in item && item.rubric ? item.rubric.criteria.map((c) => ({ label: c.label, points: c.points })) : [],
      feedback: r.feedback,
    })
  }
  return out.sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending')).slice(0, 12)
}

/** Satu anak: sesi hari ini, peta skill, Buku Salah, arena, laporan minggu, hasil, dan pengaturannya. */
export async function parentChildDTO(actor: Actor, learnerId: string): Promise<ParentChildDTO> {
  const today = jakartaDate()
  return withFamilyAdmin(actor, async (tx, scope) => {
    await scope.assertParentOf(learnerId)
    const learner = await loadLearner(tx, learnerId)
    const card = await childCard(tx, learner, today)
    const { map, weak } = await skillMap(tx, learner)
    const { preset, rules } = await dayRulesFor(tx, learnerId)
    const [o] = await tx.select({ name: org.name }).from(org).where(eq(org.id, actor.orgId)).limit(1)
    const attempts = (await recentAttempts(tx, learnerId)).map((a) => ({ ...a, href: `/keluarga/anak/${learnerId}/hasil/${a.id}` }))
    const streak = await streakFor(tx, learner, today)
    const prefs = (await learnerUiPrefs([learnerId], actor.orgId)).get(learnerId)
    return {
      parentName: actor.name,
      familyName: o?.name ?? 'Keluarga',
      card,
      hasTutor: (await markerFor(tx)) === 'tutor',
      today: { date: today, sessions: await todaySessions(tx, learnerId, today) },
      skillMap: map,
      weakSkills: weak,
      fixIt: await fixItSummary(tx, learnerId),
      arena: await arenaTutorDTO(tx, learnerId, learner.grade),
      placement: await parentPlacement(tx, learner),
      week: await weekSummaryDTO(tx, learnerId, weekStart(today), { today }),
      attempts,
      work: await workFor(tx, learnerId),
      controls: {
        screenLimitMin: learner.screenLimitMin,
        restWeekdays: [...learner.restWeekdays].sort((a, b) => a - b),
        soundEnabled: learner.soundEnabled,
        musicEnabled: learner.musicEnabled,
        uiLang: prefs?.uiLang ?? 'id',
        uiLangSwitch: prefs?.uiLangSwitch ?? false,
        dayPreset: preset,
        features: await featureMapFor(tx, learnerId),
        dayRules: rules as never,
        streak: streak.current,
        grade: learner.grade,
        avatar: learner.avatar as AvatarName,
      },
    }
  })
}

/** Hasil per soal: pertanyaan, jawaban anak, jawaban benar, dan penjelasan. Hanya setelah sesi dikumpulkan. */
export async function parentResultDTO(actor: Actor, learnerId: string, attemptId: string): Promise<ParentResultDTO> {
  return withFamilyAdmin(actor, async (tx, scope) => {
    await scope.assertParentOf(learnerId)
    return parentResultTx(tx, scope, learnerId, attemptId)
  })
}

export async function parentResultTx(tx: Tx, scope: ParentScope, learnerId: string, attemptId: string): Promise<ParentResultDTO> {
  await scope.assertParentOf(learnerId)
  const learner = await loadLearner(tx, learnerId)
  const [a] = await tx
    .select({ id: attempt.id, title: attempt.title, subject: attempt.subject, items: attempt.items, status: attempt.status, submittedAt: attempt.submittedAt, startedAt: attempt.startedAt, raw: attempt.scoreRaw, max: attempt.scoreMax, scaled: attempt.scoreScaled })
    .from(attempt)
    .where(and(eq(attempt.id, attemptId), eq(attempt.learnerId, learner.userId)))
    .limit(1)
  if (!a) throw notFound('Hasil ini tidak ditemukan untuk anak ini.')
  if (a.status === 'in_progress' || !a.submittedAt) throw notFound('Sesi ini belum dikumpulkan, jadi hasilnya belum ada.')
  const items = ((a.items as { ref: string; position: number }[] | null) ?? []).slice().sort((x, y) => x.position - y.position)
  const resolved = await resolveItems(tx, items.map((i) => i.ref))
  const resp = await tx.select().from(response).where(eq(response.attemptId, a.id))
  const rows = items.map((it) => {
    const tries = resp.filter((r) => r.position === it.position)
    const latest = tries.reduce<(typeof tries)[number] | null>((cur, r) => (!cur || r.attemptNo > cur.attemptNo || (r.attemptNo === cur.attemptNo && r.answeredAt > cur.answeredAt) ? r : cur), null)
    const item = resolved.get(it.ref)
    const manual = item ? MANUAL_TYPES.includes(item.type) : false
    return {
      position: it.position,
      skillTitle: item ? skillTitle(item.skill) : 'Soal tidak ditemukan',
      prompt: item ? promptPreview(item, 240) : 'Soal ini tidak ada lagi di bank soal.',
      yourAnswer: item && latest ? clip(answerTextId(yourAnswerText(item, latest.answer))) : 'Tidak dijawab',
      correctAnswer: item ? (manual ? 'Dilihat orang dewasa di rumah' : clip(answerText(item, 'id'))) : 'Tidak tersedia',
      explanation: item?.explanation ?? null,
      status: (latest ? latest.status : 'blank') as 'correct' | 'wrong' | 'blank' | 'pending',
      tries: tries.length,
      manual,
    }
  })
  return {
    learner: { id: learner.userId, name: learner.name },
    attempt: {
      id: a.id,
      title: a.title,
      subject: a.subject as Subject,
      date: (a.submittedAt ?? a.startedAt).toISOString(),
      score: a.scaled != null ? `${Math.round(a.scaled)} dari 100` : a.raw != null ? `${a.raw} dari ${a.max ?? items.length}` : 'Belum ada skor',
      submitted: true,
    },
    rows,
  }
}
