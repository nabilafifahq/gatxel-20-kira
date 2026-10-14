/**
 * Keterampilan English (rencana bagian 12), dipetakan ke Cambridge Young Learners:
 * Pre A1 Starters, A1 Movers, A2 Flyers. Empat keterampilan: listening, reading, writing, speaking.
 * Modul murni, dipakai halaman English Skills, pemilih sesi, dan uji.
 */

export const YLE_LEVELS = [
  { id: 'starters', name: 'Starters', cefr: 'Pre A1', grades: [1, 2] },
  { id: 'movers', name: 'Movers', cefr: 'A1', grades: [3, 4] },
  { id: 'flyers', name: 'Flyers', cefr: 'A2', grades: [5, 6] },
] as const
export type YleLevelId = (typeof YLE_LEVELS)[number]['id']
export type YleLevel = (typeof YLE_LEVELS)[number]

export const ENGLISH_AREAS = ['listening', 'reading', 'writing', 'speaking'] as const
export type EnglishArea = (typeof ENGLISH_AREAS)[number]

/** Sesi yang dibuat halaman English Skills. Reading memakai peta English yang sudah ada. */
export const ENGLISH_SESSION_AREAS = ['listening', 'speaking', 'writing'] as const
export type EnglishSessionArea = (typeof ENGLISH_SESSION_AREAS)[number]

export function isEnglishSessionArea(v: unknown): v is EnglishSessionArea {
  return typeof v === 'string' && (ENGLISH_SESSION_AREAS as readonly string[]).includes(v)
}

export function yleLevelOfGrade(grade: number): YleLevel {
  return YLE_LEVELS.find((l) => (l.grades as readonly number[]).includes(grade)) ?? YLE_LEVELS[0]
}

/** Id skill sesi English Skills untuk kelas itu, misalnya e2.starters-listening. */
export function sessionSkillId(grade: number, area: EnglishSessionArea): string {
  return `e${grade}.${yleLevelOfGrade(grade).id}-${area}`
}

/** Referensi attempt English Skills (kolom attempt.ref_id): english:listening, english:speaking, english:writing. */
export function sessionRef(area: EnglishSessionArea): string {
  return `english:${area}`
}

export function areaOfSessionRef(ref: string | null | undefined): EnglishSessionArea | null {
  if (!ref || !ref.startsWith('english:')) return null
  const area = ref.slice('english:'.length)
  return isEnglishSessionArea(area) ? area : null
}

const READING = new Set(['Rw', 'Rv', 'Rg', 'Rs', 'Ri', 'Ra'])
const WRITING = new Set(['Ww', 'Wv', 'Wg', 'Ws', 'Wc', 'Wp'])

/**
 * Keterampilan Cambridge untuk satu skill English. Strand R* adalah reading, W* writing. Strand SL
 * (berbicara dan menyimak) dibagi: skill yang namanya memuat speak, speaking, atau talk adalah speaking,
 * sisanya listening.
 */
export function yleAreaOfSkill(skillId: string, strand: string): EnglishArea {
  if (READING.has(strand)) return 'reading'
  if (WRITING.has(strand)) return 'writing'
  const name = skillId.slice(skillId.indexOf('.') + 1)
  return /(^|-)(speak|speaking|talk|talking|discussing|presenting)(-|$)/.test(name) ? 'speaking' : 'listening'
}

/** Kelompok skill English satu kelas menurut keterampilan Cambridge. */
export function groupByArea<T extends { id: string; strand: string }>(skills: readonly T[]): Record<EnglishArea, T[]> {
  const out: Record<EnglishArea, T[]> = { listening: [], reading: [], writing: [], speaking: [] }
  for (const s of skills) out[yleAreaOfSkill(s.id, s.strand)].push(s)
  return out
}

/**
 * Apakah attempt ini latihan Reading? Sesi quest bertipe reading, atau latihan dari peta yang semua
 * skill-nya bagian reading. Latihan, Tes, dan Paper harian tidak dihitung kecuali sesinya reading.
 */
export function isReadingAttempt(input: { questSession: string | null; skills: readonly { id: string; strand: string }[] }): boolean {
  if (input.questSession === 'reading') return true
  if (input.questSession !== null) return false
  return input.skills.length > 0 && input.skills.every((s) => yleAreaOfSkill(s.id, s.strand) === 'reading')
}
