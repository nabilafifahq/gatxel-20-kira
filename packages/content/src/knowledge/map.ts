/**
 * Soal "Point on the map" Quiz Arena (topik Continents and oceans): ketuk benua atau samudra yang benar di peta dunia
 * sederhana (data/worldmap.ts, dibuat otomatis dari world-atlas). Satu soal per wilayah: id `map:<wilayah>`. Jawaban adalah
 * id wilayah yang diketuk; pengecoh tidak ada karena semua wilayah di peta adalah pilihan. Soal ini tidak masuk catatan
 * kemajuan fakta (seperti soal urutan), hanya hitungan benar dan XP ronde.
 */
import { createRng } from '@kira/core/rng'
import { WORLD_MAP } from './data/worldmap'
import type { KQuestion } from './types'

export const MAP_FACT_PREFIX = 'map:'
export const MAP_ROUND_QUESTIONS = 10

export type MapRegionInfo = { id: string; label: string; kind: 'continent' | 'ocean' }

export const MAP_REGIONS: readonly MapRegionInfo[] = [
  ...WORLD_MAP.land.map((r) => ({ id: r.id, label: r.label, kind: 'continent' as const })),
  ...WORLD_MAP.water.map((r) => ({ id: r.id, label: r.label, kind: 'ocean' as const })),
]

const BY_ID = new Map(MAP_REGIONS.map((r) => [r.id, r]))

export const isMapFactId = (factId: string): boolean => factId.startsWith(MAP_FACT_PREFIX) && BY_ID.has(factId.slice(MAP_FACT_PREFIX.length))
export const mapRegionOf = (factId: string): MapRegionInfo | undefined => (factId.startsWith(MAP_FACT_PREFIX) ? BY_ID.get(factId.slice(MAP_FACT_PREFIX.length)) : undefined)
export const mapRegionByLabel = (label: string): MapRegionInfo | undefined => MAP_REGIONS.find((r) => r.label === label)

const EXPLAIN: Record<string, string> = {
  asia: 'Asia is the biggest continent. Indonesia is in Asia.',
  europe: 'Europe is the continent to the north of Africa and the west of Asia.',
  africa: 'Africa is the second biggest continent. It has 54 countries.',
  namerica: 'North America has Canada, the United States and Mexico.',
  samerica: 'South America has Brazil and the Amazon rainforest.',
  oceania: 'Oceania has Australia, New Zealand and many islands.',
  antarctica: 'Antarctica is at the very bottom of the world. It is covered in ice.',
  pacific: 'The Pacific Ocean is the biggest and deepest ocean.',
  atlantic: 'The Atlantic Ocean is between the Americas and Europe and Africa.',
  indian: 'The Indian Ocean is between Africa, Asia and Australia.',
  southern: 'The Southern Ocean is the ocean around Antarctica.',
  arctic: 'The Arctic Ocean is around the North Pole. It is the smallest ocean.',
}

/** Soal untuk satu wilayah. Klien tidak menerima id yang benar; kuncinya hanya di server. */
export function buildMapQuestion(factId: string): KQuestion {
  const region = mapRegionOf(factId)
  if (!region) throw new Error(`Wilayah peta tidak dikenal: ${factId}`)
  const prompt = region.kind === 'ocean' ? `Tap the ${region.label} on the map.` : `Tap ${region.label} on the map.`
  return {
    client: { kind: 'map', factId, prompt },
    key: { kind: 'map', correct: region.id, explain: EXPLAIN[region.id] ?? `That is ${region.label}.`, factId, answerLabel: region.label },
  }
}

/** Rencana ronde peta: sepuluh dari dua belas wilayah, urutan acak. */
export function planMapRound(seed: string): string[] {
  const rng = createRng(`${seed}#map`)
  return rng.shuffle(MAP_REGIONS.map((r) => `${MAP_FACT_PREFIX}${r.id}`)).slice(0, MAP_ROUND_QUESTIONS)
}
