/**
 * Aksesori avatar yang didapat dari level jalur XP. Gambar ada di @kira/figures (AccessoryArt),
 * kunci `id` harus sama; tes di packages/content memastikannya. Teks learner memakai "Earn".
 */
import type { XpTrack } from './xp-tracks'

export const ACCESSORY_IDS = ['star-pin', 'scarf', 'crown', 'visor', 'glasses', 'headphones', 'bow-tie', 'explorer-hat', 'laurel'] as const
export type AccessoryId = (typeof ACCESSORY_IDS)[number]

export type AccessoryDef = { id: AccessoryId; label: string; track: XpTrack; level: number }

export const ACCESSORIES: readonly AccessoryDef[] = [
  { id: 'star-pin', label: 'Star pin', track: 'belajar', level: 3 },
  { id: 'scarf', label: 'Scarf', track: 'belajar', level: 6 },
  { id: 'crown', label: 'Crown', track: 'belajar', level: 10 },
  { id: 'visor', label: 'Purple cap', track: 'hitung', level: 3 },
  { id: 'glasses', label: 'Round glasses', track: 'hitung', level: 6 },
  { id: 'headphones', label: 'Headphones', track: 'hitung', level: 10 },
  { id: 'bow-tie', label: 'Bow tie', track: 'pengetahuan', level: 3 },
  { id: 'explorer-hat', label: 'Explorer hat', track: 'pengetahuan', level: 6 },
  { id: 'laurel', label: 'Laurel wreath', track: 'pengetahuan', level: 10 },
]

export function isAccessoryId(value: unknown): value is AccessoryId {
  return typeof value === 'string' && (ACCESSORY_IDS as readonly string[]).includes(value)
}

export function accessoryById(id: string): AccessoryDef | undefined {
  return ACCESSORIES.find((a) => a.id === id)
}

const TRACK_WORD: Record<XpTrack, string> = { belajar: 'Learning level', hitung: 'Quick Maths level', pengetahuan: 'Quiz level' }

/** "Earn it at Quick Maths level 6". */
export function accessoryHowToEarn(def: AccessoryDef): string {
  return `Earn it at ${TRACK_WORD[def.track]} ${def.level}`
}

export function isAccessoryEarned(def: AccessoryDef, levels: Record<XpTrack, number>): boolean {
  return levels[def.track] >= def.level
}

export function earnedAccessories(levels: Record<XpTrack, number>): AccessoryDef[] {
  return ACCESSORIES.filter((a) => isAccessoryEarned(a, levels))
}

/** Aksesori yang baru didapat antara dua keadaan level. */
export function newlyEarnedAccessories(before: Record<XpTrack, number>, after: Record<XpTrack, number>): AccessoryDef[] {
  return ACCESSORIES.filter((a) => isAccessoryEarned(a, after) && !isAccessoryEarned(a, before))
}
