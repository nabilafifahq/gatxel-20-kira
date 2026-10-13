import 'server-only'
import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, notInArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { answerXp, jakartaDate, scoreWithPreset } from '@kira/core'
import { tables } from '@kira/db'
import type { Item } from '@kira/content'
import type { GradingDTO, InboxDTO, InboxRow, Subject } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import { auditTx } from '../audit'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { conflict, invalid, notFound } from '../errors'
import { log } from '../log'
import { latestConsents } from './consent'
import { shellIn } from './console-shell'
import { assertAiProvider, assertAiQuota, enqueueAiJobTx, skillBrief } from './console-studio'
import { resolveItems, skill, toClient } from './content'
import { effectiveRules, presetForAttempt } from './learner-competition'
import { grantXp } from './learner-core'
import { latestByPosition, type AttemptItem } from './learner-runner'

/**
 * T05 Hasil dan penilaian. Jawaban yang dinilai tutor: tulisan (write), foto kertas (write dengan media),
 * rekaman (speak), dan gambar (draw). Nilai per kriteria rubrik menjadi skor jawaban, status benar bila
 * minimal separuh poin, lalu skor attempt dihitung ulang setelah tidak ada jawaban yang menunggu.
 */

const { response, attempt, learnerProfile, media, aiJob } = tables

const MANUAL_TYPES = ['write', 'speak', 'draw', 'photo']
/** Mode tanpa umpan balik: jawaban masih bisa diganti learner sampai attempt dikumpulkan. */
const HIDDEN_MODES: ('tes' | 'simulasi' | 'kertas')[] = ['tes', 'simulasi', 'kertas']
const isHiddenMode = (mode: string) => (HIDDEN_MODES as string[]).includes(mode)

// ---------------------------------------------------------------------------
// Logika murni (diuji di test/console-inbox.test.ts)

export type InboxType = InboxRow['type']

export function inboxType(itemType: string, mediaId: string | null): InboxType | null {
  if (itemType === 'speak') return 'speak'
  if (itemType === 'draw') return 'draw'
  if (itemType === 'write') return mediaId ? 'photo' : 'write'
  return mediaId ? 'photo' : null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Teks dan id media dari jawaban tersimpan (`{ text }`, `{ mediaId, text? }`). */
export function answerParts(answer: unknown, mediaColumn: string | null): { text: string | null; mediaId: string | null } {
  const a = answer !== null && typeof answer === 'object' && !Array.isArray(answer) ? (answer as Record<string, unknown>) : {}
  const text = typeof a.text === 'string' && a.text.trim() ? a.text : null
  const fromAnswer = typeof a.mediaId === 'string' && UUID.test(a.mediaId) ? a.mediaId : null
  return { text, mediaId: mediaColumn ?? fromAnswer }
}

export type RubricCriterion = { label: string; points: number }
export type RubricResult = { ok: true; total: number; max: number; score: number; status: 'correct' | 'wrong' } | { ok: false; message: string }

/**
 * Nilai rubrik menjadi skor jawaban. Setiap nilai bilangan bulat 0 sampai poin kriterianya.
 * score = jumlah nilai / total poin x maxScore jawaban; benar bila minimal separuh poin.
 */
export function rubricResult(scores: readonly number[], criteria: readonly RubricCriterion[], maxScore = 1): RubricResult {
  if (criteria.length === 0) return { ok: false, message: 'Soal ini tidak punya rubrik, jadi tidak bisa dinilai dari sini.' }
  if (scores.length !== criteria.length) {
    return { ok: false, message: `Rubrik soal ini punya ${criteria.length} kriteria, nilai yang dikirim ${scores.length}. Muat ulang halaman lalu nilai lagi.` }
  }
  for (let i = 0; i < criteria.length; i++) {
    const s = scores[i]!
    const c = criteria[i]!
    if (!Number.isInteger(s) || s < 0 || s > c.points) {
      return { ok: false, message: `Nilai untuk ${c.label} harus 0 sampai ${c.points} poin, sekarang ${s}.` }
    }
  }
  const total = scores.reduce((a, b) => a + b, 0)
  const max = criteria.reduce((a, c) => a + c.points, 0)
  const score = Math.round((total / max) * maxScore * 1000) / 1000
  return { ok: true, total, max, score, status: total * 2 >= max ? 'correct' : 'wrong' }
}

export type Topic = { label: string; right: number; total: number }

/** Hitung ulang hasil attempt dari status jawaban terakhir per posisi (sama dengan submitAttempt). */
export function attemptOutcome(
  items: readonly AttemptItem[],
  statusAt: (position: number) => string | undefined,
  topicOf: (ref: string) => string,
): { correct: number; pending: number; total: number; byTopic: Topic[]; statuses: { position: number; status: 'correct' | 'wrong' | 'blank' }[] } {
  let correct = 0
  let pending = 0
  const byTopic = new Map<string, Topic>()
  const statuses: { position: number; status: 'correct' | 'wrong' | 'blank' }[] = []
  for (const it of items) {
    const st = statusAt(it.position)
    const label = topicOf(it.ref)
    const t = byTopic.get(label) ?? { label, right: 0, total: 0 }
    t.total++
    if (st === 'correct') {
      correct++
      t.right++
    } else if (st === 'pending') pending++
    byTopic.set(label, t)
    statuses.push({ position: it.position, status: st === 'correct' ? 'correct' : st === 'wrong' ? 'wrong' : 'blank' })
  }
  return { correct, pending, total: items.length, byTopic: [...byTopic.values()], statuses }
}

/** Umpan balik untuk anak: tanpa em dash dan en dash, spasi dirapikan. */
export function cleanFeedback(raw: string): string {
  return raw
    .replace(/\s*[\u2014\u2013]\s*/g, ', ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +,/g, ',')
    .trim()
}

function rubricOf(item: Item | undefined): RubricCriterion[] {
  if (!item || !('rubric' in item) || !item.rubric) return []
  return item.rubric.criteria.map((c) => ({ label: c.label, points: c.points }))
}

// ---------------------------------------------------------------------------
// DTO

const aiSuggestionSchema = z.object({
  scores: z.array(z.number().int().min(0).max(10)).max(10),
  feedback: z.string().max(2000),
  confidence: z.string().max(20),
  createdAt: z.string().max(40),
})

type ListRow = {
  id: string
  attemptId: string
  position: number
  itemRef: string
  itemType: string
  subject: Subject
  answeredAt: Date
  gradedAt: Date | null
  rubricScores: number[] | null
  mediaId: string | null
  attemptTitle: string
  learnerName: string
}

const listCols = {
  id: response.id,
  attemptId: response.attemptId,
  position: response.position,
  itemRef: response.itemRef,
  itemType: response.itemType,
  subject: response.subject,
  answeredAt: response.answeredAt,
  gradedAt: response.gradedAt,
  rubricScores: response.rubricScores,
  mediaId: sql<string | null>`coalesce(${response.mediaId}::text, ${response.answer}->>'mediaId')`,
  attemptTitle: attempt.title,
  learnerName: learnerProfile.name,
}

const manualFilter = () => or(inArray(response.itemType, MANUAL_TYPES), isNotNull(response.mediaId), sql`${response.answer} ? 'mediaId'`)

async function listRows(tx: Tx): Promise<{ waiting: ListRow[]; graded: ListRow[] }> {
  const waiting = await tx
    .select(listCols)
    .from(response)
    .innerJoin(attempt, eq(attempt.id, response.attemptId))
    .innerJoin(learnerProfile, eq(learnerProfile.userId, response.learnerId))
    .where(
      and(
        manualFilter(),
        eq(response.status, 'pending'),
        isNull(learnerProfile.deletedAt),
        // Jawaban tes yang belum dikumpulkan masih bisa diganti, jadi belum masuk kotak hasil.
        or(ne(attempt.status, 'in_progress'), notInArray(attempt.mode, HIDDEN_MODES)),
      ),
    )
    .orderBy(asc(response.answeredAt))
    .limit(200)
  const graded = await tx
    .select(listCols)
    .from(response)
    .innerJoin(attempt, eq(attempt.id, response.attemptId))
    .innerJoin(learnerProfile, eq(learnerProfile.userId, response.learnerId))
    .where(and(manualFilter(), isNotNull(response.gradedAt), isNull(learnerProfile.deletedAt)))
    .orderBy(desc(response.gradedAt))
    .limit(50)
  return { waiting: waiting as ListRow[], graded: graded as ListRow[] }
}

export async function inboxDTO(actor: Actor, filter: InboxDTO['filter'], respon: string | null): Promise<InboxDTO> {
  const ctx = orgCtx(actor)
  return inOrg(ctx, async (tx) => {
    const { shell } = await shellIn(tx, actor, null)
    const { waiting, graded } = await listRows(tx)
    const items = await resolveItems(tx, [...new Set([...waiting, ...graded].map((r) => r.itemRef))])
    const toRow = (r: ListRow, status: InboxRow['status']): InboxRow | null => {
      const item = items.get(r.itemRef)
      const rubric = rubricOf(item)
      const type = inboxType(r.itemType, r.mediaId)
      if (!item || rubric.length === 0 || !type) {
        log.warn('jawaban di kotak hasil dilewati: soal atau rubrik tidak ditemukan', { responseId: r.id, itemRef: r.itemRef })
        return null
      }
      return {
        responseId: r.id,
        learnerName: r.learnerName,
        subject: r.subject,
        itemTitle: `${r.attemptTitle}, soal ${r.position}`,
        type,
        submittedAt: r.answeredAt.toISOString(),
        status,
        score: status === 'graded' && r.rubricScores ? r.rubricScores.reduce((a, b) => a + b, 0) : null,
        max: rubric.reduce((a, c) => a + c.points, 0),
      }
    }
    const rows = [...waiting.map((r) => toRow(r, 'waiting')), ...graded.map((r) => toRow(r, 'graded'))].filter((r): r is InboxRow => r !== null)
    const pool = rows.filter((r) => r.status === filter)
    const selectedId = respon && pool.some((r) => r.responseId === respon) ? respon : (pool[0]?.responseId ?? null)
    const selected = selectedId ? await gradingDTO(tx, selectedId, items) : null
    return { shell, filter, rows, selected }
  })
}

async function gradingDTO(tx: Tx, responseId: string, items: Map<string, Item>): Promise<GradingDTO | null> {
  const [r] = await tx
    .select({
      id: response.id,
      attemptId: response.attemptId,
      itemRef: response.itemRef,
      itemType: response.itemType,
      answer: response.answer,
      mediaColumn: response.mediaId,
      rubricScores: response.rubricScores,
      feedback: response.feedback,
      aiSuggestion: response.aiSuggestion,
      learnerName: learnerProfile.name,
    })
    .from(response)
    .innerJoin(learnerProfile, eq(learnerProfile.userId, response.learnerId))
    .where(eq(response.id, responseId))
    .limit(1)
  const item = r ? items.get(r.itemRef) : undefined
  if (!r || !item) return null
  const rubric = rubricOf(item)
  const parts = answerParts(r.answer, r.mediaColumn)
  const type = inboxType(r.itemType, parts.mediaId)
  let mediaUrl: string | null = null
  let mediaKind: GradingDTO['mediaKind'] = type === 'speak' ? 'audio' : type === 'draw' || type === 'photo' ? 'image' : null
  if (parts.mediaId) {
    const [m] = await tx.select({ id: media.id, kind: media.kind, deletedAt: media.deletedAt }).from(media).where(eq(media.id, parts.mediaId)).limit(1)
    if (m && !m.deletedAt) {
      mediaUrl = `/api/media/${m.id}`
      mediaKind = m.kind === 'audio' ? 'audio' : 'image'
    }
  }
  const ai = aiSuggestionSchema.safeParse(r.aiSuggestion)
  return {
    responseId: r.id,
    learnerName: r.learnerName,
    prompt: item.prompt,
    item: toClient(item, { ref: r.itemRef, seed: r.attemptId, includeKey: true, includeHints: true }),
    answerText: parts.text,
    mediaUrl,
    mediaKind,
    rubric,
    scores: r.rubricScores && r.rubricScores.length === rubric.length ? r.rubricScores : null,
    feedback: r.feedback,
    aiSuggestion: ai.success && ai.data.scores.length === rubric.length ? ai.data : null,
  }
}

// ---------------------------------------------------------------------------
// Menilai

export type GradeInput = { responseId: string; scores: number[]; feedback: string; acceptedAi: boolean }

export async function gradeResponseTx(tx: Tx, ctx: OrgContext, input: GradeInput): Promise<{ total: number; max: number }> {
  const [r] = await tx
    .select({
      id: response.id,
      attemptId: response.attemptId,
      learnerId: response.learnerId,
      itemRef: response.itemRef,
      itemType: response.itemType,
      status: response.status,
      gradedAt: response.gradedAt,
      maxScore: response.maxScore,
      mediaColumn: response.mediaId,
      answer: response.answer,
    })
    .from(response)
    .where(eq(response.id, input.responseId))
    .limit(1)
    .for('update')
  if (!r) throw notFound('Jawaban tidak ditemukan. Muat ulang halaman hasil.')
  if (!inboxType(r.itemType, answerParts(r.answer, r.mediaColumn).mediaId)) throw invalid('Jawaban ini dinilai otomatis, jadi tidak dinilai dari sini.')
  if (r.status !== 'pending' && !r.gradedAt) throw conflict('Jawaban ini sudah dinilai otomatis. Muat ulang halaman hasil.')

  const [a] = await tx
    .select({ id: attempt.id, status: attempt.status, mode: attempt.mode, kind: attempt.kind, refId: attempt.refId, subject: attempt.subject, items: attempt.items, result: attempt.result })
    .from(attempt)
    .where(eq(attempt.id, r.attemptId))
    .limit(1)
    .for('update')
  if (!a) throw notFound('Attempt jawaban ini tidak ditemukan. Muat ulang halaman hasil.')
  if (a.status === 'in_progress' && isHiddenMode(a.mode)) {
    throw conflict('Tes ini belum dikumpulkan learner. Nilai jawaban setelah tes dikumpulkan.')
  }

  const item = (await resolveItems(tx, [r.itemRef])).get(r.itemRef)
  if (!item) throw notFound('Soal jawaban ini tidak ditemukan lagi di bank soal. Laporkan ke pengelola Kira.')
  const result = rubricResult(input.scores, rubricOf(item), r.maxScore)
  if (!result.ok) throw invalid(result.message, { scores: result.message })

  const feedback = cleanFeedback(input.feedback)
  const now = new Date()
  const firstGrade = r.gradedAt === null
  let xp = 0
  if (firstGrade) {
    // XP sekali saja, seperti jawaban percobaan pertama tanpa hint.
    xp = answerXp({ difficulty: item.difficulty, correct: result.status === 'correct', hintsUsed: 0, attemptNo: 1 })
    await grantXp(tx, ctx, r.learnerId, xp, 'graded-answer', r.id, jakartaDate(now))
  }
  await tx
    .update(response)
    .set({
      rubricScores: [...input.scores],
      feedback: feedback || null,
      gradedBy: ctx.userId,
      gradedAt: now,
      score: result.score,
      status: result.status,
      ...(firstGrade ? { xp } : {}),
    })
    .where(eq(response.id, r.id))

  if (a.status !== 'in_progress') await recomputeAttemptTx(tx, a, xp)
  await auditTx(tx, ctx, firstGrade ? 'response.graded' : 'response.regraded', r.id, { total: result.total, max: result.max, acceptedAi: input.acceptedAi })
  return { total: result.total, max: result.max }
}

type AttemptForScore = { id: string; status: 'in_progress' | 'submitted' | 'needs_grading' | 'graded'; kind: string; refId: string | null; subject: string; items: unknown; result: unknown }

/** Skor attempt dihitung ulang dari jawaban terakhir per posisi; status menjadi graded bila tidak ada yang menunggu. */
async function recomputeAttemptTx(tx: Tx, a: AttemptForScore, addXp: number): Promise<void> {
  const items = (a.items as AttemptItem[]) ?? []
  const latest = latestByPosition(await tx.select().from(response).where(eq(response.attemptId, a.id)))
  const resolved = await resolveItems(tx, items.map((i) => i.ref))
  const out = attemptOutcome(
    items,
    (p) => latest.get(p)?.status,
    (ref) => {
      const it = resolved.get(ref)
      return it ? (skill(it.skill)?.title ?? it.skill) : 'Other'
    },
  )
  let scoreRaw: number = out.correct
  let scoreMax: number = out.total
  let scoreScaled: number | null = null
  const p = presetForAttempt(a)
  if (p) {
    const s = scoreWithPreset(effectiveRules(p, items.length), out.statuses)
    scoreRaw = s.raw
    scoreMax = s.max
    scoreScaled = s.scaled
  }
  const prev = a.result && typeof a.result === 'object' && !Array.isArray(a.result) ? (a.result as Record<string, unknown>) : {}
  await tx
    .update(attempt)
    .set({
      status: out.pending === 0 && a.status === 'needs_grading' ? 'graded' : a.status,
      scoreRaw,
      scoreMax,
      scoreScaled,
      result: { ...prev, pending: out.pending, byTopic: out.byTopic },
      ...(addXp > 0 ? { xp: sql`${attempt.xp} + ${addXp}` } : {}),
    })
    .where(eq(attempt.id, a.id))
}

// ---------------------------------------------------------------------------
// Saran nilai AI

export async function requestAiSuggestionTx(tx: Tx, ctx: OrgContext, responseId: string): Promise<string> {
  assertAiProvider()
  const [r] = await tx
    .select({
      id: response.id,
      learnerId: response.learnerId,
      itemRef: response.itemRef,
      itemType: response.itemType,
      answer: response.answer,
      mediaColumn: response.mediaId,
      aiSuggestion: response.aiSuggestion,
      learnerName: learnerProfile.name,
    })
    .from(response)
    .innerJoin(learnerProfile, eq(learnerProfile.userId, response.learnerId))
    .where(eq(response.id, responseId))
    .limit(1)
  if (!r) throw notFound('Jawaban tidak ditemukan. Muat ulang halaman hasil.')
  const parts = answerParts(r.answer, r.mediaColumn)
  const type = inboxType(r.itemType, parts.mediaId)
  if (!type) throw invalid('Jawaban ini dinilai otomatis, jadi tidak butuh saran nilai.')
  if (type === 'speak') throw invalid('Rekaman suara tidak dikirim ke AI. Dengarkan rekamannya lalu nilai manual.')
  if (type === 'draw') throw invalid('Gambar di tablet tidak dikirim ke AI. Nilai gambar ini manual.')
  if (r.aiSuggestion) throw conflict('Saran nilai untuk jawaban ini sudah ada. Muat ulang halaman untuk melihatnya.')

  const [busy] = await tx
    .select({ id: aiJob.id })
    .from(aiJob)
    .where(and(eq(aiJob.kind, 'grade'), inArray(aiJob.status, ['queued', 'running']), sql`${aiJob.input}->>'responseId' = ${r.id}`))
    .limit(1)
  if (busy) throw conflict('Saran nilai untuk jawaban ini sedang dibuat. Muat ulang halaman dalam satu atau dua menit.')

  const consent = (await latestConsents(tx, [r.learnerId])).get(r.learnerId)
  if (consent?.get('ai-drafts')?.granted !== true) {
    throw conflict(`Orang tua ${r.learnerName} belum menyetujui bantuan AI. Nilai jawaban ini manual, atau minta persetujuan lewat halaman orang tua.`)
  }
  let mediaId: string | null = null
  if (type === 'photo' && parts.mediaId) {
    if (consent?.get('photo')?.granted !== true) {
      throw conflict(`Orang tua ${r.learnerName} belum menyetujui foto jawaban. Nilai jawaban ini manual.`)
    }
    const [m] = await tx.select({ id: media.id, kind: media.kind, deletedAt: media.deletedAt }).from(media).where(eq(media.id, parts.mediaId)).limit(1)
    if (!m || m.deletedAt || m.kind === 'audio') throw invalid('Foto jawaban sudah tidak ada di server. Nilai jawaban ini manual.')
    mediaId = m.id
  }
  if (!parts.text && !mediaId) throw invalid('Jawaban ini kosong, jadi tidak ada yang bisa dinilai AI.')

  const item = (await resolveItems(tx, [r.itemRef])).get(r.itemRef)
  if (!item || rubricOf(item).length === 0) throw invalid('Soal ini tidak punya rubrik, jadi tidak bisa dinilai AI.')
  await assertAiQuota(tx)
  const { aiJobId } = await enqueueAiJobTx(tx, ctx, { kind: 'grade', responseId: r.id, skill: skillBrief(item.skill), item, answerText: parts.text, mediaId })
  await auditTx(tx, ctx, 'ai.grade.requested', r.id, { aiJobId, withImage: mediaId !== null })
  return aiJobId
}
