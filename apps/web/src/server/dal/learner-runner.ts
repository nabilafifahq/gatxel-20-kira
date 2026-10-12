import 'server-only'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { jakartaDate, modeAllowsHints, modeShowsFeedback, questCompletionXp, scoreWithPreset, type Mode } from '@kira/core'
import { tables } from '@kira/db'
import { answerFromLabels, answerToLabels, checkAnswer, keyOf, labelCount, type Item, type LabelPerm } from '@kira/content'
import type { AnswerPayload, AnswerResult, RunnerDTO, RunnerItem, SavedResponse, Subject } from '@/lib/dto'
import type { OrgContext, Tx } from '../db'
import { invalid, notFound } from '../errors'
import { labelPerm, runnerSeed } from '../labels'
import { resolveItems, skill, toClient } from './content'
import { effectiveRules, presetForAttempt } from './learner-competition'
import { applyOutcome, awardBadges, grantXp, learnerShell, loadLearner, refreshDayRecord } from './learner-core'

const { attempt, response, quest, media, skillState } = tables

export type AttemptItem = { ref: string; section: 'warmup' | 'core' | 'challenge' | 'sprint'; position: number; difficulty: number }
type AttemptRow = typeof attempt.$inferSelect
type ResponseRow = typeof response.$inferSelect

const HIDDEN_MODES = new Set(['tes', 'simulasi', 'kertas'])

export function dtoKind(kind: AttemptRow['kind']): RunnerDTO['kind'] {
  switch (kind) {
    case 'quest':
      return 'quest'
    case 'review':
      return 'review'
    case 'paper':
      return 'paper'
    case 'lesson':
      return 'lesson-check'
    case 'simulation':
    case 'esmo-mock':
      return 'simulation'
    default:
      return 'test'
  }
}

export function exitFor(a: Pick<AttemptRow, 'kind'>): string {
  if (a.kind === 'esmo-pack' || a.kind === 'esmo-mock') return '/esmo'
  if (a.kind === 'simulation') return '/competitions'
  if (a.kind === 'review') return '/review'
  return '/today'
}

export async function loadAttempt(tx: Tx, learnerId: string, attemptId: string): Promise<AttemptRow> {
  if (!z.string().uuid().safeParse(attemptId).success) throw notFound()
  const rows = await tx.select().from(attempt).where(and(eq(attempt.id, attemptId), eq(attempt.learnerId, learnerId))).limit(1)
  if (!rows[0]) throw notFound('Soal ini tidak ditemukan.')
  return rows[0]
}

/** Awal jam attempt: saat pertama dibuka di runner, atau saat dibuat bila belum pernah dibuka. */
export function clockStart(a: Pick<AttemptRow, 'openedAt' | 'startedAt'>): Date {
  return a.openedAt ?? a.startedAt
}

export function latestByPosition(rows: ResponseRow[]): Map<number, ResponseRow> {
  const m = new Map<number, ResponseRow>()
  for (const r of rows) {
    const cur = m.get(r.position)
    if (!cur || r.attemptNo > cur.attemptNo || (r.attemptNo === cur.attemptNo && r.answeredAt > cur.answeredAt)) m.set(r.position, r)
  }
  return m
}

/**
 * `markOpened`: halaman runner benar-benar dibuka oleh learner (bukan prefetch atau simpan offline
 * oleh service worker). Pembukaan pertama mencatat opened_at sehingga jam mulai di sini.
 * Attempt berwaktu selalu mulai pada render pertama: header simpan offline bisa dikirim siapa saja,
 * jadi soal tes berwaktu tidak pernah terkirim tanpa jam berjalan (dan tidak masuk simpanan offline).
 */
export async function runnerDTO(tx: Tx, learnerId: string, attemptId: string, opts: { markOpened?: boolean } = {}): Promise<RunnerDTO | { submitted: true }> {
  const a = await loadAttempt(tx, learnerId, attemptId)
  if (a.status !== 'in_progress') return { submitted: true }
  if (!a.openedAt && (opts.markOpened || a.timeLimitS)) {
    const [o] = await tx
      .update(attempt)
      .set({ openedAt: new Date() })
      .where(and(eq(attempt.id, a.id), isNull(attempt.openedAt)))
      .returning({ openedAt: attempt.openedAt })
    if (o?.openedAt) a.openedAt = o.openedAt
  }
  const learner = await loadLearner(tx, learnerId)
  const items = (a.items as AttemptItem[]) ?? []
  const resolved = await resolveItems(tx, items.map((i) => i.ref))
  const mode = a.mode as Mode
  const feedback = modeShowsFeedback(mode)
  const hints = modeAllowsHints(mode)
  // Mode tanpa umpan balik: urutan tampil dan label pilihan dihitung dari KIRA_SECRET (lihat server/labels.ts).
  const hidden = HIDDEN_MODES.has(a.mode)
  const seed = hidden ? runnerSeed(a.id) : a.id
  const byPosition = new Map<number, { item: Item; perm: LabelPerm | null }>()
  const runnerItems: RunnerItem[] = []
  for (const it of items) {
    const item = resolved.get(it.ref)
    if (!item) continue
    const perm = hidden ? labelPerm(a.id, it.ref, labelCount(item)) : null
    byPosition.set(it.position, { item, perm })
    runnerItems.push({ ...toClient(item, { ref: it.ref, seed, includeKey: feedback, includeHints: hints, labels: perm }), position: it.position, section: it.section })
  }
  const resp = await tx.select().from(response).where(eq(response.attemptId, a.id))
  const latest = latestByPosition(resp)
  const saved: SavedResponse[] = [...latest.values()].map((r) => {
    const at = byPosition.get(r.position)
    return {
      position: r.position,
      answer: (at ? answerToLabels(at.item, r.answer, at.perm) : r.answer) as SavedResponse['answer'],
      status: HIDDEN_MODES.has(a.mode) ? 'answered' : r.status,
      hintsUsed: r.hintsUsed,
      attemptNo: r.attemptNo,
      flagged: r.flagged,
    }
  })
  // Belum pernah dibuka (misalnya halaman dari simpanan offline): jam mulai dari nol di perangkat.
  const elapsed = a.openedAt ? Math.max(0, Math.floor((Date.now() - a.openedAt.getTime()) / 1000)) : 0
  return {
    shell: await learnerShell(tx, learner),
    attemptId: a.id,
    kind: dtoKind(a.kind),
    mode: (mode === 'kertas' ? 'tes' : mode) as RunnerDTO['mode'],
    subject: a.subject as Subject,
    title: a.title,
    items: runnerItems,
    saved,
    timeLimitSec: a.timeLimitS,
    startedAt: clockStart(a).toISOString(),
    elapsedSec: a.timeLimitS ? Math.min(elapsed, a.timeLimitS) : elapsed,
    showFeedback: feedback,
    allowHints: hints,
    allowRetry: mode === 'latihan' || mode === 'belajar' || mode === 'review',
    exitHref: exitFor(a),
    doneHref: `/results/${a.id}`,
    showTerms: runnerItems.some((i) => (i.terms?.length ?? 0) > 0),
    offline: true,
  }
}

export const answerPayloadSchema = z
  .object({
    attemptId: z.string().uuid(),
    position: z.number().int().min(1).max(200),
    answer: z.unknown(),
    hintsUsed: z.number().int().min(0).max(3),
    attemptNo: z.number().int().min(1).max(2),
    timeMs: z.number().int().min(0).max(4 * 3600 * 1000),
    flagged: z.boolean(),
    clientId: z.string().uuid(),
    answeredAt: z.string().datetime({ offset: true }),
  })
  .strict()

/** Bentuk jawaban per tipe, dibatasi ukurannya. */
function validAnswer(item: Item, answer: unknown): boolean {
  if (answer === null || answer === undefined) return true
  const json = JSON.stringify(answer)
  if (json.length > 20000) return false
  const a = answer as Record<string, unknown>
  const isInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= -1 && v < 100
  switch (item.type) {
    case 'mcq':
      return isInt(a.choice)
    case 'multi':
      return Array.isArray(a.choices) && a.choices.length <= 6 && a.choices.every(isInt)
    case 'numeric':
      return typeof a.value === 'string' && a.value.length <= 40
    case 'text':
      return Array.isArray(a.texts) && a.texts.length <= 5 && a.texts.every((t) => typeof t === 'string' && t.length <= 120)
    case 'order':
      return Array.isArray(a.order) && a.order.length <= 8 && a.order.every(isInt)
    case 'match':
      return Array.isArray(a.pairs) && a.pairs.length <= 6 && a.pairs.every(isInt)
    case 'sort':
      return Array.isArray(a.groups) && a.groups.length <= 10 && a.groups.every(isInt)
    case 'numberline':
      return typeof a.position === 'number' && Number.isFinite(a.position)
    case 'clock':
      return isInt(a.h) && isInt(a.m)
    case 'fraction':
      return isInt(a.shaded)
    case 'write':
      return typeof a.text === 'string' && a.text.length <= 8000
    case 'speak':
    case 'draw':
      return typeof a.mediaId === 'string' && z.string().uuid().safeParse(a.mediaId).success
  }
}

export async function saveAnswer(tx: Tx, ctx: OrgContext, learnerId: string, p: AnswerPayload): Promise<AnswerResult> {
  const dup = await tx.select({ status: response.status, xp: response.xp, attemptId: response.attemptId }).from(response).where(eq(response.clientId, p.clientId)).limit(1)
  if (dup[0]) {
    const a = await loadAttempt(tx, learnerId, dup[0].attemptId)
    return { status: HIDDEN_MODES.has(a.mode) ? 'answered' : dup[0].status, xp: dup[0].xp }
  }
  const a = await loadAttempt(tx, learnerId, p.attemptId)
  if (a.status !== 'in_progress') return { status: 'answered', xp: 0 }
  if (a.timeLimitS) {
    if (!a.openedAt) {
      // Jawaban pertama datang sebelum runner tercatat dibuka (halaman offline): perkirakan awal jam
      // dari waktu jawaban dikurangi lama mengerjakan soal itu, tidak lebih awal dari attempt dibuat.
      const guess = new Date(Math.max(a.startedAt.getTime(), Math.min(Date.now(), Date.parse(p.answeredAt)) - p.timeMs))
      const [o] = await tx.update(attempt).set({ openedAt: guess }).where(and(eq(attempt.id, a.id), isNull(attempt.openedAt))).returning({ openedAt: attempt.openedAt })
      a.openedAt = o?.openedAt ?? guess
    }
    const deadline = clockStart(a).getTime() + (a.timeLimitS + 30) * 1000
    if (Date.parse(p.answeredAt) > deadline || Date.now() > deadline + 10 * 60 * 1000) return { status: 'answered', xp: 0 }
  }
  const slot = ((a.items as AttemptItem[]) ?? []).find((i) => i.position === p.position)
  if (!slot) throw invalid('Nomor soal tidak ada di attempt ini.')
  const item = (await resolveItems(tx, [slot.ref])).get(slot.ref)
  if (!item) throw notFound('Soal tidak ditemukan.')
  // Mode tanpa umpan balik: perangkat mengirim label rahasia, basis data menyimpan indeks asli.
  const answer = answerFromLabels(item, p.answer, HIDDEN_MODES.has(a.mode) ? labelPerm(a.id, slot.ref, labelCount(item)) : null) as AnswerPayload['answer']
  if (!validAnswer(item, answer)) throw invalid('Bentuk jawaban tidak sesuai soal.')
  if ((item.type === 'speak' || item.type === 'draw') && answer) {
    const mediaId = (answer as { mediaId: string }).mediaId
    const m = await tx.select({ id: media.id }).from(media).where(and(eq(media.id, mediaId), eq(media.learnerId, learnerId))).limit(1)
    if (!m[0]) throw invalid('Rekaman atau gambar tidak ditemukan.')
  }
  const check = checkAnswer(keyOf(item), answer)
  const date = jakartaDate()
  const base = {
    orgId: ctx.orgId,
    attemptId: a.id,
    learnerId,
    position: p.position,
    itemRef: slot.ref,
    skillId: item.skill,
    subject: a.subject,
    itemType: item.type,
    difficulty: item.difficulty,
    answer: answer ?? null,
    status: check.status,
    score: check.score,
    maxScore: 1,
    hintsUsed: p.hintsUsed,
    timeMs: p.timeMs,
    flagged: p.flagged,
    clientId: p.clientId,
    answeredAt: new Date(p.answeredAt),
    mediaId: item.type === 'speak' || item.type === 'draw' ? ((answer as { mediaId?: string } | null)?.mediaId ?? null) : null,
  }
  if (HIDDEN_MODES.has(a.mode)) {
    // Tes: jawaban boleh diganti sampai dikumpulkan; mesin belajar diperbarui saat kumpul.
    await tx
      .insert(response)
      .values({ ...base, attemptNo: 1 })
      .onConflictDoUpdate({
        target: [response.attemptId, response.position, response.attemptNo],
        set: { answer: base.answer, status: base.status, score: base.score, flagged: base.flagged, clientId: base.clientId, answeredAt: base.answeredAt, timeMs: base.timeMs, mediaId: base.mediaId },
      })
    return { status: 'answered', xp: 0 }
  }
  const inserted = await tx
    .insert(response)
    .values({ ...base, attemptNo: p.attemptNo })
    .onConflictDoNothing()
    .returning({ id: response.id })
  if (!inserted[0]) return { status: check.status, xp: 0 }
  let xp = 0
  if (check.status === 'correct' || check.status === 'wrong') {
    const learner = await loadLearner(tx, learnerId)
    xp = await applyOutcome(tx, ctx, {
      learner,
      item,
      ref: slot.ref,
      correct: check.status === 'correct',
      hintsUsed: p.hintsUsed,
      attemptNo: p.attemptNo,
      timeMs: p.timeMs,
      mode: a.mode,
      date,
      attemptId: a.id,
    })
    if (xp > 0) await tx.update(response).set({ xp }).where(eq(response.id, inserted[0].id))
  }
  return { status: check.status, xp }
}

type Topic = { label: string; right: number; total: number }

export async function submitAttempt(tx: Tx, ctx: OrgContext, learnerId: string, attemptId: string): Promise<{ redirectTo: string }> {
  const a = await loadAttempt(tx, learnerId, attemptId)
  const redirectTo = `/results/${a.id}`
  if (a.status !== 'in_progress') return { redirectTo }
  const learner = await loadLearner(tx, learnerId)
  const date = jakartaDate()
  const items = (a.items as AttemptItem[]) ?? []
  const resolved = await resolveItems(tx, items.map((i) => i.ref))
  const resp = await tx.select().from(response).where(eq(response.attemptId, a.id))
  const latest = latestByPosition(resp)
  let xp = 0

  if (HIDDEN_MODES.has(a.mode)) {
    for (const it of items) {
      const r = latest.get(it.position)
      const item = resolved.get(it.ref)
      if (!r || !item || (r.status !== 'correct' && r.status !== 'wrong')) continue
      const gained = await applyOutcome(tx, ctx, { learner, item, ref: it.ref, correct: r.status === 'correct', hintsUsed: 0, attemptNo: 1, timeMs: r.timeMs, mode: a.mode, date, attemptId: a.id })
      if (gained > 0) await tx.update(response).set({ xp: gained }).where(eq(response.id, r.id))
      xp += gained
    }
  } else {
    xp += resp.reduce((s, r) => s + r.xp, 0)
  }

  // Skor: posisi benar bila jawaban terakhirnya benar.
  let correct = 0
  let pending = 0
  let firstTryAll = true
  const byTopic = new Map<string, Topic>()
  for (const it of items) {
    const r = latest.get(it.position)
    const item = resolved.get(it.ref)
    const label = item ? (skill(item.skill)?.title ?? item.skill) : 'Other'
    const t = byTopic.get(label) ?? { label, right: 0, total: 0 }
    t.total++
    if (r?.status === 'correct') {
      correct++
      t.right++
      if (r.attemptNo > 1 || r.hintsUsed > 0) firstTryAll = false
    } else {
      firstTryAll = false
      if (r?.status === 'pending') pending++
    }
    byTopic.set(label, t)
  }
  const total = items.length
  const elapsed = Math.max(1, Math.floor((Date.now() - clockStart(a).getTime()) / 1000))
  const timeUsed = a.timeLimitS ? Math.min(elapsed, a.timeLimitS) : elapsed

  let scoreRaw: number = correct
  let scoreMax: number = total
  let scaled: number | null = null
  const p = presetForAttempt(a)
  if (p) {
    const s = scoreWithPreset(
      effectiveRules(p, items.length),
      items.map((it) => {
        const st = latest.get(it.position)?.status
        return { position: it.position, status: st === 'correct' ? 'correct' : st === 'wrong' ? 'wrong' : 'blank' }
      }),
    )
    scoreRaw = s.raw
    scoreMax = s.max
    scaled = s.scaled
  }

  const olympiad = items.some((it) => resolved.get(it.ref)?.tags.includes('olympiad'))
  const perfect = total > 0 && correct === total && firstTryAll
  const topics = [...byTopic.values()]
  const result = { perfect, olympiad, byTopic: topics, timeUsedSec: timeUsed, pending }

  if (a.kind === 'quest') {
    const q = (await tx.select().from(quest).where(eq(quest.attemptId, a.id)).limit(1))[0]
    if (q && q.status !== 'done') {
      await tx.update(quest).set({ status: 'done', completedAt: new Date() }).where(eq(quest.id, q.id))
      const bonusXp = questCompletionXp({ bonus: q.kind === 'bonus', perfect })
      await grantXp(tx, ctx, learnerId, bonusXp, q.kind === 'bonus' ? 'bonus-quest' : 'quest', a.id, date)
      xp += bonusXp
      await refreshDayRecord(tx, ctx, learnerId, q.date)
    }
  } else if (a.kind === 'simulation' || a.kind === 'esmo-mock' || a.kind === 'esmo-pack' || a.kind === 'review' || a.kind === 'paper' || a.kind === 'test') {
    const done = a.kind === 'review' ? 10 : 20
    await grantXp(tx, ctx, learnerId, done, `${a.kind}-done`, a.id, date)
    xp += done
  }
  if (a.kind === 'lesson' && items[0]) {
    const skillId = resolved.get(items[0].ref)?.skill
    if (skillId) await tx.update(skillState).set({ lessonDoneAt: new Date() }).where(and(eq(skillState.learnerId, learnerId), eq(skillState.skillId, skillId)))
  }

  const newBadges = await awardBadges(tx, ctx, learner, date)
  await tx
    .update(attempt)
    .set({
      status: pending > 0 ? 'needs_grading' : 'submitted',
      submittedAt: new Date(),
      elapsedS: timeUsed,
      scoreRaw,
      scoreMax,
      scoreScaled: scaled,
      xp,
      result: { ...result, newBadges },
    })
    .where(eq(attempt.id, a.id))
  return { redirectTo }
}

/** Jawaban yang menunggu dinilai (untuk konsol). */
export async function pendingResponses(tx: Tx, attemptIds: string[]) {
  if (attemptIds.length === 0) return []
  return tx.select().from(response).where(and(inArray(response.attemptId, attemptIds), eq(response.status, 'pending')))
}
