import 'server-only'
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm'
import { jakartaDate } from '@kira/core/time'
import { tables } from '@kira/db'
import type { Tx } from '../db'
import { NOTICE_VERSION } from '../auth/accounts'
import { skillTitle } from './console-common'
import { loadLearner } from './learner-core'

/**
 * Salinan lengkap data satu learner sebagai JSON: profil, riwayat persetujuan, permintaan hapus,
 * status skill, attempt beserta jawaban (ref soal, jawaban, skor, waktu), kartu review, catatan,
 * laporan mingguan, XP, lencana, catatan harian, dan metadata media (tanpa berkasnya).
 *
 * Dipakai dua tempat:
 * - halaman Privasi keluarga (hak akses orang tua): nama asli dan nama orang dewasa ikut;
 * - Laporan konsol, ekspor untuk Claude: `pseudonym` mengganti nama learner di semua teks,
 *   nama dan email orang dewasa diganti peran, dan bukti persetujuan tertulis tidak ikut.
 *
 * Jawaban dan skor attempt mode Tes, Simulasi, dan Kertas yang belum dikumpulkan tidak ikut
 * (status benar atau salah sama dengan membocorkan kunci jawaban sebelum dikumpulkan).
 */

const { consentEvent, deletionRequest, skillState, attempt, response, reviewCard, note, weekReport, xpEvent, badgeAward, dayRecord, media, memberProfile, arenaSession, arenaState, dailyChest } = tables

export const EXPORT_PSEUDONYM = 'learner_1'
const HIDDEN_MODES = new Set(['tes', 'simulasi', 'kertas'])

/** Nama berkas: kira-data-<nama>-<tanggal>.json, nama tanpa spasi dan aksen. */
export function exportFilename(name: string, date: string): string {
  const slug =
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'learner'
  return `kira-data-${slug}-${date}.json`
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Ganti nama (utuh, tanpa beda huruf besar kecil) dengan nama samaran di semua string. */
export function pseudonymize<T>(value: T, name: string, pseudonym: string): T {
  const clean = name.trim()
  if (!clean) return value
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(clean)}(?![\\p{L}\\p{N}])`, 'giu')
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return v.replace(re, pseudonym)
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object' && !(v instanceof Date)) return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]))
    return v
  }
  return walk(value) as T
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

export type LearnerExport = { filename: string; json: string; learnerName: string }

export async function learnerExport(tx: Tx, learnerId: string, opts: { pseudonym?: string; now?: Date } = {}): Promise<LearnerExport> {
  const learner = await loadLearner(tx, learnerId)
  const now = opts.now ?? new Date()
  const pseudo = opts.pseudonym ?? null

  const members = await tx.select({ id: memberProfile.userId, name: memberProfile.name, role: memberProfile.role }).from(memberProfile)
  const who = (id: string | null): string => {
    if (!id) return 'sistem'
    const m = members.find((x) => x.id === id)
    if (!m) return 'sistem'
    if (pseudo) return m.role === 'guardian' ? 'orang tua' : 'tutor'
    return `${m.name} (${m.role === 'guardian' ? 'orang tua' : 'tutor'})`
  }

  const consents = await tx
    .select({
      purpose: consentEvent.purpose,
      granted: consentEvent.granted,
      method: consentEvent.method,
      noticeVersion: consentEvent.noticeVersion,
      evidence: consentEvent.evidence,
      recordedBy: consentEvent.recordedBy,
      guardianId: consentEvent.guardianId,
      createdAt: consentEvent.createdAt,
    })
    .from(consentEvent)
    .where(eq(consentEvent.learnerId, learnerId))
    .orderBy(asc(consentEvent.createdAt))
  const deletions = await tx
    .select({ reference: deletionRequest.reference, scheduledFor: deletionRequest.scheduledFor, createdAt: deletionRequest.createdAt, cancelledAt: deletionRequest.cancelledAt, executedAt: deletionRequest.executedAt })
    .from(deletionRequest)
    .where(eq(deletionRequest.learnerId, learnerId))
    .orderBy(asc(deletionRequest.createdAt))
  const skills = await tx
    .select({
      skillId: skillState.skillId,
      theta: skillState.theta,
      answers: skillState.nAnswers,
      recent: skillState.recent,
      gate: skillState.gate,
      stars: skillState.stars,
      lastPracticed: skillState.lastPracticed,
      lessonDoneAt: skillState.lessonDoneAt,
      updatedAt: skillState.updatedAt,
    })
    .from(skillState)
    .where(eq(skillState.learnerId, learnerId))
    .orderBy(asc(skillState.skillId))
  const attempts = await tx
    .select({
      id: attempt.id,
      kind: attempt.kind,
      mode: attempt.mode,
      subject: attempt.subject,
      title: attempt.title,
      refId: attempt.refId,
      code: attempt.code,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      timeLimitS: attempt.timeLimitS,
      elapsedS: attempt.elapsedS,
      scoreRaw: attempt.scoreRaw,
      scoreMax: attempt.scoreMax,
      scoreScaled: attempt.scoreScaled,
      xp: attempt.xp,
    })
    .from(attempt)
    .where(eq(attempt.learnerId, learnerId))
    .orderBy(asc(attempt.startedAt))
  const responses = attempts.length
    ? await tx
        .select({
          attemptId: response.attemptId,
          position: response.position,
          attemptNo: response.attemptNo,
          itemRef: response.itemRef,
          skillId: response.skillId,
          itemType: response.itemType,
          difficulty: response.difficulty,
          answer: response.answer,
          status: response.status,
          score: response.score,
          maxScore: response.maxScore,
          hintsUsed: response.hintsUsed,
          timeMs: response.timeMs,
          flagged: response.flagged,
          xp: response.xp,
          answeredAt: response.answeredAt,
          gradedAt: response.gradedAt,
          rubricScores: response.rubricScores,
          feedback: response.feedback,
          mediaId: response.mediaId,
        })
        .from(response)
        .where(inArray(response.attemptId, attempts.map((a) => a.id)))
        .orderBy(asc(response.answeredAt), asc(response.position), asc(response.attemptNo))
    : []
  const cards = await tx
    .select({ itemRef: reviewCard.itemRef, skillId: reviewCard.skillId, subject: reviewCard.subject, card: reviewCard.card, dueAt: reviewCard.dueAt, retired: reviewCard.retired, createdAt: reviewCard.createdAt })
    .from(reviewCard)
    .where(eq(reviewCard.learnerId, learnerId))
    .orderBy(asc(reviewCard.createdAt))
  const notes = await tx
    .select({ authorId: note.authorId, body: note.body, createdAt: note.createdAt })
    .from(note)
    .where(eq(note.learnerId, learnerId))
    .orderBy(asc(note.createdAt))
  const reports = await tx
    .select({ weekStart: weekReport.weekStart, note: weekReport.note, sentAt: weekReport.sentAt })
    .from(weekReport)
    .where(eq(weekReport.learnerId, learnerId))
    .orderBy(asc(weekReport.weekStart))
  const xp = await tx
    .select({ date: xpEvent.date, amount: xpEvent.amount, reason: xpEvent.reason, track: xpEvent.track })
    .from(xpEvent)
    .where(eq(xpEvent.learnerId, learnerId))
    .orderBy(asc(xpEvent.id))
  const arena = await tx
    .select({ arena: arenaSession.arena, mode: arenaSession.mode, topic: arenaSession.topic, date: arenaSession.date, finishedAt: arenaSession.finishedAt, answered: arenaSession.answered, correct: arenaSession.correct, durationMs: arenaSession.durationMs, xp: arenaSession.xp })
    .from(arenaSession)
    .where(and(eq(arenaSession.learnerId, learnerId), isNotNull(arenaSession.finishedAt)))
    .orderBy(asc(arenaSession.startedAt))
  const arenaProgress = await tx.select({ arena: arenaState.arena, data: arenaState.data, updatedAt: arenaState.updatedAt }).from(arenaState).where(eq(arenaState.learnerId, learnerId))
  const chests = await tx
    .select({ date: dailyChest.date, rewardKind: dailyChest.rewardKind, rewardId: dailyChest.rewardId, openedAt: dailyChest.openedAt })
    .from(dailyChest)
    .where(eq(dailyChest.learnerId, learnerId))
    .orderBy(asc(dailyChest.date))
  const badges = await tx
    .select({ badgeId: badgeAward.badgeId, awardedAt: badgeAward.awardedAt })
    .from(badgeAward)
    .where(eq(badgeAward.learnerId, learnerId))
    .orderBy(asc(badgeAward.awardedAt))
  const days = await tx
    .select({ date: dayRecord.date, minutes: dayRecord.minutes, questsDone: dayRecord.questsDone, questsRequired: dayRecord.questsRequired, rest: dayRecord.rest })
    .from(dayRecord)
    .where(eq(dayRecord.learnerId, learnerId))
    .orderBy(asc(dayRecord.date))
  const files = await tx
    .select({ id: media.id, kind: media.kind, mime: media.mime, size: media.size, createdAt: media.createdAt, expiresAt: media.expiresAt, deletedAt: media.deletedAt })
    .from(media)
    .where(eq(media.learnerId, learnerId))
    .orderBy(asc(media.createdAt))

  const hiddenOpen = new Set(attempts.filter((a) => a.status === 'in_progress' && HIDDEN_MODES.has(a.mode)).map((a) => a.id))

  const data = {
    format: 'kira.learner-export',
    version: 1,
    exportedAt: now.toISOString(),
    noticeVersion: NOTICE_VERSION,
    notes: 'Waktu dalam UTC (ISO 8601). Tanggal belajar dalam WIB (YYYY-MM-DD). Berkas rekaman dan foto tidak ikut, hanya metadatanya.',
    learner: {
      name: learner.name,
      grade: learner.grade,
      avatar: learner.avatar,
      active: learner.active,
      startedOn: learner.startedOn,
      createdAt: iso(learner.createdAt),
      xp: learner.xp,
      limits: { screenLimitMin: learner.screenLimitMin, restWeekdays: learner.restWeekdays, reviewEnabled: learner.reviewEnabled },
    },
    consents: consents.map((c) => ({
      purpose: c.purpose,
      granted: c.granted,
      method: c.method,
      noticeVersion: c.noticeVersion,
      at: iso(c.createdAt),
      recordedBy: who(c.recordedBy),
      guardian: c.guardianId ? who(c.guardianId) : null,
      evidence: pseudo ? null : c.evidence,
    })),
    deletionRequests: deletions.map((d) => ({ reference: d.reference, scheduledFor: d.scheduledFor, requestedAt: iso(d.createdAt), cancelledAt: iso(d.cancelledAt), executedAt: iso(d.executedAt) })),
    skills: skills.map((s) => ({
      skillId: s.skillId,
      title: skillTitle(s.skillId),
      theta: Math.round(s.theta * 1000) / 1000,
      answers: s.answers,
      recentScores: s.recent,
      gate: s.gate,
      stars: s.stars,
      lastPracticed: s.lastPracticed,
      lessonDoneAt: iso(s.lessonDoneAt),
      updatedAt: iso(s.updatedAt),
    })),
    attempts: attempts.map((a) => {
      const hidden = hiddenOpen.has(a.id)
      return {
        kind: a.kind,
        mode: a.mode,
        subject: a.subject,
        title: a.title,
        ref: a.refId,
        code: a.code,
        status: a.status,
        startedAt: iso(a.startedAt),
        submittedAt: iso(a.submittedAt),
        timeLimitS: a.timeLimitS,
        elapsedS: a.elapsedS,
        score: hidden ? null : { raw: a.scoreRaw, max: a.scoreMax, scaled: a.scoreScaled },
        xp: a.xp,
        responses: hidden
          ? []
          : responses
              .filter((r) => r.attemptId === a.id)
              .map((r) => ({
                position: r.position,
                attemptNo: r.attemptNo,
                itemRef: r.itemRef,
                skillId: r.skillId,
                itemType: r.itemType,
                difficulty: r.difficulty,
                answer: r.answer,
                status: r.status,
                score: r.score,
                maxScore: r.maxScore,
                hintsUsed: r.hintsUsed,
                timeMs: r.timeMs,
                flagged: r.flagged,
                xp: r.xp,
                answeredAt: iso(r.answeredAt),
                gradedAt: iso(r.gradedAt),
                rubricScores: r.rubricScores,
                feedback: r.feedback,
                mediaId: r.mediaId,
              })),
        ...(hidden ? { hiddenNote: 'Jawaban belum dikumpulkan, jadi belum ikut di salinan ini.' } : {}),
      }
    }),
    reviewCards: cards.map((c) => ({ itemRef: c.itemRef, skillId: c.skillId, subject: c.subject, dueAt: iso(c.dueAt), retired: c.retired, createdAt: iso(c.createdAt), card: c.card })),
    tutorNotes: notes.map((n) => ({ at: iso(n.createdAt), author: who(n.authorId), body: n.body })),
    weekReports: reports.map((r) => ({ weekStart: r.weekStart, note: r.note, sentAt: iso(r.sentAt) })),
    xpEvents: xp,
    arenaRounds: arena.map((a) => ({ ...a, finishedAt: iso(a.finishedAt) })),
    arenaProgress: arenaProgress.map((a) => ({ arena: a.arena, data: a.data, updatedAt: iso(a.updatedAt) })),
    dailyChests: chests.map((c) => ({ date: c.date, rewardKind: c.rewardKind, rewardId: c.rewardId, openedAt: iso(c.openedAt) })),
    badges: badges.map((b) => ({ badgeId: b.badgeId, awardedAt: iso(b.awardedAt) })),
    dayRecords: days,
    media: files.map((f) => ({ id: f.id, kind: f.kind, mime: f.mime, size: f.size, createdAt: iso(f.createdAt), expiresAt: iso(f.expiresAt), deletedAt: iso(f.deletedAt) })),
  }

  const out = pseudo ? pseudonymize(data, learner.name, pseudo) : data
  const shownName = pseudo ?? learner.name
  return { filename: exportFilename(shownName, jakartaDate(now)), json: JSON.stringify(out, null, 2), learnerName: learner.name }
}
