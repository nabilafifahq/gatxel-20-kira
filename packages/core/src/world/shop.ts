import { PET_COSTUMES, PET_HOMES } from './pet'
import { CARD_SETS } from './cards'
import { PRICE } from './prices'

/** Toko Bintang. Harga jelas, tanpa uang sungguhan dan tanpa batas waktu. Angka harga hanya ada di prices.ts. */

export type ShopKind = 'petcostume' | 'pethome' | 'outfit' | 'frame' | 'backdrop'
export type ShopItem = { id: string; kind: ShopKind; name: string; price: number }

export const OUTFITS: readonly ShopItem[] = [
  { id: 'party-hat', kind: 'outfit', name: 'Party hat', price: PRICE['party-hat'] },
  { id: 'bandana', kind: 'outfit', name: 'Bandana', price: PRICE.bandana },
  { id: 'flower-crown', kind: 'outfit', name: 'Flower crown', price: PRICE['flower-crown'] },
]
export const BACKDROPS: readonly ShopItem[] = [
  { id: 'sky', kind: 'backdrop', name: 'Sky', price: PRICE.sky },
  { id: 'meadow', kind: 'backdrop', name: 'Meadow', price: PRICE.meadow },
  { id: 'sunset', kind: 'backdrop', name: 'Sunset', price: PRICE.sunset },
  { id: 'night', kind: 'backdrop', name: 'Night sky', price: PRICE.night },
  { id: 'candy', kind: 'backdrop', name: 'Candy', price: PRICE.candy },
  { id: 'ocean', kind: 'backdrop', name: 'Ocean', price: PRICE.ocean },
]
export const FRAMES: readonly ShopItem[] = [
  { id: 'frame-leaf', kind: 'frame', name: 'Leaf ring', price: PRICE.reward },
  { id: 'frame-wave', kind: 'frame', name: 'Wave ring', price: PRICE.reward },
  { id: 'frame-gold', kind: 'frame', name: 'Gold ring', price: PRICE.reward },
  { id: 'frame-lamp', kind: 'frame', name: 'Lamp ring', price: PRICE.reward },
  { id: 'frame-page', kind: 'frame', name: 'Page ring', price: PRICE.reward },
  { id: 'frame-comet', kind: 'frame', name: 'Comet ring', price: PRICE.reward },
  { id: 'frame-heart', kind: 'frame', name: 'Heart ring', price: PRICE.reward },
  { id: 'frame-note', kind: 'frame', name: 'Music ring', price: PRICE.reward },
  { id: 'frame-dot', kind: 'frame', name: 'Number ring', price: PRICE.reward },
  { id: 'frame-book', kind: 'frame', name: 'Word ring', price: PRICE.reward },
  { id: 'frame-star', kind: 'frame', name: 'Star ring', price: PRICE['frame-star'] },
  { id: 'frame-moon', kind: 'frame', name: 'Moon ring', price: PRICE['frame-moon'] },
  { id: 'frame-crown', kind: 'frame', name: 'Crown ring', price: PRICE['frame-crown'] },
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
