'use client'

import type { ReactElement } from 'react'
import { Avatar } from '@kira/figures'
import type { AvatarName } from '@/lib/dto'
import { cx } from '@/components/ui/cx'

/**
 * Maskot: hewan avatar anak yang bergerak (DESIGN.md bagian 6b). Gerakan memakai transform CSS pada
 * pembungkus SVG; kedipan memakai kelas `kira-eyes` di mata avatar. Suasana:
 * - idle: bernapas pelan dan berkedip (satu-satunya gerak berulang)
 * - cheer: melompat kecil sekali, untuk jawaban benar
 * - think: miring pelan selama soal berwaktu
 * - encourage: mengangguk lembut setelah "Not yet"
 * - celebrate: melompat dua kali di halaman hasil
 * Reduced motion: semua gerak mati dan avatar diam. Maskot hiasan (aria-hidden), tidak pernah menerima fokus.
 */
export type MascotMood = 'idle' | 'cheer' | 'think' | 'encourage' | 'celebrate'

export function Mascot({
  name,
  mood = 'idle',
  size = 64,
  accessory,
  background,
  className,
  replayKey,
}: {
  name: AvatarName
  mood?: MascotMood
  size?: number
  accessory?: string | null
  background?: string | null
  className?: string
  /** Ganti nilainya untuk memutar ulang gerak sekali (misalnya nomor soal). */
  replayKey?: string | number
}): ReactElement {
  return (
    <span
      key={`${mood}:${replayKey ?? ''}`}
      aria-hidden="true"
      data-mood={mood === 'idle' ? undefined : mood}
      className={cx('kira-mascot pointer-events-none select-none', className)}
    >
      <Avatar name={name} size={size} accessory={accessory} background={background} />
    </span>
  )
}

/**
 * Suasana maskot dari keadaan soal di runner: jawaban benar melompat, Not yet mengangguk, soal berwaktu berpikir.
 */
export function mascotMoodFor(input: { phase: string; timed: boolean }): MascotMood {
  if (input.phase === 'correct') return 'cheer'
  if (input.phase === 'not-yet' || input.phase === 'revealed') return 'encourage'
  if (input.timed) return 'think'
  return 'idle'
}
