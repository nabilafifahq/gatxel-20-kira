/**
 * Saklar fitur per anak. Semua fitur menyala bawaan; orang tua mematikan yang tidak dipakai.
 * Satu tempat untuk kunci, kelompok tampilan, preset, dan aturan turunan (mapel yang mati tidak membuat sesi harian).
 */
export const FEATURE_KEYS = ['math','english','science','olympiad-math','olympiad-english','olympiad-science','drill-math','mental-math','quiz-arena','vocab','flashcards','reading-room','english-skills','paper','kira-world','placement','dictionary','manipulatives'] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]

export type FeatureSubject = 'math' | 'english' | 'science'

export function isFeatureKey(v: unknown): v is FeatureKey {
  return typeof v === 'string' && (FEATURE_KEYS as readonly string[]).includes(v)
}

/** Peta fitur ke on/off. Kunci yang tidak ada berarti menyala. */
export type FeatureMap = Partial<Record<FeatureKey, boolean>>

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  math: 'Matematika',
  english: 'Bahasa Inggris',
  science: 'Sains',
  'olympiad-math': 'Olimpiade Matematika',
  'olympiad-english': 'Olimpiade Bahasa Inggris',
  'olympiad-science': 'Olimpiade Sains',
  'drill-math': 'Drill Matematika',
  'mental-math': 'Hitung cepat (Mental Math)',
  vocab: 'Drill kosakata',
  flashcards: 'Kartu belajar (Flashcards)',
  'quiz-arena': 'Quiz Arena',
  'reading-room': 'Ruang Baca',
  'english-skills': 'English Skills',
  paper: 'Paper',
  'kira-world': 'Dunia Kira',
  dictionary: 'Kamus',
  manipulatives: 'Alat peraga',
  placement: 'Tes penempatan',
}

export const FEATURE_GROUPS: { id: string; title: string; keys: FeatureKey[] }[] = [
  { id: 'daily', title: 'Mapel harian', keys: ['math', 'english', 'science'] },
  { id: 'olympiad', title: 'Olimpiade', keys: ['olympiad-math', 'olympiad-english', 'olympiad-science'] },
  { id: 'drill', title: 'Drill dan latihan', keys: ['drill-math', 'mental-math', 'vocab', 'flashcards'] },
  { id: 'other', title: 'Lainnya', keys: ['quiz-arena', 'reading-room', 'english-skills', 'paper', 'kira-world', 'dictionary', 'manipulatives', 'placement'] },
]

export const FEATURE_PRESETS: { id: 'lengkap' | 'fokus-sekolah' | 'olimpiade'; title: string; hint: string; off: FeatureKey[] }[] = [
  { id: 'lengkap', title: 'Lengkap', hint: 'Semua fitur menyala.', off: [] },
  {
    id: 'fokus-sekolah',
    title: 'Fokus sekolah',
    hint: 'Mapel harian, drill, dan baca. Olimpiade dan Quiz Arena dimatikan.',
    off: ['olympiad-math', 'olympiad-english', 'olympiad-science', 'quiz-arena', 'kira-world'],
  },
  {
    id: 'olimpiade',
    title: 'Persiapan olimpiade',
    hint: 'Olimpiade, drill, dan kartu. Quiz Arena dan Dunia Kira dimatikan.',
    off: ['quiz-arena', 'kira-world', 'reading-room'],
  },
]

/** Kunci mati untuk satu preset, sebagai peta lengkap. */
export function presetMap(id: string): FeatureMap {
  const p = FEATURE_PRESETS.find((x) => x.id === id)
  const out: FeatureMap = {}
  for (const k of p?.off ?? []) out[k] = false
  return out
}

export function featureOn(map: FeatureMap, key: FeatureKey): boolean {
  return map[key] !== false
}

/** Mapel harian yang menyala. Mapel mati tidak membuat sesi harian, aturan hari, atau streak. */
export function activeSubjects(map: FeatureMap): FeatureSubject[] {
  return (['math', 'english', 'science'] as const).filter((s) => featureOn(map, s))
}

/** Olimpiade per mapel hanya terbuka bila mapelnya sendiri menyala. */
export function olympiadOn(map: FeatureMap, subject: FeatureSubject): boolean {
  return featureOn(map, subject) && featureOn(map, `olympiad-${subject}` as FeatureKey)
}

/** Fitur turunan mapel: bila mapel mati, fitur yang bergantung padanya ikut mati. */
export const FEATURE_NEEDS: Partial<Record<FeatureKey, FeatureKey>> = {
  'olympiad-math': 'math',
  'olympiad-english': 'english',
  'olympiad-science': 'science',
  'drill-math': 'math',
  'mental-math': 'math',
}

/** Menyala setelah memperhitungkan ketergantungan. Vocab dan flashcards berdiri sendiri. */
export function effectiveOn(map: FeatureMap, key: FeatureKey): boolean {
  if (!featureOn(map, key)) return false
  const need = FEATURE_NEEDS[key]
  return need ? featureOn(map, need) : true
}
