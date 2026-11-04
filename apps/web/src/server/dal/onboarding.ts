import 'server-only'
import { and, eq, isNull, sql } from 'drizzle-orm'
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
import { featureMapFor } from './learner-features'
import type { FeatureMap } from '@kira/core/features'
import type { UiLang } from '@/lib/i18n/lang'

const { learnerProfile, guardianLink } = tables

/** Tujuan persetujuan yang ditawarkan saat onboarding. Bantuan AI hanya untuk tutor dan mati selama pilot. */
export const ONBOARDING_PURPOSES = ['learning', 'progress-email', 'audio', 'photo'] as const satisfies readonly ConsentPurposeId[]
export type OnboardingPurpose = (typeof ONBOARDING_PURPOSES)[number]

export type OnboardingChild = { id: string; name: string; grade: number; avatar: AvatarName; active: boolean; consents: Record<OnboardingPurpose, boolean>; features: FeatureMap }
export type OnboardingState = { parentName: string; children: OnboardingChild[]; max: number }

export async function onboardingState(actor: Actor): Promise<OnboardingState> {
  return withFamilyAdmin(actor, async (tx) => {
    const rows = await tx
      .select({ id: learnerProfile.userId, name: learnerProfile.name, grade: learnerProfile.grade, avatar: learnerProfile.avatar, active: learnerProfile.active })
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
      })),
    }
  })
}

/**
 * Orang tua menambah anak. Batas per keluarga (KIRA_MAX_LEARNERS_PER_FAMILY) dijaga dengan kunci
 * penasihat per org, jadi dua permintaan serentak tidak melewati batas. Anak belum aktif sampai orang tua
 * memberi persetujuan belajar.
 */
export async function addChild(actor: Actor, input: { name: string; grade: number; avatar: AvatarName; pin: PinPicture[]; uiLang?: UiLang }): Promise<string> {
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
    const learnerId = await createLearnerAccount({ orgId: actor.orgId, userId: actor.userId }, { name, grade: input.grade, avatar: input.avatar, pin: input.pin, uiLang: input.uiLang })
    const ctx = orgCtx(actor)
    await scope.elevate(async () => {
      await tx.insert(guardianLink).values({ orgId: actor.orgId, guardianId: actor.userId, learnerId })
      await applyDefaultPreset(tx, ctx, learnerId)
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
