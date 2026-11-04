import { PET_COSTUMES, PET_HOMES } from './pet'
import { CARD_SETS } from './cards'

/** Toko Bintang. Harga jelas, tanpa uang sungguhan dan tanpa batas waktu. */

export type ShopKind = 'petcostume' | 'pethome' | 'outfit' | 'frame' | 'backdrop'
export type ShopItem = { id: string; kind: ShopKind; name: string; price: number }

export const OUTFITS: readonly ShopItem[] = [
  { id: 'party-hat', kind: 'outfit', name: 'Party hat', price: 15 },
  { id: 'bandana', kind: 'outfit', name: 'Bandana', price: 15 },
  { id: 'flower-crown', kind: 'outfit', name: 'Flower crown', price: 20 },
]
export const BACKDROPS: readonly ShopItem[] = [
  { id: 'sky', kind: 'backdrop', name: 'Sky', price: 10 },
  { id: 'meadow', kind: 'backdrop', name: 'Meadow', price: 10 },
  { id: 'sunset', kind: 'backdrop', name: 'Sunset', price: 15 },
  { id: 'night', kind: 'backdrop', name: 'Night sky', price: 15 },
  { id: 'candy', kind: 'backdrop', name: 'Candy', price: 20 },
  { id: 'ocean', kind: 'backdrop', name: 'Ocean', price: 20 },
]
export const FRAMES: readonly ShopItem[] = [
  { id: 'frame-leaf', kind: 'frame', name: 'Leaf ring', price: 20 },
  { id: 'frame-wave', kind: 'frame', name: 'Wave ring', price: 20 },
  { id: 'frame-gold', kind: 'frame', name: 'Gold ring', price: 25 },
  { id: 'frame-star', kind: 'frame', name: 'Star ring', price: 30 },
]
export const FRAME_IDS = FRAMES.map((f) => f.id)

/** Hadiah selesai set tidak dijual: hanya didapat dari album. */
const SET_REWARD_IDS = new Set(CARD_SETS.map((c) => c.reward))

export const ALL_ITEMS: readonly ShopItem[] = [
  ...PET_COSTUMES.map((p): ShopItem => ({ id: p.id, kind: 'petcostume', name: p.name, price: p.price })),
  ...PET_HOMES.filter((h) => h.price > 0).map((h): ShopItem => ({ id: h.id, kind: 'pethome', name: h.name, price: h.price })),
  ...OUTFITS,
  ...FRAMES,
  ...BACKDROPS,
]
export const SHOP: readonly ShopItem[] = ALL_ITEMS.filter((i) => !SET_REWARD_IDS.has(i.id))

export function shopItem(id: string): ShopItem | undefined {
  return SHOP.find((s) => s.id === id)
}

/** Barang apa pun (juga hadiah set) menurut id. */
export function anyItem(id: string): ShopItem | undefined {
  return ALL_ITEMS.find((s) => s.id === id) ?? (id === 'home-meadow' ? { id, kind: 'pethome', name: 'Meadow nook', price: 0 } : undefined)
}
