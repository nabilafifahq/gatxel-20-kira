import 'server-only'
import { and, desc, eq, gte, inArray, isNotNull, like, or, sql } from 'drizzle-orm'
import { createRng, formatDateId, jakartaDate, weekday } from '@kira/core'
import { tables } from '@kira/db'
import type { Subject } from '@/lib/dto'
import type { FixItDTO, MistakeReportDTO } from '@/lib/dto-paper'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { invalid } from '../errors'
import { shellIn } from './console-shell'
import { promptPreview, resolveItems, skill } from './content'
import { learnerShell, loadLearner } from './learner-core'
import type { AttemptItem } from './learner-runner'
import { classifyMistake, MISTAKE_LABEL, pickRedoItems, REDO_REF_PREFIX, REDO_SIZE, summariseTypes, topSkills } from './mistake-logic'

/**
 * Buku Salah (rencana 10.6). Semua jawaban salah atau kosong dari Tes dan Paper dikumpulkan; tidak ada tabel
 * baru: daftar dihitung dari `response` dan `attempt`, jadi tidak perlu kait di jalur pengumpulan jawaban.
 * Satu soal terbuka sampai dijawab benar lagi, di sesi ulang Buku Salah atau di Tes dan Paper berikutnya.
 * Sesi ulang adalah attempt kind test, mode latihan (umpan balik dan petunjuk), ref_id "buku-salah:<tanggal>".
 */

const { response, attempt } = tables

const TIMED_MODES = ['tes', 'simulasi', 'kertas'] as const
const TIMED_KINDS = ['paper', 'simulation', 'esmo-mock', 'esmo-pack'] as const
const SUBJECT_ORDER: readonly Subject[] = ['math', 'english', 'science']
const SUBJECT_EN: Record<Subject, string> = { math: 'Math', english: 'English', science: 'Science' }

export type OpenMistake = {
  ref: string
  skillId: string
  subject: Subject
  itemType: string
  difficulty: number
  status: 'wrong' | 'blank'
  timeMs: number
  answeredAt: Date
}

const redoLike = `${REDO_REF_PREFIX}%`

/** Soal yang masih terbuka di Buku Salah: jawaban terakhirnya salah atau kosong di Tes atau Paper, dan belum dijawab benar sesudahnya. */
export async function openMistakes(tx: Tx, learnerId: string): Promise<OpenMistake[]> {
  const rows = await tx
    .selectDistinctOn([response.itemRef], {
      ref: response.itemRef,
      skillId: response.skillId,
      subject: response.subject,
      itemType: response.itemType,
      difficulty: response.difficulty,
      status: response.status,
      timeMs: response.timeMs,
      answeredAt: response.answeredAt,
    })
    .from(response)
    .innerJoin(attempt, eq(attempt.id, response.attemptId))
    .where(
      and(
        eq(response.learnerId, learnerId),
        inArray(response.status, ['wrong', 'blank']),
        isNotNull(attempt.submittedAt),
        or(inArray(attempt.mode, [...TIMED_MODES]), inArray(attempt.kind, [...TIMED_KINDS])),
        sql`coalesce(${attempt.refId}, '') not like ${redoLike}`,
        sql`not exists (select 1 from response r2 where r2.attempt_id = ${response.attemptId} and r2.position = ${response.position} and r2.attempt_no > ${response.attemptNo})`,
        sql`not exists (
          select 1 from response c join attempt ca on ca.id = c.attempt_id
          where c.learner_id = ${response.learnerId} and c.item_ref = ${response.itemRef} and c.status = 'correct' and c.answered_at > ${response.answeredAt}
            and (ca.ref_id like ${redoLike} or ca.mode in ('tes', 'simulasi', 'kertas') or ca.kind in ('paper', 'simulation', 'esmo-mock', 'esmo-pack')))`,
      ),
    )
    .orderBy(response.itemRef, desc(response.answeredAt))
  return rows.map((r) => ({ ...r, status: r.status === 'blank' ? 'blank' : 'wrong' }))
}

/** Soal yang dibenahi di sesi ulang sejak tanggal tertentu (jumlah soal berbeda). */
async function clearedSince(tx: Tx, learnerId: string, since: Date): Promise<number> {
  const rows = await tx
    .selectDistinct({ ref: response.itemRef })
    .from(response)
    .innerJoin(attempt, eq(attempt.id, response.attemptId))
    .where(and(eq(response.learnerId, learnerId), eq(response.status, 'correct'), like(attempt.refId, redoLike), gte(response.answeredAt, since)))
  return rows.length
}

async function redoHistory(tx: Tx, learnerId: string): Promise<{ date: string; correct: number; total: number }[]> {
  const rows = await tx
    .select({ at: attempt.submittedAt, raw: attempt.scoreRaw, max: attempt.scoreMax })
    .from(attempt)
    .where(and(eq(attempt.learnerId, learnerId), like(attempt.refId, redoLike), isNotNull(attempt.submittedAt)))
    .orderBy(desc(attempt.submittedAt))
    .limit(6)
  return rows.filter((r) => r.at && r.raw !== null && r.max !== null).map((r) => ({ date: jakartaDate(r.at!), correct: Math.round(r.raw!), total: Math.round(r.max!) }))
}

// ---------------------------------------------------------------------------
// Sisi learner (en-GB)

export async function fixItDTO(tx: Tx, learnerId: string): Promise<FixItDTO> {
  const learner = await loadLearner(tx, learnerId)
  const today = jakartaDate()
  const open = await openMistakes(tx, learnerId)
  const resolved = await resolveItems(tx, open.map((o) => o.ref))
  const usable = open.filter((o) => resolved.has(o.ref))
  return {
    shell: await learnerShell(tx, learner, today),
    open: usable.length,
    sessionSize: Math.min(REDO_SIZE, usable.length),
    saturday: weekday(today) === 6,
    bySubject: SUBJECT_ORDER.map((s) => ({ subject: s, label: SUBJECT_EN[s], count: usable.filter((o) => o.subject === s).length })).filter((g) => g.count > 0),
    canStart: usable.length > 0,
  }
}

/** Mulai sesi ulang Buku Salah: sesi yang belum selesai dilanjutkan, selain itu paling banyak REDO_SIZE soal, tersebar antar-skill. */
export async function startFixItSession(tx: Tx, ctx: OrgContext, learnerId: string): Promise<string> {
  const today = jakartaDate()
  const [open] = await tx
    .select({ id: attempt.id })
    .from(attempt)
    .where(and(eq(attempt.learnerId, learnerId), like(attempt.refId, redoLike), eq(attempt.status, 'in_progress')))
    .limit(1)
  if (open) return open.id
  const mistakes = await openMistakes(tx, learnerId)
  const resolved = await resolveItems(tx, mistakes.map((m) => m.ref))
  const usable = mistakes.filter((m) => resolved.has(m.ref))
  if (usable.length === 0) throw invalid('Nothing to fix yet.')
  const rng = createRng(`${learnerId}:${today}:fix-it`)
  const picked = pickRedoItems(usable, REDO_SIZE, (xs) => rng.shuffle(xs))
  const items: AttemptItem[] = picked.map((m, i) => ({ ref: m.ref, section: 'core', position: i + 1, difficulty: resolved.get(m.ref)!.difficulty }))
  const bySubject = new Map<Subject, number>()
  for (const m of picked) bySubject.set(m.subject, (bySubject.get(m.subject) ?? 0) + 1)
  const subject = [...bySubject.entries()].sort((a, b) => b[1] - a[1])[0]![0]
  const [row] = await tx
    .insert(attempt)
    .values({ orgId: ctx.orgId, learnerId, kind: 'test', mode: 'latihan', subject, title: 'Fix-it Book', refId: `${REDO_REF_PREFIX}:${today}`, items })
    .returning({ id: attempt.id })
  return row!.id
}

// ---------------------------------------------------------------------------
// Sisi tutor (id)

export async function mistakeReportDTO(actor: Actor, learnerParam: string | null): Promise<MistakeReportDTO> {
  return inOrg(orgCtx(actor), async (tx) => {
    const { shell, learner } = await shellIn(tx, actor, learnerParam)
    if (!learner) return { shell, learner: null, open: 0, cleared: 0, byType: [], bySkill: [], items: [], redo: [] }
    const today = jakartaDate()
    const open = await openMistakes(tx, learner.id)
    const resolved = await resolveItems(tx, open.map((o) => o.ref))
    const usable = open.filter((o) => resolved.has(o.ref))
    const typed = usable.map((m) => ({ ...m, type: classifyMistake({ status: m.status, timeMs: m.timeMs, difficulty: m.difficulty }) }))
    const since = new Date(Date.parse(`${today}T00:00:00+07:00`) - 30 * 24 * 60 * 60 * 1000)
    const recent = [...typed].sort((a, b) => b.answeredAt.getTime() - a.answeredAt.getTime()).slice(0, 30)
    return {
      shell,
      learner: { id: learner.id, name: learner.name, grade: learner.grade },
      open: usable.length,
      cleared: await clearedSince(tx, learner.id, since),
      byType: summariseTypes(typed.map((t) => t.type)),
      bySkill: topSkills(typed.map((t) => t.skillId)).map((s) => ({
        skillId: s.skillId,
        title: skill(s.skillId)?.title ?? s.skillId,
        subject: skill(s.skillId)?.subject ?? 'math',
        count: s.count,
      })),
      items: recent.map((m) => ({
        ref: m.ref,
        skillTitle: skill(m.skillId)?.title ?? m.skillId,
        subject: m.subject,
        typeLabel: MISTAKE_LABEL[m.type],
        wrongOn: formatDateId(jakartaDate(m.answeredAt)),
        prompt: promptPreview(resolved.get(m.ref)!, 110),
      })),
      redo: await redoHistory(tx, learner.id),
    }
  })
}
