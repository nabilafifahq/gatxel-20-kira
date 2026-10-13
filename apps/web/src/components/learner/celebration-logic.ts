/**
 * Logika perayaan akhir sesi tanpa React: bintang 1 sampai 3, kapan confetti keluar, dan isi bar XP.
 * Confetti hanya di akhir sesi (DESIGN.md bagian 6a), tidak pernah per jawaban benar.
 */

export type Stars = 1 | 2 | 3

/** Bintang dari soal yang sudah dinilai: 90 persen ke atas 3, 60 persen ke atas 2, selain itu 1. Belum ada nilai: null. */
export function starsFor(input: { right: number; total: number; pending: number }): Stars | null {
  const scored = input.total - input.pending
  if (scored <= 0) return null
  const ratio = input.right / scored
  if (ratio >= 0.9) return 3
  if (ratio >= 0.6) return 2
  return 1
}

/** Confetti untuk 2 bintang ke atas. Sesi dengan 1 bintang dirayakan dengan bunyi dan bar XP saja. */
export function confettiFor(stars: Stars | null): boolean {
  return stars !== null && stars >= 2
}

export type LevelPoint = { level: number; into: number; span: number }

export type XpBarView = {
  /** Isi bar saat mulai dan sesudah terisi, 0 sampai 1. */
  from: number
  to: number
  level: number
  leveledUp: boolean
  line: string
}

function fraction(p: LevelPoint): number {
  return p.span > 0 ? Math.min(1, Math.max(0, p.into / p.span)) : 0
}

/** Naik level: bar mulai dari kosong di level baru. Selain itu bar terisi dari posisi sebelumnya. */
export function xpBarView(bar: { before: LevelPoint; after: LevelPoint }): XpBarView {
  const leveledUp = bar.after.level > bar.before.level
  return {
    from: leveledUp ? 0 : fraction(bar.before),
    to: fraction(bar.after),
    level: bar.after.level,
    leveledUp,
    line: `${bar.after.into} of ${bar.after.span} XP to level ${bar.after.level + 1}`,
  }
}
