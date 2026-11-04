import { FEATURE_KEYS, FEATURE_LABEL, type FeatureKey, type FeatureMap, type FeatureSubject } from './features'

/**
 * Jalur rekomendasi: satu-satunya tempat yang menentukan apa yang didapat anak per kelas saat orang tua memilih
 * "Pakai jalur rekomendasi" atau "Lewati dulu". Orang tua bisa mengubahnya kapan saja di dashboard.
 * Dipakai onboarding (apps/web/src/server/dal/onboarding.ts), diuji apps/web/test/recommendation.test.ts.
 */

export const SETUP_PATHS = ['recommended', 'custom', 'skipped'] as const
export type SetupPath = (typeof SETUP_PATHS)[number]

export function isSetupPath(v: unknown): v is SetupPath {
  return typeof v === 'string' && (SETUP_PATHS as readonly string[]).includes(v)
}

type Band = '1-2' | '3-4' | '5-6'

/**
 * Yang menyala per jenjang, selain tiga mapel harian. Olimpiade menyala hanya atas pilihan orang tua, karena lebih berat.
 * Paper tetap menyala di semua kelas: di hari Seimbang (bawaan keluarga baru) Paper dan Tes memang opsional.
 * Quiz Arena banyak membaca, jadi mulai kelas 3. Setiap fitur di sini punya konten untuk kelas itu (diuji recommendation.test.ts).
 */
const CORE: FeatureKey[] = ['drill-math', 'mental-math', 'vocab', 'flashcards', 'reading-room', 'english-skills', 'paper', 'kira-world', 'dictionary', 'manipulatives', 'placement']
const EXTRAS: Record<Band, FeatureKey[]> = {
  '1-2': CORE,
  '3-4': [...CORE, 'quiz-arena'],
  '5-6': [...CORE, 'quiz-arena'],
}

/** Tiga hal yang disebut dalam kalimat penjelasan, urut dari yang paling terasa bagi jenjang itu. */
const HIGHLIGHTS: Record<Band, FeatureKey[]> = {
  '1-2': ['flashcards', 'reading-room', 'mental-math'],
  '3-4': ['reading-room', 'mental-math', 'quiz-arena'],
  '5-6': ['reading-room', 'quiz-arena', 'paper'],
}

const DAILY_SUBJECTS: FeatureSubject[] = ['math', 'english', 'science']
const SUBJECT_NAME: Record<FeatureSubject, string> = { math: 'Math', english: 'English', science: 'Science' }

export type Recommendation = {
  grade: number
  /** Mapel harian yang menyala. */
  subjects: FeatureSubject[]
  /** Semua fitur yang menyala, termasuk mapel. */
  on: FeatureKey[]
  /** Fitur yang dimatikan. */
  off: FeatureKey[]
  /** Peta siap simpan: hanya kunci yang mati (kunci yang tidak ada berarti menyala). */
  features: FeatureMap
}

function bandOf(grade: number): Band {
  if (!Number.isInteger(grade) || grade < 1 || grade > 6) throw new RangeError(`Kelas di luar 1 sampai 6: ${grade}`)
  return grade <= 2 ? '1-2' : grade <= 4 ? '3-4' : '5-6'
}

export function recommendationFor(grade: number): Recommendation {
  const band = bandOf(grade)
  const on: FeatureKey[] = [...DAILY_SUBJECTS, ...EXTRAS[band]]
  const off = FEATURE_KEYS.filter((k) => !on.includes(k))
  const features: FeatureMap = {}
  for (const k of off) features[k] = false
  return { grade, subjects: [...DAILY_SUBJECTS], on, off, features }
}

function joinId(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')}, dan ${items[items.length - 1]}`
}

/** Satu kalimat polos tentang apa yang didapat anak. */
export function recommendationSummary(name: string, grade: number): string {
  const r = recommendationFor(grade)
  const subjects = joinId(r.subjects.map((s) => SUBJECT_NAME[s]))
  const extras = joinId(HIGHLIGHTS[bandOf(grade)].map((k) => FEATURE_LABEL[k]))
  return `${name} belajar ${subjects} setiap hari, ditambah ${extras}.`
}
