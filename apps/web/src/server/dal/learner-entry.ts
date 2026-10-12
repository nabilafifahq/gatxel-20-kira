import 'server-only'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { jakartaDate } from '@kira/core'
import { tables } from '@kira/db'
import { PIN_PICTURES } from '@kira/figures/spec'
import type { AvatarName, PickLearnerDTO, PinPicture, PinScreenDTO } from '@/lib/dto'
import { inOrg } from '../db'
import { systemCtx } from '../audit'
import type { DeviceInfo } from '../auth/device'
import { orgCtx, type Actor } from '../auth/actor'
import { pinState } from '../auth/pin'

const { learnerProfile, dayRecord } = tables

export async function pickLearnerDTO(device: DeviceInfo): Promise<PickLearnerDTO> {
  const today = jakartaDate()
  const rows = device.learnerIds.length
    ? await inOrg(systemCtx(device.orgId), (tx) =>
        tx
          .select({ id: learnerProfile.userId, name: learnerProfile.name, avatar: learnerProfile.avatar, grade: learnerProfile.grade, active: learnerProfile.active })
          .from(learnerProfile)
          .where(and(inArray(learnerProfile.userId, device.learnerIds), isNull(learnerProfile.deletedAt))),
      )
    : []
  const days = rows.length
    ? await inOrg(systemCtx(device.orgId), (tx) =>
        tx
          .select({ id: dayRecord.learnerId, done: dayRecord.questsDone, required: dayRecord.questsRequired })
          .from(dayRecord)
          .where(and(inArray(dayRecord.learnerId, rows.map((r) => r.id)), eq(dayRecord.date, today))),
      )
    : []
  const pins = await pinState(rows.map((r) => r.id))
  return {
    deviceName: device.name,
    learners: rows
      .filter((r) => r.active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => {
        const d = days.find((x) => x.id === r.id)
        return {
          id: r.id,
          name: r.name,
          avatar: r.avatar as AvatarName,
          grade: r.grade,
          doneToday: Boolean(d && d.required > 0 && d.done >= d.required),
          locked: Boolean(pins.get(r.id)?.lockedUntil),
        }
      }),
  }
}

export async function pinScreenDTO(device: DeviceInfo, learnerId: string): Promise<PinScreenDTO | null> {
  if (!device.learnerIds.includes(learnerId)) return null
  const rows = await inOrg(systemCtx(device.orgId), (tx) =>
    tx
      .select({ id: learnerProfile.userId, name: learnerProfile.name, avatar: learnerProfile.avatar, active: learnerProfile.active })
      .from(learnerProfile)
      .where(and(eq(learnerProfile.userId, learnerId), isNull(learnerProfile.deletedAt)))
      .limit(1),
  )
  const r = rows[0]
  if (!r || !r.active) return null
  const state = (await pinState([learnerId])).get(learnerId)
  return {
    learnerId: r.id,
    name: r.name,
    avatar: r.avatar as AvatarName,
    pictures: [...PIN_PICTURES] as PinPicture[],
    lockedUntil: state?.lockedUntil ? state.lockedUntil.toISOString() : null,
    attemptsLeft: Math.max(0, 5 - (state?.failed ?? 0)),
  }
}

export async function learnerOrgFor(device: DeviceInfo, learnerId: string): Promise<{ orgId: string; active: boolean } | null> {
  if (!device.learnerIds.includes(learnerId)) return null
  const rows = await inOrg(systemCtx(device.orgId), (tx) =>
    tx.select({ active: learnerProfile.active }).from(learnerProfile).where(and(eq(learnerProfile.userId, learnerId), isNull(learnerProfile.deletedAt))).limit(1),
  )
  return rows[0] ? { orgId: device.orgId, active: rows[0].active } : null
}

/** Isi started_on saat learner pertama kali membuka Today (profil hanya boleh diubah server). */
export async function ensureStarted(orgId: string, learnerId: string): Promise<void> {
  await inOrg(systemCtx(orgId), (tx) =>
    tx
      .update(learnerProfile)
      .set({ startedOn: jakartaDate() })
      .where(and(eq(learnerProfile.userId, learnerId), isNull(learnerProfile.startedOn))),
  )
}

export async function setLearnerAvatar(orgId: string, learnerId: string, avatar: AvatarName): Promise<void> {
  await inOrg(systemCtx(orgId), (tx) => tx.update(learnerProfile).set({ avatar, updatedAt: new Date() }).where(eq(learnerProfile.userId, learnerId)))
}

/** Nama org untuk halaman undangan (sebelum masuk). */
export async function orgNameFor(orgId: string): Promise<string> {
  const rows = await inOrg(systemCtx(orgId), (tx) => tx.select({ name: tables.org.name }).from(tables.org).where(eq(tables.org.id, orgId)).limit(1))
  return rows[0]?.name ?? 'Kira'
}

export async function learnerNames(orgId: string, ids: string[]): Promise<{ id: string; name: string; avatar: AvatarName }[]> {
  if (ids.length === 0) return []
  return inOrg(systemCtx(orgId), async (tx) =>
    (await tx.select({ id: learnerProfile.userId, name: learnerProfile.name, avatar: learnerProfile.avatar }).from(learnerProfile).where(inArray(learnerProfile.userId, ids))).map((r) => ({ ...r, avatar: r.avatar as AvatarName })),
  )
}

/** Learner yang boleh didaftarkan ke tablet oleh orang dewasa ini (orang tua hanya anak yang tertaut). */
export async function registerableLearners(actor: Actor): Promise<{ id: string; name: string; avatar: AvatarName }[]> {
  return inOrg(orgCtx(actor), async (tx) => {
    const { guardianLink } = tables
    let ids: string[] | null = null
    if (actor.role === 'guardian') {
      ids = (await tx.select({ id: guardianLink.learnerId }).from(guardianLink).where(eq(guardianLink.guardianId, actor.userId))).map((l) => l.id)
      if (ids.length === 0) return []
    }
    const rows = await tx
      .select({ id: learnerProfile.userId, name: learnerProfile.name, avatar: learnerProfile.avatar })
      .from(learnerProfile)
      .where(ids ? and(inArray(learnerProfile.userId, ids), isNull(learnerProfile.deletedAt)) : isNull(learnerProfile.deletedAt))
    return rows.map((r) => ({ ...r, avatar: r.avatar as AvatarName }))
  })
}
