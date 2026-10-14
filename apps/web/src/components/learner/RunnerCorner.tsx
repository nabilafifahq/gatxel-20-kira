'use client'

import type { ReactElement } from 'react'
import type { AvatarName, LearnerShell } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { ComboStars } from './ComboStars'
import { Mascot, mascotMoodFor } from './Mascot'
import { XpFly } from './XpFly'

/**
 * Sudut kecil di runner: maskot yang bereaksi (melompat saat benar, mengangguk setelah Not yet, berpikir di soal
 * berwaktu), bintang kombo, dan "+XP" yang naik. Semua hiasan: tidak menangkap sentuhan dan tidak menjadi
 * satu-satunya penanda hasil (ikon, warna, dan teks tetap ada di lembar umpan balik).
 * Induknya harus `relative`.
 */
export function RunnerCorner({
  shell,
  phase,
  timed = false,
  streak,
  xp,
  nonce,
  className,
}: {
  shell: Pick<LearnerShell, 'avatar' | 'accessory' | 'background'>
  phase: string
  timed?: boolean
  streak: number
  xp: number
  nonce: string | number
  className?: string
}): ReactElement {
  const mood = mascotMoodFor({ phase, timed })
  return (
    <div className={cx('pointer-events-none absolute top-0 right-0 z-10 flex items-center gap-2', className)}>
      <ComboStars streak={streak} className="max-sm:hidden" />
      <div className="relative">
        <Mascot
          name={shell.avatar as AvatarName}
          mood={mood}
          size={44}
          accessory={shell.accessory ?? null}
          background={shell.background ?? null}
          replayKey={nonce}
        />
        {phase === 'correct' ? (
          <XpFly xp={xp} nonce={nonce} className="top-0 right-1" toward={{ x: -24, y: -72 }} />
        ) : null}
      </div>
    </div>
  )
}
