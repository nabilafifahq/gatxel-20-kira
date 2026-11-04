import 'server-only'
import { eq } from 'drizzle-orm'
import { ACCESSORIES, TRACK_TEXT, accessoryHowToEarn, isAccessoryEarned, trackLevels, trackProgress, type AccessoryId, type TrackXp } from '@kira/core'
import { effectiveOn, type FeatureMap } from '@kira/core/features'
import { tables } from '@kira/db'
import type { AccessoryDTO, XpTrackDTO } from '@/lib/dto-arena'
import type { Dict } from '@/lib/i18n'
import type { Tx } from '../db'
import { forbidden } from '../errors'
import { trackTotals } from './arena-state'
import { EN_DICT } from './arena-session'

export function trackDTOs(totals: TrackXp): XpTrackDTO[] {
  return trackProgress(totals).map((p) => {
    const text = TRACK_TEXT[p.track]
    return {
      track: p.track,
      name: text.name,
      levelLabel: text.level,
      xp: p.xp,
      level: p.level,
      into: p.into,
      span: p.span,
      toNext: p.toNext,
      percent: p.percent,
      line: `${p.into} of ${p.span} XP to level ${p.level + 1}`,
    }
  })
}

function trackOn(track: string, features: FeatureMap): boolean {
  if (track === 'hitung') return effectiveOn(features, 'mental-math')
  if (track === 'pengetahuan') return effectiveOn(features, 'quiz-arena')
  return true
}

/** Bar XP yang saklarnya menyala: Hitung cepat dan Quiz Arena yang dimatikan orang tua tidak tampil. */
export function tracksFor(tracks: XpTrackDTO[], features: FeatureMap): XpTrackDTO[] {
  return tracks.filter((t) => trackOn(t.track, features))
}

export async function xpTracksDTO(tx: Tx, learnerId: string): Promise<XpTrackDTO[]> {
  return trackDTOs(await trackTotals(tx, learnerId))
}

export function accessoryDTOs(totals: TrackXp, features: FeatureMap = {}): AccessoryDTO[] {
  const levels = trackLevels(totals)
  // Aksesori jalur yang dimatikan disembunyikan, kecuali yang sudah telanjur didapat.
  return ACCESSORIES.filter((a) => isAccessoryEarned(a, levels) || trackOn(a.track, features)).map((a) => ({ id: a.id, label: a.label, earned: isAccessoryEarned(a, levels), howToEarn: accessoryHowToEarn(a) }))
}

/** Aksesori hanya boleh dipakai setelah didapat dari level jalur XP. Dipanggil dengan transaksi learner. */
export async function assertAccessoryEarned(tx: Tx, learnerId: string, accessory: AccessoryId | null, t: Dict = EN_DICT): Promise<void> {
  if (accessory === null) return
  const def = ACCESSORIES.find((a) => a.id === accessory)
  const levels = trackLevels(await trackTotals(tx, learnerId))
  if (!def || !isAccessoryEarned(def, levels)) throw forbidden(t.arena.errors.notEarned)
}

/**
 * Menulis learner_profile hanya boleh oleh staf (kebijakan learner_profile_scope), jadi action memanggil ini
 * dengan systemCtx setelah assertAccessoryEarned lolos, seperti setLearnerAvatar.
 */
export async function applyAccessory(tx: Tx, learnerId: string, accessory: AccessoryId | null): Promise<void> {
  await tx.update(tables.learnerProfile).set({ avatarAccessory: accessory, updatedAt: new Date() }).where(eq(tables.learnerProfile.userId, learnerId))
}
