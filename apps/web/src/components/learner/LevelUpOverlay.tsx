'use client'

import { useEffect, type CSSProperties, type ReactElement } from 'react'
import type { XpTrack } from '@kira/core'
import type { AvatarName } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { useT } from '@/lib/i18n/client'
import { Mascot } from './Mascot'

/**
 * Momen naik level layar penuh, berwarna jalur XP: belajar kuning, Quick Maths lilac, Quiz biru muda.
 * Tidak menjebak fokus: bukan dialog modal, tombol Continue bisa dijangkau tab biasa, dan overlay
 * hilang sendiri setelah beberapa detik. Cincin melebar dan angka level masuk (transform dan opacity).
 */

const TONE: Record<XpTrack, { bg: string; fg: string; ring: string }> = {
  belajar: { bg: 'bg-star', fg: 'text-fg', ring: 'border-fg' },
  hitung: { bg: 'bg-mental', fg: 'text-fg', ring: 'border-fg' },
  pengetahuan: { bg: 'bg-knowledge', fg: 'text-fg', ring: 'border-fg' },
}

export const LEVEL_UP_MS = 3200

export function LevelUpOverlay({
  track,
  level,
  avatar,
  onDone,
}: {
  track: XpTrack
  level: number
  avatar: AvatarName
  onDone: () => void
}): ReactElement {
  const t = useT()
  const tone = TONE[track]
  const trackName = t.shell.levelUp.track[track]
  useEffect(() => {
    const id = window.setTimeout(onDone, LEVEL_UP_MS)
    return () => window.clearTimeout(id)
  }, [onDone])
  return (
    <div
      role="status"
      aria-label={t.shell.levelUp.aria(level, trackName)}
      className={cx(
        'kira-fade-in fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-6 text-center',
        tone.bg,
        tone.fg,
      )}
    >
      <span aria-hidden="true" className="relative flex h-56 w-56 items-center justify-center">
        <span className={cx('kira-ring absolute inset-0 rounded-pill border-4', tone.ring)} />
        <span
          className={cx('kira-ring absolute inset-0 rounded-pill border-4', tone.ring)}
          style={{ '--kira-delay': '350ms' } as CSSProperties}
        />
        <span className="kira-scale-in font-numbers text-[120px] leading-none font-semibold tabular-nums">
          {level}
        </span>
      </span>
      <Mascot name={avatar} mood="celebrate" size={88} />
      <p className="m-0 font-display text-display font-semibold">{t.shell.levelUp.title}</p>
      <p className="m-0 text-h3 font-bold">
        {t.shell.levelUp.trackLevel(trackName, level)}
      </p>
      <button
        type="button"
        onClick={onDone}
        className={cx(
          'mt-2 h-14 rounded-control border-2 px-8 text-body-lg font-bold',
          'border-fg bg-surface text-fg',
        )}
      >
        {t.common.continue}
      </button>
    </div>
  )
}
