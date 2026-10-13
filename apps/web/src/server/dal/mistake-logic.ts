import type { MistakeType } from '@/lib/dto-paper'

/**
 * Logika murni Buku Salah (rencana 10.6): jenis kesalahan dari perilaku jawaban, dan ringkasan untuk tutor.
 * Jenis kesalahan sengaja sederhana dan bisa dijelaskan: dihitung dari status, waktu, dan tingkat soal,
 * tanpa AI, supaya laporan tutor selalu ada dan tidak memakai kuota.
 */

/** Salah dalam waktu sependek ini dianggap menebak atau terburu-buru. */
export const RUSHED_MS = 4_000
/** Salah setelah selama ini dianggap lama tetapi tetap salah. */
export const SLOW_MS = 60_000
/** Soal mudah menurut tingkat kesulitannya. */
export const EASY_MAX = 2

export const MISTAKE_TYPES: readonly MistakeType[] = ['blank', 'rushed', 'slow', 'careless', 'concept']

export const MISTAKE_LABEL: Record<MistakeType, string> = {
  blank: 'Tidak dijawab',
  rushed: 'Terlalu cepat, mungkin menebak',
  slow: 'Lama dipikirkan tetapi tetap salah',
  careless: 'Salah di soal yang mudah',
  concept: 'Konsep belum kuat',
}

export const MISTAKE_ADVICE: Record<MistakeType, string> = {
  blank: 'Waktu habis atau soal dilewati. Latih mengerjakan soal yang pasti bisa dulu, lalu kembali ke yang sulit.',
  rushed: 'Jawaban dipilih dalam beberapa detik. Ajak Syakira membaca soal sampai selesai dan mencoret pilihan yang pasti salah.',
  slow: 'Waktunya habis di satu soal. Ajarkan melompati soal sulit dan kembali kalau waktu masih ada.',
  careless: 'Soalnya mudah tetapi salah. Biasanya salah hitung atau salah baca; minta Syakira memeriksa ulang jawabannya sebelum lanjut.',
  concept: 'Soal sedang atau sulit dijawab dengan serius tetapi salah. Ulangi pelajaran skill itu, lalu latihan pendek.',
}

export type MistakeSample = { status: 'wrong' | 'blank'; timeMs: number; difficulty: number; expectedSeconds?: number | null }

/** Jenis kesalahan satu jawaban. Waktu 0 berarti tidak dicatat (misalnya jawaban dari LJK), jadi tidak dipakai. */
export function classifyMistake(s: MistakeSample): MistakeType {
  if (s.status === 'blank') return 'blank'
  const known = s.timeMs > 0
  const expectedMs = (s.expectedSeconds ?? 0) * 1000
  if (known && s.timeMs <= Math.max(RUSHED_MS, expectedMs > 0 ? expectedMs * 0.15 : 0) && s.difficulty > EASY_MAX) return 'rushed'
  if (known && s.timeMs >= (expectedMs > 0 ? expectedMs * 2 : SLOW_MS)) return 'slow'
  return s.difficulty <= EASY_MAX ? 'careless' : 'concept'
}

export type TypeSummary = { type: MistakeType; label: string; count: number; percent: number; advice: string }

/** Jenis kesalahan yang paling sering di atas, dengan persentase dari seluruh kesalahan terbuka. */
export function summariseTypes(types: readonly MistakeType[]): TypeSummary[] {
  const counts = new Map<MistakeType, number>()
  for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1)
  const total = types.length
  return MISTAKE_TYPES.filter((t) => (counts.get(t) ?? 0) > 0)
    .map((t) => ({ type: t, label: MISTAKE_LABEL[t], count: counts.get(t)!, percent: total ? Math.round((100 * counts.get(t)!) / total) : 0, advice: MISTAKE_ADVICE[t] }))
    .sort((a, b) => b.count - a.count || MISTAKE_TYPES.indexOf(a.type) - MISTAKE_TYPES.indexOf(b.type))
}

export type SkillCount = { skillId: string; count: number }

/** Skill yang paling sering salah, paling banyak `limit`. */
export function topSkills(skillIds: readonly string[], limit = 5): SkillCount[] {
  const counts = new Map<string, number>()
  for (const s of skillIds) counts.set(s, (counts.get(s) ?? 0) + 1)
  return [...counts.entries()]
    .map(([skillId, count]) => ({ skillId, count }))
    .sort((a, b) => b.count - a.count || a.skillId.localeCompare(b.skillId))
    .slice(0, limit)
}

/** Pilih paling banyak `size` soal untuk sesi ulang, bergiliran antar-skill supaya tidak satu skill saja. */
export function pickRedoItems<T extends { skillId: string }>(open: readonly T[], size: number, shuffle: <U>(xs: readonly U[]) => U[]): T[] {
  const bySkill = new Map<string, T[]>()
  for (const m of shuffle(open)) bySkill.set(m.skillId, [...(bySkill.get(m.skillId) ?? []), m])
  const queues = shuffle([...bySkill.values()])
  const out: T[] = []
  while (out.length < size && queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      const x = q.shift()
      if (x && out.length < size) out.push(x)
    }
  }
  return out
}

/** Awalan ref_id attempt sesi ulang; dipakai untuk mengenali sesi ulang dan mengecualikannya dari sumber kesalahan. */
export const REDO_REF_PREFIX = 'buku-salah'
export const REDO_SIZE = 10
