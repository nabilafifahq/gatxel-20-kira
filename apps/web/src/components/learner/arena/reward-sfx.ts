import { playSfx } from '../sfx'

/**
 * Bunyi akhir ronde arena: selesai, lalu naik level dan lencana baru bergantian seperti perayaan akhir sesi
 * (SessionCelebration). Hanya dipanggil sekali saat hasil ronde pertama kali tampil.
 */
export function playRoundEndSfx(reward: { levelUp: unknown; badges: readonly unknown[] }): void {
  playSfx('complete')
  let at = 700
  if (reward.levelUp) {
    window.setTimeout(() => playSfx('levelup'), at)
    at += 1100
  }
  if (reward.badges.length > 0) window.setTimeout(() => playSfx('badge'), at)
}
