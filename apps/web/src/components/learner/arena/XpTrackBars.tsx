'use client'

import type { CSSProperties, ReactElement } from 'react'
import type { XpTrackDTO } from '@/lib/dto-arena'
import { cx } from '@/components/ui/cx'
import { useT } from '@/lib/i18n/client'
import { TRACK_TONE } from './tone'

/**
 * Tiga bar XP: Belajar (kuning bintang), Quick Maths (ungu), Quiz (biru tua). Warna selalu ditemani label,
 * angka level, dan sisa XP. `compact` untuk halaman Today, `full` untuk Me dan hasil ronde.
 */
export function XpTrackBars({ tracks, variant = 'full', only, className }: { tracks: XpTrackDTO[]; variant?: 'compact' | 'full'; only?: XpTrackDTO['track']; className?: string }): ReactElement {
  const dict = useT().arena.tracks
  const list = only ? tracks.filter((t) => t.track === only) : tracks
  return (
    <ul aria-label={dict.list} className={cx('m-0 grid list-none gap-3 p-0', variant === 'compact' ? 'sm:grid-cols-3' : only ? '' : 'md:grid-cols-3', className)}>
      {list.map((t) => {
        const tone = TRACK_TONE[t.track]
        // Nama dan baris sisa XP disusun di sini dari angka DTO, supaya mengikuti bahasa anak di semua layar.
        const name = dict.name[t.track]
        const line = dict.line(t.into, t.span, t.level + 1)
        return (
          <li key={t.track} className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className={cx('text-body font-bold', tone.text)}>{name}</span>
              <span className="font-numbers text-h2 leading-none font-semibold tabular-nums">{dict.level(t.level)}</span>
            </div>
            <span role="img" aria-label={dict.aria(name, t.level, line)} className="flex h-3 overflow-hidden rounded-control bg-divider">
              <span className={cx('kira-bar-fill', tone.bar)} style={{ '--p': Math.min(1, Math.max(0, t.percent / 100)) } as CSSProperties} />
            </span>
            <span className="text-body text-fg-muted tabular-nums">{line}</span>
          </li>
        )
      })}
    </ul>
  )
}
