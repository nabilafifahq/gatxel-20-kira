/**
 * Dompet bintang Kira World. Bintang hanya didapat dari belajar dan tidak berkurang karena libur.
 * Semua angka dipakai server; layar hanya menampilkan hasilnya.
 */

export const STAR_REASONS = ['session', 'perfect', 'reading', 'drill', 'boss', 'spend'] as const
export type StarReason = (typeof STAR_REASONS)[number]

/** Bintang untuk satu sesi wajib yang selesai: 3, ditambah 2 bila sempurna. Ulangan sesi tidak memberi bintang. */
export function sessionStars(input: { perfect: boolean; retry: boolean }): { base: number; perfect: number } {
  if (input.retry) return { base: 0, perfect: 0 }
  return { base: 3, perfect: input.perfect ? 2 : 0 }
}

/** Bab Reading: 2 bintang pertama, lalu 1, lalu 1, lalu berhenti hari itu. */
export const READING_STARS_BY_COUNT = [2, 1, 1] as const
/** Drill (Quick Maths dan Quiz Arena): 2, 1, 1, lalu berhenti hari itu. */
export const DRILL_STARS_BY_COUNT = [2, 1, 1] as const

/** Bintang untuk kejadian ke-(doneToday + 1) hari ini. 0 bila batas hari ini penuh. */
export function diminishing(table: readonly number[], doneToday: number): number {
  return table[doneToday] ?? 0
}

/** Bintang bos: menang memberi 10 bintang sekali per minggu, mencoba lagi tidak memberi apa pun dan tidak mengurangi. */
export const BOSS_WIN_STARS = 10
/** Menang bila benar sedikitnya 7 dari 10. */
export const BOSS_WIN_AT = 7
export const BOSS_QUESTIONS = 10

/** Sertifikat milestone streak (hari). */
export const CERTIFICATE_DAYS = [7, 30, 100] as const
export type CertificateDays = (typeof CERTIFICATE_DAYS)[number]

/** Hari sebuah tonggak streak sudah tercapai oleh streak terbaik. */
export function certificatesFor(bestStreak: number): CertificateDays[] {
  return CERTIFICATE_DAYS.filter((d) => bestStreak >= d)
}

/** Menang bila benar sedikitnya 70 persen dari soal yang ada (7 dari 10, 6 dari 8). */
export function bossWinAt(total: number): number {
  return Math.max(3, Math.ceil(total * 0.7))
}
