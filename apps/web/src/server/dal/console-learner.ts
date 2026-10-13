import 'server-only'
import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { jakartaDate, levelForXp, type IsoDate } from '@kira/core'
import { tables } from '@kira/db'
import { answerText } from '@kira/content'
import type { AvatarName, LearnerDetailDTO, Subject } from '@/lib/dto'
import type { AttemptDetailDTO, AttemptRowStatus } from '@/screens/console/AttemptDetailScreen'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import type { Tx } from '../db'
import { inOrg } from '../db'
import { auditTx } from '../audit'
import { notFound } from '../errors'
import { content, promptPreview, resolveItems, skillsFor } from './content'
import { skillTitle, SUBJECT_ID_LABEL, SUBJECT_ORDER } from './console-common'
import { shellIn } from './console-shell'
import { answerTextId, attemptMinutes, emptyCells, heatCells, scoreText, weekColumns, type ReplayAnswer } from './console-learner-logic'
import { arenaTutorDTO } from './arena-tutor'
import { loadLearner, streakFor, totalXp, type LearnerRow } from './learner-core'
import { yourAnswerText } from './learner-results'

/**
 * T02 Detail learner dan rincian attempt di konsol tutor.
 * Peta penguasaan: skill grade learner (tanpa strand olimpiade yang belum disentuh) ditambah
 * semua skill yang punya skill_state atau jawaban; akurasi dan gerbang per minggu dari tabel response.
 */

const { attempt, response, note, memberProfile, quest, skillState, learnerProfile } = tables

/** Mode tanpa umpan balik: mesin belajar baru diperbarui saat attempt dikumpulkan (lihat submitAttempt). */
const HIDDEN_MODES = new Set(['tes', 'simulasi', 'kertas'])
const OLYMPIAD_STRAND = 'Oly'
const ATTEMPT_LIMIT = 20
const NOTE_LIMIT = 100

export const MODE_LABEL_ID: Record<string, string> = {
  belajar: 'Belajar',
  latihan: 'Latihan',
  kilat: 'Kilat',
  tes: 'Tes',
  simulasi: 'Simulasi',
  kertas: 'Kertas',
  review: 'Review',
}

type AttemptItem = { ref: string; section: string; position: number; difficulty: number }

/** Jawaban tulisan bisa panjang; tabel cukup menampilkan awalnya. */
function clip(text: string, max = 300): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function learnerSince(l: LearnerRow): IsoDate {
  return l.startedOn ?? jakartaDate(l.createdAt)
}

/** Judul attempt untuk konsol: jenis dalam bahasa Indonesia, lalu judul asli (en-GB untuk quest). */
export function attemptTitle(a: { kind: string; mode: string; subject: Subject; title: string; questKind: string | null }): string {
  const subject = SUBJECT_ID_LABEL[a.subject]
  switch (a.kind) {
    case 'quest':
      return `${a.questKind === 'bonus' ? 'Quest bonus' : 'Quest'} ${subject}: ${a.title}`
    case 'test':
      return `Latihan ${subject}: ${a.title}`
    case 'review':
      return `Buku Koreksi ${subject}`
    case 'paper':
      return `Paper ${a.title}${a.mode === 'kertas' ? ', di kertas' : ''}`
    case 'lesson':
      return `Cek pelajaran: ${a.title}`
    case 'simulation':
      return `Simulasi: ${a.title}`
    case 'esmo-pack':
      return `Paket ESMO: ${a.title}`
    case 'esmo-mock':
      return `Simulasi ESMO: ${a.title}`
    default:
      return a.title
  }
}

async function heatmapFor(tx: Tx, learner: LearnerRow, weeks: IsoDate[]): Promise<LearnerDetailDTO['heatmap']> {
  const rows = await tx
    .select({
      skillId: response.skillId,
      status: response.status,
      hintsUsed: response.hintsUsed,
      difficulty: response.difficulty,
      answeredAt: response.answeredAt,
      mode: attempt.mode,
      attemptStatus: attempt.status,
    })
    .from(response)
    .innerJoin(attempt, eq(attempt.id, response.attemptId))
    .where(and(eq(response.learnerId, learner.userId), eq(response.attemptNo, 1), inArray(response.status, ['correct', 'wrong'])))
    .orderBy(asc(response.answeredAt), asc(response.position))
  // Jawaban tes yang belum dikumpulkan belum masuk mesin belajar dan masih bisa diganti.
  const answers: ReplayAnswer[] = rows
    .filter((r) => !(HIDDEN_MODES.has(r.mode) && r.attemptStatus === 'in_progress'))
    .map((r) => ({
      skillId: r.skillId,
      date: jakartaDate(r.answeredAt),
      correct: r.status === 'correct',
      hintsUsed: HIDDEN_MODES.has(r.mode) ? 0 : r.hintsUsed,
      difficulty: r.difficulty,
    }))
  if (answers.length === 0) return []

  const cells = heatCells(answers, weeks, learner.grade)
  const states = await tx.select({ skillId: skillState.skillId, stars: skillState.stars }).from(skillState).where(eq(skillState.learnerId, learner.userId))
  const stars = new Map(states.map((s) => [s.skillId, s.stars]))
  const all = content().skills
  const extra = new Set<string>([...stars.keys(), ...cells.keys()])

  return SUBJECT_ORDER.map((subject) => {
    const own = skillsFor(subject, learner.grade).filter((s) => s.strand !== OLYMPIAD_STRAND || extra.has(s.id))
    const ownIds = new Set(own.map((s) => s.id))
    const others = [...extra]
      .filter((id) => !ownIds.has(id))
      .map((id) => all.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s) && s!.subject === subject)
      .sort((a, b) => a.grade - b.grade || a.order - b.order)
    const list = [...[...own].sort((a, b) => a.order - b.order), ...others]
    return {
      subject,
      skills: list.map((s) => ({ id: s.id, title: s.title, stars: stars.get(s.id) ?? 0, cells: cells.get(s.id) ?? emptyCells(weeks) })),
    }
  }).filter((g) => g.skills.length > 0)
}

async function recentAttempts(tx: Tx, learnerId: string): Promise<LearnerDetailDTO['attempts']> {
  const rows = await tx
    .select({
      id: attempt.id,
      kind: attempt.kind,
      mode: attempt.mode,
      subject: attempt.subject,
      title: attempt.title,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      elapsedS: attempt.elapsedS,
      scoreRaw: attempt.scoreRaw,
      scoreMax: attempt.scoreMax,
      scoreScaled: attempt.scoreScaled,
      itemCount: sql<number>`jsonb_array_length(${attempt.items})`,
      questKind: quest.kind,
    })
    .from(attempt)
    .leftJoin(quest, eq(quest.attemptId, attempt.id))
    .where(and(eq(attempt.learnerId, learnerId), ne(attempt.status, 'in_progress')))
    .orderBy(desc(sql`coalesce(${attempt.submittedAt}, ${attempt.startedAt})`))
    .limit(ATTEMPT_LIMIT)
  if (rows.length === 0) return []
  const stats = await tx
    .select({
      attemptId: response.attemptId,
      activeMs: sql<number>`coalesce(sum(${response.timeMs}), 0)::float8`,
      pending: sql<number>`count(*) filter (where ${response.status} = 'pending')::int`,
    })
    .from(response)
    .where(inArray(response.attemptId, rows.map((r) => r.id)))
    .groupBy(response.attemptId)
  const byId = new Map(stats.map((s) => [s.attemptId, s]))
  return rows.map((r) => {
    const st = byId.get(r.id)
    return {
      id: r.id,
      date: jakartaDate(r.submittedAt ?? r.startedAt),
      title: attemptTitle(r),
      subject: r.subject,
      score: scoreText({ scoreRaw: r.scoreRaw, scoreMax: r.scoreMax, scoreScaled: r.scoreScaled, itemCount: r.itemCount, pending: st?.pending ?? 0 }),
      minutes: attemptMinutes({ activeMs: Number(st?.activeMs ?? 0), elapsedS: r.elapsedS, startedAt: r.startedAt, submittedAt: r.submittedAt }),
      href: `/konsol/learner/${learnerId}/percobaan/${r.id}`,
    }
  })
}

async function notesFor(tx: Tx, learnerId: string): Promise<LearnerDetailDTO['notes']> {
  const rows = await tx
    .select({ id: note.id, body: note.body, createdAt: note.createdAt, author: memberProfile.name })
    .from(note)
    .leftJoin(memberProfile, eq(memberProfile.userId, note.authorId))
    .where(eq(note.learnerId, learnerId))
    .orderBy(desc(note.createdAt))
    .limit(NOTE_LIMIT)
  return rows.map((r) => ({ id: r.id, author: r.author ?? 'Anggota yang sudah keluar', date: r.createdAt.toISOString(), body: r.body }))
}

/** T02 Detail learner. Learner yang tidak ada di org ini menjadi 404. */
export async function learnerDetailDTO(actor: Actor, learnerId: string): Promise<LearnerDetailDTO> {
  const today = jakartaDate()
  return inOrg(orgCtx(actor), async (tx) => {
    const learner = await loadLearner(tx, learnerId)
    const { shell } = await shellIn(tx, actor, learner.userId)
    const xp = await totalXp(tx, learner.userId)
    const streak = await streakFor(tx, learner, today)
    const weeks = weekColumns(today)
    return {
      shell,
      learner: {
        id: learner.userId,
        name: learner.name,
        grade: learner.grade,
        avatar: learner.avatar as AvatarName,
        since: learnerSince(learner),
        xp,
        level: levelForXp(xp),
        streak: streak.current,
      },
      weeks,
      heatmap: await heatmapFor(tx, learner, weeks.map((w) => w.weekStart)),
      attempts: await recentAttempts(tx, learner.userId),
      notes: await notesFor(tx, learner.userId),
      arena: await arenaTutorDTO(tx, learner.userId, learner.grade),
    }
  })
}

/** Catatan tutor untuk satu learner (hanya terlihat oleh tutor dan orang tua yang tertaut, tidak oleh learner). */
export async function addNote(actor: Actor, learnerId: string, body: string): Promise<void> {
  const ctx = orgCtx(actor)
  await inOrg(ctx, async (tx) => {
    const rows = await tx
      .select({ id: learnerProfile.userId })
      .from(learnerProfile)
      .where(and(eq(learnerProfile.userId, learnerId), isNull(learnerProfile.deletedAt)))
      .limit(1)
    if (!rows[0]) throw notFound('Learner tidak ditemukan. Muat ulang halaman lalu coba lagi.')
    const [row] = await tx.insert(note).values({ orgId: ctx.orgId, learnerId, authorId: ctx.userId, body }).returning({ id: note.id })
    // Isi catatan tidak masuk audit, cukup panjangnya.
    await auditTx(tx, ctx, 'learner.note.added', row!.id, { learnerId, length: body.length })
  })
}

// ---------------------------------------------------------------------------
// Rincian attempt

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'Belum dikumpulkan',
  submitted: 'Selesai',
  needs_grading: 'Menunggu nilai tutor',
  graded: 'Selesai, sudah dinilai',
}

export async function attemptDetailDTO(actor: Actor, learnerId: string, attemptId: string): Promise<AttemptDetailDTO> {
  return inOrg(orgCtx(actor), async (tx) => {
    const learner = await loadLearner(tx, learnerId)
    const rows = await tx
      .select({
        id: attempt.id,
        kind: attempt.kind,
        mode: attempt.mode,
        subject: attempt.subject,
        title: attempt.title,
        items: attempt.items,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        elapsedS: attempt.elapsedS,
        scoreRaw: attempt.scoreRaw,
        scoreMax: attempt.scoreMax,
        scoreScaled: attempt.scoreScaled,
        questKind: quest.kind,
      })
      .from(attempt)
      .leftJoin(quest, eq(quest.attemptId, attempt.id))
      .where(and(eq(attempt.id, attemptId), eq(attempt.learnerId, learner.userId)))
      .limit(1)
    const a = rows[0]
    if (!a) throw notFound('Attempt tidak ditemukan untuk learner ini.')
    const { shell } = await shellIn(tx, actor, learner.userId)
    const items = ((a.items as AttemptItem[] | null) ?? []).slice().sort((x, y) => x.position - y.position)
    const resolved = await resolveItems(tx, items.map((i) => i.ref))
    const resp = await tx
      .select({
        id: response.id,
        position: response.position,
        attemptNo: response.attemptNo,
        status: response.status,
        answer: response.answer,
        hintsUsed: response.hintsUsed,
        timeMs: response.timeMs,
        answeredAt: response.answeredAt,
      })
      .from(response)
      .where(eq(response.attemptId, a.id))

    type Resp = (typeof resp)[number]
    const byPos = new Map<number, Resp[]>()
    for (const r of resp) byPos.set(r.position, [...(byPos.get(r.position) ?? []), r])

    const out: AttemptDetailDTO['rows'] = []
    for (const it of items) {
      const tries = byPos.get(it.position) ?? []
      const latest = tries.reduce<Resp | null>((cur, r) => (!cur || r.attemptNo > cur.attemptNo || (r.attemptNo === cur.attemptNo && r.answeredAt > cur.answeredAt) ? r : cur), null)
      const item = resolved.get(it.ref)
      const status: AttemptRowStatus = latest ? (latest.status as AttemptRowStatus) : 'blank'
      const ms = tries.reduce((s, r) => s + r.timeMs, 0)
      out.push({
        position: it.position,
        skillTitle: item ? skillTitle(item.skill) : 'Soal tidak ditemukan',
        prompt: item ? promptPreview(item, 120) : `Soal ${it.ref} tidak ada lagi di bank soal.`,
        type: item?.type ?? 'mcq',
        answer: item && latest ? clip(answerTextId(yourAnswerText(item, latest.answer))) : 'Tidak dijawab',
        key: item ? answerText(item, 'id') : 'Tidak tersedia',
        status,
        tries: tries.length,
        hintsUsed: tries.reduce((m, r) => Math.max(m, r.hintsUsed), 0),
        seconds: tries.length > 0 && ms > 0 ? Math.round(ms / 1000) : null,
        gradeHref: status === 'pending' && latest ? `/konsol/hasil?respon=${latest.id}` : null,
      })
    }
    const count = (s: AttemptRowStatus) => out.filter((r) => r.status === s).length
    const pending = count('pending')
    return {
      shell,
      learner: { id: learner.userId, name: learner.name },
      attempt: {
        id: a.id,
        title: attemptTitle(a),
        subject: a.subject,
        modeLabel: MODE_LABEL_ID[a.mode] ?? a.mode,
        date: (a.submittedAt ?? a.startedAt).toISOString(),
        submitted: a.submittedAt !== null,
        statusLabel: a.status === 'needs_grading' && pending === 0 ? 'Selesai, sudah dinilai' : (STATUS_LABEL[a.status] ?? a.status),
        score:
          a.status === 'in_progress'
            ? `${count('correct')} benar sejauh ini`
            : scoreText({ scoreRaw: a.scoreRaw, scoreMax: a.scoreMax, scoreScaled: a.scoreScaled, itemCount: items.length, pending }),
        minutes: attemptMinutes({ activeMs: resp.reduce((s, r) => s + r.timeMs, 0), elapsedS: a.elapsedS, startedAt: a.startedAt, submittedAt: a.submittedAt }),
        counts: { total: out.length, correct: count('correct'), wrong: count('wrong'), pending, blank: count('blank') },
      },
      rows: out,
      backHref: `/konsol/learner/${learner.userId}`,
    }
  })
}
