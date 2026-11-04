import 'server-only'
import { and, eq, isNull } from 'drizzle-orm'
import { jakartaDate, type SessionType } from '@kira/core'
import { tables } from '@kira/db'
import type { AvatarName, DayPresetId, DayRulesDTO, PlanChangeResult, PinPicture, Subject } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { withFamilyAdmin, type ParentScope } from '../auth/parent'
import { auditTx } from '../audit'
import { conflict, invalid, notFound } from '../errors'
import type { Tx } from '../db'
import { addChild } from './onboarding'
import { rubricCriteriaOf } from './console-inbox-parent'
import { gradeResponseTx } from './console-inbox'
import { resetPin, unlockLearner, updateLearner } from './console-learners'
import { resetStreakTx, saveDayRulesTx } from './console-day-rules'
import { plannerDTO, removeSession, setSessionRequired, upsertSlot } from './console-planner'
import { updateLearnerLimitsTx } from './console-settings'
import { updateLearnerSoundTx } from './learner-motion'
import { resolveItems } from './content'
import { featureMapFor, saveFeaturesTx } from './learner-features'
import { sessionAllowed, type FeatureMap } from '@kira/core/features'

/**
 * Aksi orang tua atas anaknya. Setiap fungsi memeriksa guardian_link lebih dulu (`ownChild`), lalu memakai
 * logika yang sama dengan konsol tutor. Tulisan yang memang hanya boleh staf dibungkus `scope.elevate`, yang
 * menaikkan peran hanya selama panggilan itu. Setiap aksi dicatat di audit_log sebagai orang tua.
 */

const { learnerProfile, response, quest } = tables

const CORE: readonly SessionType[] = ['latihan', 'tes', 'paper']

/** Periksa tautan orang tua ke anak ini, jalankan fn, lalu catat aksinya. */
async function ownChild<T>(actor: Actor, learnerId: string, action: string, meta: Record<string, unknown>, fn: (tx: Tx, scope: ParentScope) => Promise<T>): Promise<T> {
  return withFamilyAdmin(actor, async (tx, scope) => {
    await scope.assertParentOf(learnerId)
    const out = await fn(tx, scope)
    await auditTx(tx, scope.ctx, `parent.${action}`, learnerId, meta)
    return out
  })
}

/** Peran tutor hanya untuk memanggil fungsi konsol atas nama keluarga; anak sudah diperiksa `ownChild`. */
const asStaff = (actor: Actor): Actor => ({ ...actor, role: 'tutor' })

export async function parentSaveDayRules(actor: Actor, input: { learnerId: string; preset: DayPresetId; rules: DayRulesDTO | null }): Promise<PlanChangeResult> {
  return ownChild(actor, input.learnerId, 'dayrules', { preset: input.preset }, (tx, scope) => scope.elevate(() => saveDayRulesTx(tx, scope.ctx, input)))
}

export async function parentSaveFeatures(actor: Actor, input: { learnerId: string; features: FeatureMap }): Promise<PlanChangeResult> {
  return ownChild(actor, input.learnerId, 'features', {}, (tx, scope) => scope.elevate(() => saveFeaturesTx(tx, scope.ctx, input.learnerId, input.features)))
}

export async function parentResetStreak(actor: Actor, input: { learnerId: string; confirmName: string }) {
  return ownChild(actor, input.learnerId, 'streak.reset', {}, (tx, scope) => scope.elevate(() => resetStreakTx(tx, scope.ctx, input)))
}

/** Sesi hari ini yang dituju: dicari dari id sesi (quest), dan hanya bila anaknya tertaut ke orang tua ini. */
async function targetOf(actor: Actor, questId: string): Promise<{ learnerId: string; slotId: string | null; subject: Subject; session: SessionType }> {
  return withFamilyAdmin(actor, async (tx, scope) => {
    const [q] = await tx
      .select({ learnerId: quest.learnerId, slotId: quest.planSlotId, subject: quest.subject, session: quest.session, date: quest.date })
      .from(quest)
      .where(eq(quest.id, questId))
      .limit(1)
    if (!q) throw notFound('Sesi ini tidak ditemukan. Muat ulang halaman.')
    await scope.assertParentOf(q.learnerId)
    if (q.date !== jakartaDate()) throw conflict('Sesi ini bukan sesi hari ini. Muat ulang halaman.')
    if (!CORE.includes(q.session as SessionType)) throw invalid('Hanya Latihan, Tes, dan Paper yang bisa diatur dari sini.')
    return { learnerId: q.learnerId, slotId: q.slotId, subject: q.subject as Subject, session: q.session as SessionType }
  })
}

export async function parentSetSessionRequired(actor: Actor, input: { questId: string; required: boolean }): Promise<PlanChangeResult> {
  const t = await targetOf(actor, input.questId)
  await ownChild(actor, t.learnerId, 'session.required', { subject: t.subject, session: t.session, required: input.required }, async () => undefined)
  return setSessionRequired(asStaff(actor), { learnerId: t.learnerId, date: jakartaDate(), slotId: t.slotId, subject: t.subject, session: t.session, required: input.required })
}

export async function parentRemoveSession(actor: Actor, input: { questId: string }): Promise<PlanChangeResult> {
  const t = await targetOf(actor, input.questId)
  await ownChild(actor, t.learnerId, 'session.removed', { subject: t.subject, session: t.session }, async () => undefined)
  return removeSession(asStaff(actor), { learnerId: t.learnerId, date: jakartaDate(), slotId: t.slotId, subject: t.subject, session: t.session })
}

const DEFAULT_COUNT = { latihan: 10, tes: 8 } as const

/** Tambah sesi opsional hari ini (paling banyak 10 sesi tambahan; server menolak yang ke-11). */
export async function parentAddOptional(actor: Actor, input: { learnerId: string; subject: Subject; session: 'latihan' | 'tes' | 'paper' }): Promise<PlanChangeResult> {
  await ownChild(actor, input.learnerId, 'session.added', { subject: input.subject, session: input.session }, async (tx) => {
    if (!sessionAllowed(await featureMapFor(tx, input.learnerId), input.subject, input.session)) throw conflict('Mapel atau jenis sesi ini sedang dimatikan untuk anak ini. Nyalakan dulu di Pengaturan.')
  })
  return upsertSlot(asStaff(actor), {
    learnerId: input.learnerId,
    date: jakartaDate(),
    subject: input.subject,
    session: input.session,
    required: false,
    skillId: null,
    mode: input.session === 'tes' ? 'tes' : 'latihan',
    questionCount: input.session === 'paper' ? 10 : DEFAULT_COUNT[input.session],
    paperKind: input.session === 'paper' ? 'mini' : null,
    config: null,
  })
}

/** Ubah jumlah soal sesi hari ini yang belum dimulai. Sesi yang sudah dimulai ditolak server dengan pesan jelas. */
export async function parentSetQuestionCount(actor: Actor, input: { questId: string; questionCount: number }): Promise<PlanChangeResult> {
  const t = await targetOf(actor, input.questId)
  if (t.session === 'paper') throw invalid('Jumlah soal hanya bisa diubah untuk Latihan dan Tes.')
  await ownChild(actor, t.learnerId, 'session.count', { subject: t.subject, session: t.session, count: input.questionCount }, async () => undefined)
  const staff = asStaff(actor)
  const today = jakartaDate()
  const dto = await plannerDTO(staff, t.learnerId, today)
  const slot = dto?.slots.find((s) => s.date === today && (t.slotId ? s.id === t.slotId : s.auto && s.subject === t.subject && s.session === t.session))
  if (!slot) throw notFound('Sesi ini tidak ada hari ini. Muat ulang halaman.')
  return upsertSlot(staff, {
    learnerId: t.learnerId,
    ...(slot.auto ? { fromAuto: true } : { slotId: slot.id }),
    date: today,
    subject: t.subject,
    session: t.session,
    required: slot.required,
    skillId: slot.skillId,
    mode: slot.mode === 'tes' ? 'tes' : 'latihan',
    questionCount: input.questionCount,
    paperKind: null,
    config: slot.config,
  })
}

export async function parentSaveLimits(actor: Actor, input: { learnerId: string; screenLimitMin: number; restWeekdays: number[] }): Promise<void> {
  await ownChild(actor, input.learnerId, 'limits', { screenLimitMin: input.screenLimitMin }, async (tx, scope) => {
    const [l] = await tx.select({ review: learnerProfile.reviewEnabled }).from(learnerProfile).where(and(eq(learnerProfile.userId, input.learnerId), isNull(learnerProfile.deletedAt))).limit(1)
    if (!l) throw notFound('Anak tidak ditemukan. Muat ulang halaman.')
    await scope.elevate(() => updateLearnerLimitsTx(tx, scope.ctx, { ...input, reviewEnabled: l.review }))
  })
}

export async function parentSaveSound(actor: Actor, input: { learnerId: string; soundEnabled: boolean; musicEnabled: boolean }): Promise<void> {
  await ownChild(actor, input.learnerId, 'sound', { sound: input.soundEnabled, music: input.musicEnabled }, (tx, scope) => scope.elevate(() => updateLearnerSoundTx(tx, input.learnerId, input)))
}

export async function parentResetPin(actor: Actor, input: { learnerId: string; pin: PinPicture[] }): Promise<void> {
  await ownChild(actor, input.learnerId, 'pin.reset', {}, async () => undefined)
  await resetPin(asStaff(actor), input)
}

export async function parentUnlock(actor: Actor, learnerId: string): Promise<void> {
  await ownChild(actor, learnerId, 'pin.unlock', {}, async () => undefined)
  await unlockLearner(asStaff(actor), learnerId)
}

export async function parentEditChild(actor: Actor, input: { learnerId: string; name: string; grade: number; avatar: AvatarName }): Promise<void> {
  await ownChild(actor, input.learnerId, 'edit', { grade: input.grade }, async () => undefined)
  await updateLearner(asStaff(actor), input)
}

/**
 * Tambah anak oleh orang tua sendiri. Satu implementasi dengan onboarding (/mulai): batas per keluarga
 * KIRA_MAX_LEARNERS_PER_FAMILY, kunci per org, preset Seimbang, dan anak aktif setelah persetujuan di halaman Privasi.
 */
export async function parentAddChild(actor: Actor, input: { name: string; grade: number; avatar: AvatarName; pin: PinPicture[] }): Promise<{ learnerId: string }> {
  return { learnerId: await addChild(actor, input) }
}

/** Orang tua menilai hasil tulis, bicara, gambar, atau foto: Bagus (nilai penuh) atau Coba lagi (nol). Tidak mengubah streak. */
export async function parentMarkWork(actor: Actor, input: { responseId: string; verdict: 'good' | 'again'; feedback: string }): Promise<void> {
  await withFamilyAdmin(actor, async (tx, scope) => {
    const [r] = await tx.select({ learnerId: response.learnerId, ref: response.itemRef }).from(response).where(eq(response.id, input.responseId)).limit(1)
    if (!r) throw notFound('Jawaban ini tidak ditemukan.')
    await scope.assertParentOf(r.learnerId)
    const item = (await resolveItems(tx, [r.ref])).get(r.ref)
    const criteria = rubricCriteriaOf(item)
    if (criteria.length === 0) throw invalid('Soal ini belum punya rubrik, jadi belum bisa dinilai dari sini.')
    const scores = criteria.map((c) => (input.verdict === 'good' ? c.points : 0))
    await scope.elevate(() => gradeResponseTx(tx, scope.ctx, { responseId: input.responseId, scores, feedback: input.feedback, acceptedAi: false }))
    await auditTx(tx, scope.ctx, 'parent.work.marked', r.learnerId, { verdict: input.verdict })
  })
}
