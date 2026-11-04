'use server'

import { refresh, revalidatePath } from 'next/cache'
import type { ActionResult, PlanChangeResult } from '@/lib/dto'
import type { ParentSkillChangeResult, ParentSkillOptionsDTO } from '@/lib/dto-parent'
import { requireParent } from '../auth/parent'
import { runAction } from '../errors'
import {
  parentAddChild,
  parentAddOptional,
  parentEditChild,
  parentMarkWork,
  parentRemoveSession,
  parentResetPin,
  parentResetStreak,
  parentSaveDayRules,
  parentSaveFeatures,
  parentSaveLimits,
  parentSaveSound,
  parentSetQuestionCount,
  parentSetSessionRequired,
  parentUnlock,
} from '../dal/parent-control'
import { parentChangeSessionSkill, parentSkillOptions } from '../dal/parent-skill-change'
import { parentSchemas as S } from './parent-schemas'

/**
 * Aksi dashboard orang tua. Urutan di setiap aksi: requireParent, Zod strict, lalu pemeriksaan guardian_link
 * (di DAL: parent-control). Argumen tidak pernah dicatat di log.
 */

function after(change: PlanChangeResult | null): void {
  refresh()
  if (change?.today) revalidatePath('/today')
}

export async function parentSaveDayRulesAction(input: unknown): Promise<ActionResult<PlanChangeResult>> {
  return runAction('parentSaveDayRules', async () => {
    const actor = await requireParent()
    const data = S.dayRules.parse(input)
    const change = await parentSaveDayRules(actor, data)
    after(change)
    return change
  })
}

export async function parentSaveFeaturesAction(input: unknown): Promise<ActionResult<PlanChangeResult>> {
  return runAction('parentSaveFeatures', async () => {
    const actor = await requireParent()
    const data = S.features.parse(input)
    const change = await parentSaveFeatures(actor, data)
    after(change)
    return change
  })
}

export async function parentResetStreakAction(input: unknown): Promise<ActionResult<{ removedDays: number; streakBefore: number }>> {
  return runAction('parentResetStreak', async () => {
    const actor = await requireParent()
    const data = S.resetStreak.parse(input)
    const r = await parentResetStreak(actor, data)
    after({ today: true, published: false, created: 0, removed: 0, regenerated: 0, kept: 0 })
    return r
  })
}

export async function parentSetSessionRequiredAction(input: unknown): Promise<ActionResult<PlanChangeResult>> {
  return runAction('parentSetSessionRequired', async () => {
    const actor = await requireParent()
    const data = S.sessionRequired.parse(input)
    const change = await parentSetSessionRequired(actor, data)
    after(change)
    return change
  })
}

export async function parentRemoveSessionAction(input: unknown): Promise<ActionResult<PlanChangeResult>> {
  return runAction('parentRemoveSession', async () => {
    const actor = await requireParent()
    const data = S.quest.parse(input)
    const change = await parentRemoveSession(actor, data)
    after(change)
    return change
  })
}

export async function parentAddOptionalAction(input: unknown): Promise<ActionResult<PlanChangeResult>> {
  return runAction('parentAddOptional', async () => {
    const actor = await requireParent()
    const data = S.sessionTarget.parse(input)
    const change = await parentAddOptional(actor, data)
    after(change)
    return change
  })
}

export async function parentSetQuestionCountAction(input: unknown): Promise<ActionResult<PlanChangeResult>> {
  return runAction('parentSetQuestionCount', async () => {
    const actor = await requireParent()
    const data = S.questionCount.parse(input)
    const change = await parentSetQuestionCount(actor, data)
    after(change)
    return change
  })
}

/** Daftar pilihan Ganti pelajaran, dimuat saat dialog dibuka supaya halaman anak tetap ringan. */
export async function parentSkillOptionsAction(input: unknown): Promise<ActionResult<ParentSkillOptionsDTO>> {
  return runAction('parentSkillOptions', async () => {
    const actor = await requireParent()
    const data = S.quest.parse(input)
    return parentSkillOptions(actor, data)
  })
}

export async function parentChangeSessionSkillAction(input: unknown): Promise<ActionResult<ParentSkillChangeResult>> {
  return runAction('parentChangeSessionSkill', async () => {
    const actor = await requireParent()
    const data = S.sessionSkill.parse(input)
    const r = await parentChangeSessionSkill(actor, data)
    after(r.change)
    return r
  })
}

export async function parentSaveLimitsAction(input: unknown): Promise<ActionResult> {
  return runAction('parentSaveLimits', async () => {
    const actor = await requireParent()
    const data = S.limits.parse(input)
    await parentSaveLimits(actor, data)
    refresh()
    return undefined
  })
}

export async function parentSaveSoundAction(input: unknown): Promise<ActionResult> {
  return runAction('parentSaveSound', async () => {
    const actor = await requireParent()
    const data = S.sound.parse(input)
    await parentSaveSound(actor, data)
    refresh()
    return undefined
  })
}

export async function parentResetPinAction(input: unknown): Promise<ActionResult> {
  return runAction('parentResetPin', async () => {
    const actor = await requireParent()
    const data = S.pin.parse(input)
    await parentResetPin(actor, data)
    return undefined
  })
}

export async function parentUnlockAction(input: unknown): Promise<ActionResult> {
  return runAction('parentUnlock', async () => {
    const actor = await requireParent()
    const data = S.unlock.parse(input)
    await parentUnlock(actor, data.learnerId)
    return undefined
  })
}

export async function parentEditChildAction(input: unknown): Promise<ActionResult> {
  return runAction('parentEditChild', async () => {
    const actor = await requireParent()
    const data = S.edit.parse(input)
    await parentEditChild(actor, data)
    refresh()
    return undefined
  })
}

export async function parentAddChildAction(input: unknown): Promise<ActionResult<{ learnerId: string }>> {
  return runAction('parentAddChild', async () => {
    const actor = await requireParent()
    const data = S.addChild.parse(input)
    const r = await parentAddChild(actor, data)
    refresh()
    return r
  })
}

export async function parentMarkWorkAction(input: unknown): Promise<ActionResult> {
  return runAction('parentMarkWork', async () => {
    const actor = await requireParent()
    const data = S.markWork.parse(input)
    await parentMarkWork(actor, data)
    refresh()
    return undefined
  })
}

