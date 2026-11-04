import { PRICE } from './prices'

/** Teman Kira: enam pilihan dari telur, tiga tahap. Tidak pernah sakit, sedih, atau pergi. */

export const PET_KINDS = [
  { id: 'flamekit', name: 'Flamekit', blurb: 'Warm and playful' },
  { id: 'moonbun', name: 'Moonbun', blurb: 'Soft and gentle' },
  { id: 'leafling', name: 'Leafling', blurb: 'Curious and brave' },
  { id: 'sunbird', name: 'Sunbird', blurb: 'Bright and chatty' },
  { id: 'cloudpuff', name: 'Cloudpuff', blurb: 'Calm and dreamy' },
  { id: 'wavedrake', name: 'Wavedrake', blurb: 'Quick and cheerful' },
] as const
export type PetKind = (typeof PET_KINDS)[number]['id']
export const PET_KIND_IDS: readonly string[] = PET_KINDS.map((p) => p.id)

export function isPetKind(v: unknown): v is PetKind {
  return typeof v === 'string' && PET_KIND_IDS.includes(v)
}

/** Telur menetas setelah anak punya bintang pertama. */
export const HATCH_AT_STARS = 5

/** Tahap menurut jumlah sesi wajib yang pernah selesai. */
export const PET_STAGE_AT = [0, 10, 40] as const
export const PET_STAGE_NAMES = ['Hatchling', 'Buddy', 'Champion'] as const

export function petStage(sessionsDone: number): 1 | 2 | 3 {
  if (sessionsDone >= PET_STAGE_AT[2]) return 3
  if (sessionsDone >= PET_STAGE_AT[1]) return 2
  return 1
}

export function nextStage(sessionsDone: number): { stage: 2 | 3; left: number } | null {
  if (sessionsDone < PET_STAGE_AT[1]) return { stage: 2, left: PET_STAGE_AT[1] - sessionsDone }
  if (sessionsDone < PET_STAGE_AT[2]) return { stage: 3, left: PET_STAGE_AT[2] - sessionsDone }
  return null
}

export type Treat = { id: string; name: string; icon: string; price: number; kind: 'feed' | 'play'; line: string }
export const TREATS: readonly Treat[] = [
  { id: 'apple', name: 'Apple', icon: 'apple', price: PRICE.apple, kind: 'feed', line: 'Crunch crunch. Yum!' },
  { id: 'strawberry', name: 'Strawberry', icon: 'strawberry', price: PRICE.strawberry, kind: 'feed', line: 'So sweet!' },
  { id: 'cake', name: 'Cake', icon: 'cake', price: PRICE.cake, kind: 'feed', line: 'Party time!' },
  { id: 'ice-cream', name: 'Ice cream', icon: 'ice-cream', price: PRICE['ice-cream'], kind: 'feed', line: 'Best day ever!' },
  { id: 'ball', name: 'Play ball', icon: 'ball', price: PRICE.ball, kind: 'play', line: 'Catch it!' },
  { id: 'kite', name: 'Fly a kite', icon: 'kite', price: PRICE.kite, kind: 'play', line: 'Wheee, up high!' },
  { id: 'balloon', name: 'Balloons', icon: 'balloon', price: PRICE.balloon, kind: 'play', line: 'Pop pop pop!' },
]
export function treatById(id: string): Treat | undefined {
  return TREATS.find((t) => t.id === id)
}

/** Kostum teman dan rumah teman dijual di Toko Bintang. */
export const PET_COSTUMES = [
  { id: 'pet-bow', name: 'Bow', price: PRICE['pet-bow'] },
  { id: 'pet-glasses', name: 'Round glasses', price: PRICE['pet-glasses'] },
  { id: 'pet-crown', name: 'Little crown', price: PRICE['pet-crown'] },
] as const
export type PetCostumeId = (typeof PET_COSTUMES)[number]['id']

export const PET_HOMES = [
  { id: 'home-meadow', name: 'Meadow nook', price: 0 },
  { id: 'home-treehouse', name: 'Treehouse', price: PRICE['home-treehouse'] },
  { id: 'home-cave', name: 'Crystal cave', price: PRICE['home-cave'] },
  { id: 'home-pond', name: 'Lily pond', price: PRICE['home-pond'] },
  { id: 'home-castle', name: 'Cloud castle', price: PRICE['home-castle'] },
] as const
export type PetHomeId = (typeof PET_HOMES)[number]['id']

/** Nama teman: huruf, angka, spasi, apostrof, tanda hubung; 1 sampai 12 karakter. */
export const PET_NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} '-]{0,11}$/u
export function cleanPetName(s: string): string | null {
  const t = s.trim().replace(/\s+/g, ' ')
  return PET_NAME_RE.test(t) ? t : null
}

/** Sapaan selalu hangat, tidak peduli sudah berapa hari anak pergi. */
export function petGreeting(name: string, daysAway: number, seed: number): string {
  const back = [`${name} missed you. Welcome back!`, `${name} is so happy to see you!`, `Yay, you are here! ${name} did a happy spin.`]
  const daily = [`${name} says hello!`, `Ready to learn with ${name}?`, `${name} is cheering for you today.`]
  const list = daysAway >= 2 ? back : daily
  return list[seed % list.length]!
}
