import 'server-only'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { tables } from '@kira/db'
import type { AvatarName, PinPicture } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import { createLearnerAccount } from '../auth/accounts'
import { isFamilyOwner, withFamilyAdmin } from '../auth/parent'
import { auditTx } from '../audit'
import { env } from '../env'
import { conflict, forbidden, invalid } from '../errors'
import { latestConsents, syncLearnerActive, type ConsentPurposeId } from './consent'
import { applyDefaultPreset } from './default-preset'
import { setConsentTx } from './privacy'
import { featureMapFor, saveFeatureMap, saveFeaturesTx } from './learner-features'
import type { FeatureMap } from '@kira/core/features'
import { recommendationFor, type SetupPath } from '@kira/core/recommendation'

const { learnerProfile, guardianLink } = tables

/** Tujuan persetujuan yang ditawarkan saat onboarding. Bantuan AI hanya untuk tutor dan mati selama pilot. */
export const ONBOARDING_PURPOSES = ['learning', 'progress-email', 'audio', 'photo'] as const satisfies readonly ConsentPurposeId[]
export type OnboardingPurpose = (typeof ONBOARDING_PURPOSES)[number]

export type OnboardingChild = { id: string; name: string; grade: number; avatar: AvatarName; active: boolean; consents: Record<OnboardingPurpose, boolean>; features: FeatureMap; setupPath: SetupPath | null }
export type OnboardingState = { parentName: string; children: OnboardingChild[]; max: number }

export async function onboardingState(actor: Actor): Promise<OnboardingState> {
  return withFamilyAdmin(actor, async (tx) => {
    const rows = await tx
      .select({ id: learnerProfile.userId, name: learnerProfile.name, grade: learnerProfile.grade, avatar: learnerProfile.avatar, active: learnerProfile.active, setupPath: learnerProfile.setupPath })
      .from(learnerProfile)
      .innerJoin(guardianLink, eq(guardianLink.learnerId, learnerProfile.userId))
      .where(and(eq(guardianLink.guardianId, actor.userId), isNull(learnerProfile.deletedAt)))
      .orderBy(learnerProfile.createdAt)
    const consents = await latestConsents(tx, rows.map((r) => r.id))
    const features = new Map<string, FeatureMap>()
    for (const r of rows) features.set(r.id, await featureMapFor(tx, r.id))
    return {
      parentName: actor.name,
      max: env().KIRA_MAX_LEARNERS_PER_FAMILY,
      children: rows.map((r) => ({
        id: r.id,
        name: r.name,
        grade: r.grade,
        avatar: r.avatar as AvatarName,
        active: r.active,
        consents: Object.fromEntries(ONBOARDING_PURPOSES.map((p) => [p, consents.get(r.id)?.get(p)?.granted ?? false])) as Record<OnboardingPurpose, boolean>,
        features: features.get(r.id) ?? {},
        setupPath: r.setupPath,
      })),
    }
  })
}

/**
 * Orang tua menambah anak. Batas per keluarga (KIRA_MAX_LEARNERS_PER_FAMILY) dijaga dengan kunci
 * penasihat per org, jadi dua permintaan serentak tidak melewati batas. Anak belum aktif sampai orang tua
 * memberi persetujuan belajar.
 */
export async function addChild(actor: Actor, input: { name: string; grade: number; avatar: AvatarName; pin: PinPicture[] }): Promise<string> {
  const max = env().KIRA_MAX_LEARNERS_PER_FAMILY
  const name = input.name.trim()
  if (!(await isFamilyOwner(actor))) throw forbidden('Hanya pemilik keluarga yang bisa menambah anak dari sini. Minta tutor menambahkan anak.')
  return withFamilyAdmin(actor, async (tx, scope) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`kira-learners:${actor.orgId}`}))`)
    const mine = await tx
      .select({ id: learnerProfile.userId, name: learnerProfile.name })
      .from(learnerProfile)
      .innerJoin(guardianLink, eq(guardianLink.learnerId, learnerProfile.userId))
      .where(and(eq(guardianLink.guardianId, actor.userId), isNull(learnerProfile.deletedAt)))
    if (mine.length >= max) throw conflict(`Satu keluarga bisa punya sampai ${max} anak di Kira. Hapus akun salah satu anak lewat halaman Privasi bila ingin menukar.`)
    if (mine.some((m) => m.name.trim().toLowerCase() === name.toLowerCase())) {
      const msg = `Nama ${name} sudah dipakai anak lain. Pakai nama lain supaya mudah dibedakan di tablet.`
      throw invalid(msg, { name: msg })
    }
    const learnerId = await createLearnerAccount({ orgId: actor.orgId, userId: actor.userId }, { name, grade: input.grade, avatar: input.avatar, pin: input.pin })
    const ctx = orgCtx(actor)
    await scope.elevate(async () => {
      await tx.insert(guardianLink).values({ orgId: actor.orgId, guardianId: actor.userId, learnerId })
      await applyDefaultPreset(tx, ctx, learnerId)
      // Anak baru langsung memakai jalur rekomendasi. Orang tua yang pergi sebelum memilih tetap mendapat isi yang masuk akal.
      await saveFeatureMap(tx, actor.orgId, learnerId, recommendationFor(input.grade).features)
    })
    await auditTx(tx, ctx, 'guardian.linked', learnerId, { guardianId: actor.userId, via: 'onboarding' })
    return learnerId
  })
}

/** Simpan pilihan persetujuan satu anak. Hanya tujuan yang berubah yang dicatat. Mengaktifkan anak bila belajar disetujui. */
export async function saveChildConsents(actor: Actor, input: { learnerId: string; consents: Record<OnboardingPurpose, boolean> }): Promise<{ active: boolean }> {
  const ctx = orgCtx(actor)
  await withFamilyAdmin(actor, async (tx, scope) => {
    await scope.assertParentOf(input.learnerId)
    for (const purpose of ONBOARDING_PURPOSES) {
      await setConsentTx(tx, ctx, { guardianId: actor.userId, learnerId: input.learnerId, purpose, granted: input.consents[purpose] })
    }
  })
  const active = await syncLearnerActive(actor.orgId, input.learnerId)
  return { active }
}

/**
 * Terapkan jalur rekomendasi (`recommended`, sekali ketuk) atau lewati (`skipped`, isinya sama) untuk anak yang disebut.
 * Definisi jalur hanya ada di @kira/core/recommendation. Anak di luar keluarga ini ditolak.
 */
export async function applyRecommendedPath(actor: Actor, input: { mode: 'recommended' | 'skipped'; learnerIds: string[] }): Promise<{ applied: number; today: boolean }> {
  return withFamilyAdmin(actor, async (tx, scope) => {
    for (const id of input.learnerIds) await scope.assertParentOf(id)
    const rows = await tx
      .select({ id: learnerProfile.userId, grade: learnerProfile.grade })
      .from(learnerProfile)
      .where(and(inArray(learnerProfile.userId, input.learnerIds), isNull(learnerProfile.deletedAt)))
    let today = false
    await scope.elevate(async () => {
      for (const r of rows) {
        const change = await saveFeaturesTx(tx, scope.ctx, r.id, recommendationFor(r.grade).features)
        today = today || change.today
        await tx.update(learnerProfile).set({ setupPath: input.mode, updatedAt: new Date() }).where(eq(learnerProfile.userId, r.id))
      }
    })
    for (const r of rows) await auditTx(tx, scope.ctx, 'parent.setup-path', r.id, { path: input.mode })
    return { applied: rows.length, today }
  })
}

/** Orang tua menyimpan saklar sendiri lewat FeatureChecklist; di sini hanya dicatat bahwa jalurnya "atur sendiri". */
export async function markCustomPath(actor: Actor, learnerId: string): Promise<void> {
  await withFamilyAdmin(actor, async (tx, scope) => {
    await scope.assertParentOf(learnerId)
    await scope.elevate(() => tx.update(learnerProfile).set({ setupPath: 'custom', updatedAt: new Date() }).where(eq(learnerProfile.userId, learnerId)))
    await auditTx(tx, scope.ctx, 'parent.setup-path', learnerId, { path: 'custom' })
  })
}

export type ChecklistKey = 'child' | 'path' | 'session' | 'report'
export type ChecklistItem = { key: ChecklistKey; done: boolean }

/**
 * Daftar langkah pertama di beranda keluarga. Hanya untuk orang tua yang memiliki keluarganya (kursi beta).
 * Mengembalikan null bila semua selesai atau bukan pemilik, jadi kartunya hilang sendiri.
 */
export async function firstRunChecklist(actor: Actor): Promise<ChecklistItem[] | null> {
  if (!(await isFamilyOwner(actor))) return null
  const items = await withFamilyAdmin(actor, async (tx) => {
    const kids = await tx
      .select({ id: learnerProfile.userId, setupPath: learnerProfile.setupPath })
      .from(learnerProfile)
      .innerJoin(guardianLink, eq(guardianLink.learnerId, learnerProfile.userId))
      .where(and(eq(guardianLink.guardianId, actor.userId), isNull(learnerProfile.deletedAt)))
    const ids = kids.map((k) => k.id)
    const done = ids.length > 0 ? await tx.select({ id: tables.quest.id }).from(tables.quest).where(and(inArray(tables.quest.learnerId, ids), eq(tables.quest.status, 'done'))).limit(1) : []
    const me = await tx.select({ seen: tables.memberProfile.firstReportSeenAt }).from(tables.memberProfile).where(eq(tables.memberProfile.userId, actor.userId)).limit(1)
    return [
      { key: 'child' as const, done: kids.length > 0 },
      { key: 'path' as const, done: kids.length > 0 && kids.every((k) => k.setupPath !== null) },
      { key: 'session' as const, done: done.length > 0 },
      { key: 'report' as const, done: Boolean(me[0]?.seen) },
    ]
  })
  return items.every((i) => i.done) ? null : items
}

/** Dipanggil saat laporan minggu dibuka. Sekali saja, dan tidak pernah menggagalkan halaman. */
export async function markFirstReportSeen(actor: Actor): Promise<void> {
  if (actor.role !== 'guardian') return
  await withFamilyAdmin(actor, async (tx, scope) => {
    await scope.elevate(() =>
      tx
        .update(tables.memberProfile)
        .set({ firstReportSeenAt: new Date() })
        .where(and(eq(tables.memberProfile.userId, actor.userId), isNull(tables.memberProfile.firstReportSeenAt))),
    )
  }).catch(() => undefined)
}
