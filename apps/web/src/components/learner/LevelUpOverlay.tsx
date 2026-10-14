'use client'

import { useEffect, type CSSProperties, type ReactElement } from 'react'
import type { XpTrack } from '@kira/core'
import type { AvatarName } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { Mascot } from './Mascot'

/**
 * Momen naik level layar penuh, berwarna jalur XP: belajar kuning, Quick Maths ungu, Quiz biru tua.
 * Tidak menjebak fokus: bukan dialog modal, tombol Continue bisa dijangkau tab biasa, dan overlay
 * hilang sendiri setelah beberapa detik. Cincin melebar dan angka level masuk (transform dan opacity).
 */

const TONE: Record<XpTrack, { bg: string; fg: string; ring: string; name: string }> = {
  belajar: { bg: 'bg-star', fg: 'text-fg', ring: 'border-fg', name: 'Learning' },
  hitung: { bg: 'bg-mental', fg: 'text-white', ring: 'border-white', name: 'Quick Maths' },
  pengetahuan: { bg: 'bg-knowledge', fg: 'text-white', ring: 'border-white', name: 'Quiz' },
}

export const LEVEL_UP_MS = 3200

export function LevelUpOverlay({ track, level, avatar, onDone }: { track: XpTrack; level: number; avatar: AvatarName; onDone: () => void }): ReactElement {
  const tone = TONE[track]
  useEffect(() => {
    const id = window.setTimeout(onDone, LEVEL_UP_MS)
    return () => window.clearTimeout(id)
  }, [onDone])
  return (
    <div role="status" aria-label={`Level ${level}. ${tone.name}. You levelled up!`} className={cx('kira-fade-in fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-6 text-center', tone.bg, tone.fg)}>
      <span aria-hidden="true" className="relative flex h-56 w-56 items-center justify-center">
        <span className={cx('kira-ring absolute inset-0 rounded-pill border-4', tone.ring)} />
        <span className={cx('kira-ring absolute inset-0 rounded-pill border-4', tone.ring)} style={{ '--kira-delay': '350ms' } as CSSProperties} />
        <span className="kira-scale-in font-display text-[120px] leading-none font-semibold tabular-nums">{level}</span>
      </span>
      <Mascot name={avatar} mood="celebrate" size={88} />
      <p className="m-0 font-display text-display font-semibold">You levelled up!</p>
      <p className="m-0 text-body-lg font-bold">
        {tone.name} level {level}
      </p>
      <button
        type="button"
        onClick={onDone}
        className={cx('mt-2 h-14 rounded-control border-2 px-8 text-body-lg font-bold', track === 'belajar' ? 'border-fg bg-surface text-fg' : 'border-white bg-white text-fg')}
      >
        Continue
      </button>
    </div>
  )
}
