/**
 * Peti hadiah harian. Muncul di Today setelah semua sesi wajib hari itu selesai, satu per learner per hari.
 * Hadiahnya dipilih di server dari tabel di bawah dengan seed (learner + tanggal), jadi buka ulang atau
 * muat ulang tidak mengubah hasil. Hadiah yang belum dimiliki didahulukan. Teks learner memakai "earned",
 * tidak pernah "unlock" (aturan kata di CLAUDE.md).
 */
import { createRng } from './rng'

export const CHEST_KINDS = ['sticker', 'background', 'accessory'] as const
export type ChestKind = (typeof CHEST_KINDS)[number]

export type ChestReward = { kind: ChestKind; id: string; label: string }

/** Nama ikon di @kira/figures (ICON_NAMES). Tes di packages/content memastikan semuanya ada. */
export const CHEST_STICKERS: readonly { id: string; label: string }[] = [
  { id: 'rainbow', label: 'Rainbow' },
  { id: 'butterfly', label: 'Butterfly' },
  { id: 'ladybird', label: 'Ladybird' },
  { id: 'whale', label: 'Whale' },
  { id: 'penguin', label: 'Penguin' },
  { id: 'kite', label: 'Kite' },
  { id: 'balloon', label: 'Balloon' },
  { id: 'cake', label: 'Cake' },
  { id: 'ice-cream', label: 'Ice cream' },
  { id: 'strawberry', label: 'Strawberry' },
  { id: 'flower', label: 'Flower' },
  { id: 'sun', label: 'Sun' },
  { id: 'moon', label: 'Moon' },
  { id: 'planet', label: 'Planet' },
  { id: 'mushroom', label: 'Mushroom' },
  { id: 'owl', label: 'Owl' },
  { id: 'lion', label: 'Lion' },
  { id: 'elephant', label: 'Elephant' },
  { id: 'bee', label: 'Bee' },
  { id: 'snail', label: 'Snail' },
  { id: 'shark', label: 'Shark' },
  { id: 'volcano', label: 'Volcano' },
  { id: 'parachute', label: 'Parachute' },
  { id: 'rain', label: 'Rain cloud' },
]

/** Latar avatar: cincin berwarna dengan pola kecil, digambar oleh Avatar di @kira/figures. */
export const CHEST_BACKGROUNDS: readonly { id: string; label: string }[] = [
  { id: 'sky', label: 'Sky' },
  { id: 'meadow', label: 'Meadow' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'night', label: 'Night sky' },
  { id: 'candy', label: 'Candy' },
  { id: 'ocean', label: 'Ocean' },
]

/** Aksesori khusus peti (di luar aksesori level). Gambar ada di AccessoryArt. */
export const CHEST_ACCESSORIES: readonly { id: string; label: string }[] = [
  { id: 'party-hat', label: 'Party hat' },
  { id: 'bandana', label: 'Bandana' },
  { id: 'flower-crown', label: 'Flower crown' },
]

export const CHEST_ACCESSORY_IDS: readonly string[] = CHEST_ACCESSORIES.map((a) => a.id)

export function isChestAccessoryId(value: unknown): boolean {
  return typeof value === 'string' && CHEST_ACCESSORY_IDS.includes(value)
}

export function isChestBackgroundId(value: unknown): boolean {
  return typeof value === 'string' && CHEST_BACKGROUNDS.some((b) => b.id === value)
}

/** Peluang jenis hadiah (jumlah 100). Stiker paling sering, aksesori paling jarang. */
export const CHEST_WEIGHTS: Record<ChestKind, number> = { sticker: 60, background: 25, accessory: 15 }

export function chestTable(): ChestReward[] {
  return [
    ...CHEST_STICKERS.map((s) => ({ kind: 'sticker' as const, ...s })),
    ...CHEST_BACKGROUNDS.map((s) => ({ kind: 'background' as const, ...s })),
    ...CHEST_ACCESSORIES.map((s) => ({ kind: 'accessory' as const, ...s })),
  ]
}

export function rewardKey(kind: ChestKind, id: string): string {
  return `${kind}:${id}`
}

export function chestRewardByKey(kind: string, id: string): ChestReward | undefined {
  return chestTable().find((r) => r.kind === kind && r.id === id)
}

/**
 * Pilih hadiah. `owned` berisi rewardKey yang sudah dimiliki. Jenis dipilih menurut bobot di antara jenis yang
 * masih punya hadiah baru; kalau semua sudah dimiliki, hadiah berulang tetap diberikan (isNew false).
 */
export function pickChestReward(seed: string, owned: ReadonlySet<string>): { reward: ChestReward; isNew: boolean } {
  const rng = createRng(`chest:${seed}`)
  const table = chestTable()
  const fresh = table.filter((r) => !owned.has(rewardKey(r.kind, r.id)))
  if (fresh.length === 0) return { reward: rng.pick(table), isNew: false }
  const kinds = CHEST_KINDS.filter((k) => fresh.some((r) => r.kind === k))
  const total = kinds.reduce((sum, k) => sum + CHEST_WEIGHTS[k], 0)
  let roll = rng.next() * total
  let kind = kinds[kinds.length - 1]!
  for (const k of kinds) {
    roll -= CHEST_WEIGHTS[k]
    if (roll < 0) {
      kind = k
      break
    }
  }
  return { reward: rng.pick(fresh.filter((r) => r.kind === kind)), isNew: true }
}

export type ChestState = 'none' | 'locked' | 'ready' | 'opened'

/** Keadaan peti di Today. Hari istirahat tidak punya peti. */
export function chestStateOf(input: { rest: boolean; doneCount: number; totalCount: number; openedToday: boolean }): ChestState {
  if (input.rest || input.totalCount <= 0) return 'none'
  if (input.openedToday) return 'opened'
  return input.doneCount >= input.totalCount ? 'ready' : 'locked'
}
