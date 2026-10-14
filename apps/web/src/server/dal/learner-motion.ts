import 'server-only'
import { and, eq } from 'drizzle-orm'
import {
  CHEST_ACCESSORIES,
  CHEST_BACKGROUNDS,
  CHEST_STICKERS,
  chestRewardByKey,
  chestStateOf,
  isChestBackgroundId,
  jakartaDate,
  pickChestReward,
  rewardKey,
  type ChestKind,
} from '@kira/core'
import { tables } from '@kira/db'
import type { TodayDTO } from '@/lib/dto'
import type { ChestDTO, ChestRewardDTO, CollectionDTO, SoundPolicyDTO } from '@/lib/dto-motion'
import type { Tx } from '../db'
import { conflict, forbidden, notFound } from '../errors'

const { learnerProfile, dailyChest } = tables

type TodayProgress = Pick<TodayDTO, 'variant' | 'progress'>

/** Pilihan suara dan musik dari tutor untuk satu learner. */
export async function soundPolicyOf(tx: Tx, learnerId: string): Promise<SoundPolicyDTO> {
  const rows = await tx
    .select({ sfx: learnerProfile.soundEnabled, music: learnerProfile.musicEnabled })
    .from(learnerProfile)
    .where(eq(learnerProfile.userId, learnerId))
    .limit(1)
  return rows[0] ?? { sfx: true, music: true }
}

export async function ownedRewardKeys(tx: Tx, learnerId: string): Promise<Set<string>> {
  const rows = await tx.select({ kind: dailyChest.rewardKind, id: dailyChest.rewardId }).from(dailyChest).where(eq(dailyChest.learnerId, learnerId))
  return new Set(rows.map((r) => rewardKey(r.kind, r.id)))
}

function rewardDto(kind: ChestKind, id: string, isNew: boolean): ChestRewardDTO {
  const def = chestRewardByKey(kind, id)
  return { kind, id, label: def?.label ?? id, isNew }
}

function lineFor(state: ChestDTO['state'], left: number): string {
  if (state === 'ready') return 'All sessions done. Open your chest.'
  if (state === 'opened') return 'You opened today’s chest. See you tomorrow.'
  return left === 1 ? '1 more session to open your chest' : `${left} more sessions to open your chest`
}

async function profileLooks(tx: Tx, learnerId: string): Promise<{ acc: string | null; bg: string | null } | undefined> {
  const rows = await tx.select({ acc: learnerProfile.avatarAccessory, bg: learnerProfile.avatarBackground }).from(learnerProfile).where(eq(learnerProfile.userId, learnerId)).limit(1)
  return rows[0]
}

/** Peti untuk Today. Null pada hari istirahat. Syaratnya dihitung dari progres Today yang sama dengan jalurnya. */
export async function chestDTO(tx: Tx, learnerId: string, today: TodayProgress, date = jakartaDate()): Promise<ChestDTO | null> {
  const opened = (await tx.select().from(dailyChest).where(and(eq(dailyChest.learnerId, learnerId), eq(dailyChest.date, date))).limit(1))[0]
  const state = chestStateOf({ rest: today.variant === 'rest-day', doneCount: today.progress.done, totalCount: today.progress.total, openedToday: Boolean(opened) })
  if (state === 'none') return null
  const reward = opened ? rewardDto(opened.rewardKind, opened.rewardId, opened.isNew) : null
  let equipped = false
  if (reward && reward.kind !== 'sticker') {
    const looks = await profileLooks(tx, learnerId)
    equipped = reward.kind === 'accessory' ? looks?.acc === reward.id : looks?.bg === reward.id
  }
  return { state, line: lineFor(state, Math.max(0, today.progress.total - today.progress.done)), reward, equipped }
}

/**
 * Buka peti hari ini. Dicek di server: semua sesi wajib hari ini sudah selesai dan belum ada peti hari ini
 * (UNIQUE learner_id + date menolak balapan dua tab). Hadiah dipilih dari seed learner + tanggal.
 */
export async function openChestTx(tx: Tx, orgId: string, learnerId: string, today: TodayProgress, date = jakartaDate()): Promise<ChestRewardDTO> {
  const existing = (await tx.select({ id: dailyChest.id }).from(dailyChest).where(and(eq(dailyChest.learnerId, learnerId), eq(dailyChest.date, date))).limit(1))[0]
  if (existing) throw conflict('You already opened today’s chest.')
  const state = chestStateOf({ rest: today.variant === 'rest-day', doneCount: today.progress.done, totalCount: today.progress.total, openedToday: false })
  if (state !== 'ready') throw forbidden('Finish today’s sessions first, then open the chest.')
  const owned = await ownedRewardKeys(tx, learnerId)
  const { reward, isNew } = pickChestReward(`${learnerId}:${date}`, owned)
  const inserted = await tx
    .insert(dailyChest)
    .values({ orgId, learnerId, date, rewardKind: reward.kind, rewardId: reward.id, isNew })
    .onConflictDoNothing()
    .returning({ id: dailyChest.id })
  if (inserted.length === 0) throw conflict('You already opened today’s chest.')
  return { kind: reward.kind, id: reward.id, label: reward.label, isNew }
}

/** Boleh dipakai bila hadiah itu sudah didapat dari peti. */
export async function assertChestOwned(tx: Tx, learnerId: string, kind: ChestKind, id: string): Promise<void> {
  const owned = await ownedRewardKeys(tx, learnerId)
  if (!owned.has(rewardKey(kind, id))) throw forbidden('You have not earned that one yet.')
}

export async function applyBackground(tx: Tx, learnerId: string, background: string | null): Promise<void> {
  if (background !== null && !isChestBackgroundId(background)) throw notFound('That background does not exist.')
  await tx.update(learnerProfile).set({ avatarBackground: background, updatedAt: new Date() }).where(eq(learnerProfile.userId, learnerId))
}

/** Koleksi di Me: stiker, latar, dan aksesori peti, dengan tanda sudah dimiliki dan sedang dipakai. */
export async function collectionDTO(tx: Tx, learnerId: string): Promise<CollectionDTO> {
  const owned = await ownedRewardKeys(tx, learnerId)
  const looks = await profileLooks(tx, learnerId)
  return {
    stickers: CHEST_STICKERS.map((s) => ({ ...s, owned: owned.has(rewardKey('sticker', s.id)) })),
    backgrounds: CHEST_BACKGROUNDS.map((b) => ({ ...b, owned: owned.has(rewardKey('background', b.id)), equipped: looks?.bg === b.id })),
    accessories: CHEST_ACCESSORIES.map((a) => ({ ...a, owned: owned.has(rewardKey('accessory', a.id)), equipped: looks?.acc === a.id })),
  }
}

export async function updateLearnerSoundTx(tx: Tx, learnerId: string, input: { soundEnabled: boolean; musicEnabled: boolean }): Promise<void> {
  const res = await tx
    .update(learnerProfile)
    .set({ soundEnabled: input.soundEnabled, musicEnabled: input.musicEnabled, updatedAt: new Date() })
    .where(eq(learnerProfile.userId, learnerId))
    .returning({ id: learnerProfile.userId })
  if (res.length === 0) throw notFound()
}
