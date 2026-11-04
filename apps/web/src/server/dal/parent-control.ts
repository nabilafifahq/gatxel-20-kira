import 'server-only'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { jakartaDate } from '@kira/core'
import { tables } from '@kira/db'
import type { AvatarName, DayPresetId, DayRulesDTO, PlanChangeResult, PinPicture, Subject } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { createLearnerAccount } from '../auth/accounts'
import { withFamilyAdmin, type ParentScope } from '../auth/parent'
import { auditTx } from '../audit'
import { env } from '../env'
import { conflict, invalid, notFound } from '../errors'
import type { Tx } from '../db'
import { rubricCriteriaOf } from './console-inbox-parent'
import { gradeResponseTx } from './console-inbox'
import { assertNameFree, resetPin, unlockLearner, updateLearner } from './console-learners'
import { resetStreakTx, saveDayRulesTx } from './console-day-rules'
import { plannerDTO, removeSession, setSessionRequired, upsertSlot } from './console-planner'
import { updateLearnerLimitsTx } from './console-settings'
import { updateLearnerSoundTx } from './learner-motion'
import { resolveItems } from './content'

/**
 * Aksi orang tua atas anaknya. Setiap fungsi memeriksa guardian_link lebih dulu (`ownChild`), lalu memakai
 * logika yang sama dengan konsol tutor. Tulisan yang memang hanya boleh staf dibungkus `scope.elevate`, yang
 * menaikkan peran hanya selama panggilan itu. Setiap aksi dicatat di audit_log sebagai orang tua.
 */

const { learnerProfile, guardianLink, response } = tables

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

export async function parentResetStreak(actor: Actor, input: { learnerId: string; confirmName: string }) {
  return ownChild(actor, input.learnerId, 'streak.reset', {}, (tx, scope) => scope.elevate(() => resetStreakTx(tx, scope.ctx, input)))
}

export async function parentSetSessionRequired(actor: Actor, input: { learnerId: string; subject: Subject; session: 'latihan' | 'tes' | 'paper'; required: boolean }): Promise<PlanChangeResult> {
  await ownChild(actor, input.learnerId, 'session.required', { subject: input.subject, session: input.session, required: input.required }, async () => undefined)
  return setSessionRequired(asStaff(actor), { learnerId: input.learnerId, date: jakartaDate(), slotId: null, subject: input.subject, session: input.session, required: input.required })
}

export async function parentRemoveSession(actor: Actor, input: { learnerId: string; subject: Subject; session: 'latihan' | 'tes' | 'paper' }): Promise<PlanChangeResult> {
  await ownChild(actor, input.learnerId, 'session.removed', { subject: input.subject, session: input.session }, async () => undefined)
  return removeSession(asStaff(actor), { learnerId: input.learnerId, date: jakartaDate(), slotId: null, subject: input.subject, session: input.session })
}

const DEFAULT_COUNT = { latihan: 10, tes: 8 } as const

/** Tambah sesi opsional hari ini (paling banyak 10 sesi tambahan; server menolak yang ke-11). */
export async function parentAddOptional(actor: Actor, input: { learnerId: string; subject: Subject; session: 'latihan' | 'tes' | 'paper' }): Promise<PlanChangeResult> {
  await ownChild(actor, input.learnerId, 'session.added', { subject: input.subject, session: input.session }, async () => undefined)
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
export async function parentSetQuestionCount(actor: Actor, input: { learnerId: string; subject: Subject; session: 'latihan' | 'tes'; questionCount: number }): Promise<PlanChangeResult> {
  await ownChild(actor, input.learnerId, 'session.count', { subject: input.subject, session: input.session, count: input.questionCount }, async () => undefined)
  const staff = asStaff(actor)
  const today = jakartaDate()
  const dto = await plannerDTO(staff, input.learnerId, today)
  const slot = dto?.slots.find((s) => s.date === today && s.subject === input.subject && s.session === input.session)
  if (!slot) throw notFound('Sesi ini tidak ada hari ini. Muat ulang halaman.')
  return upsertSlot(staff, {
    learnerId: input.learnerId,
    ...(slot.auto ? { fromAuto: true } : { slotId: slot.id }),
    date: today,
    subject: input.subject,
    session: input.session,
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
 * Tambah anak oleh orang tua sendiri: akun anak dibuat, lalu ditautkan ke orang tua ini. Anak mulai aktif setelah
 * orang tua memberi persetujuan di halaman Privasi. Batas jumlah anak mengikuti KIRA_MAX_LEARNERS.
 */
export async function parentAddChild(actor: Actor, input: { name: string; grade: number; avatar: AvatarName; pin: PinPicture[] }): Promise<{ learnerId: string }> {
  const max = env().KIRA_MAX_LEARNERS
  const name = input.name.trim()
  await withFamilyAdmin(actor, async (tx, scope) => {
    const [n] = await tx.select({ n: sql<number>`count(*)::int` }).from(learnerProfile).where(isNull(learnerProfile.deletedAt))
    if ((n?.n ?? 0) >= max) throw conflict(`Keluarga ini sudah punya ${max} anak, batas untuk saat ini.`)
    await scope.elevate(() => assertNameFree(tx, name, null))
  })
  const learnerId = await createLearnerAccount({ orgId: actor.orgId, userId: actor.userId }, { name, grade: input.grade, avatar: input.avatar, pin: input.pin })
  await withFamilyAdmin(actor, async (tx, scope) => {
    await scope.elevate(async () => {
      await tx.insert(guardianLink).values({ orgId: actor.orgId, guardianId: actor.userId, learnerId }).onConflictDoNothing()
    })
    await auditTx(tx, scope.ctx, 'parent.child.added', learnerId, { grade: input.grade })
  })
  return { learnerId }
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
