/**
 * XP dan level.
 * Jawaban benar: tingkat 1 sampai 2 = 10, tingkat 3 = 15, tingkat 4 sampai 5 = 20.
 * Benar dengan hint atau pada percobaan kedua: separuh.
 * Quest selesai +20, semua benar tanpa hint +10, quest bonus selesai +30.
 * Sesi harian: Latihan +20, Tes +25, Paper +30, semua benar +10. Percobaan ulang sesi memberi 25 persen.
 * Level L dicapai saat XP >= 50 x (L - 1) x L, jadi level 2 di 100 XP, level 3 di 300 XP.
 */

export function baseXp(difficulty: number): number {
  if (difficulty >= 4) return 20
  if (difficulty >= 3) return 15
  return 10
}

export function answerXp(input: { difficulty: number; correct: boolean; hintsUsed: number; attemptNo?: number }): number {
  if (!input.correct) return 0
  const base = baseXp(input.difficulty)
  const reduced = input.hintsUsed > 0 || (input.attemptNo ?? 1) > 1
  return reduced ? Math.round(base / 2) : base
}

export const QUEST_COMPLETE_XP = 20
export const QUEST_PERFECT_XP = 10
export const BONUS_QUEST_XP = 30

export function questCompletionXp(input: { bonus: boolean; perfect: boolean }): number {
  return (input.bonus ? BONUS_QUEST_XP : QUEST_COMPLETE_XP) + (input.perfect ? QUEST_PERFECT_XP : 0)
}

/** Percobaan ulang seluruh sesi memberi 25 persen XP, supaya tidak dipakai untuk menimbun XP. */
export const RETRY_XP_PERCENT = 25

export function retryXp(amount: number): number {
  if (amount <= 0) return 0
  return Math.max(1, Math.round((amount * RETRY_XP_PERCENT) / 100))
}

const SESSION_XP: Record<string, number> = { latihan: 20, tes: 25, paper: 30 }

/** XP selesai satu sesi harian; sesi lain (opsional) memberi 20. Semua benar tanpa hint menambah 10. */
export function sessionCompletionXp(input: { session: string; perfect: boolean; retry?: boolean }): number {
  const base = (SESSION_XP[input.session] ?? QUEST_COMPLETE_XP) + (input.perfect ? QUEST_PERFECT_XP : 0)
  return input.retry ? retryXp(base) : base
}

export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level))
  return 50 * (l - 1) * l
}

export function levelForXp(xp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  return level
}

export function levelProgress(xp: number): { level: number; into: number; span: number; toNext: number } {
  const level = levelForXp(xp)
  const start = xpForLevel(level)
  const end = xpForLevel(level + 1)
  return { level, into: xp - start, span: end - start, toNext: end - xp }
}
