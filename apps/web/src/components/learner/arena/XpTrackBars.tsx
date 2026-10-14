import type { CSSProperties, ReactElement } from 'react'
import type { XpTrackDTO } from '@/lib/dto-arena'
import { cx } from '@/components/ui/cx'
import { TRACK_TONE } from './tone'

/**
 * Tiga bar XP: Belajar (kuning bintang), Quick Maths (ungu), Quiz (biru tua). Warna selalu ditemani label,
 * angka level, dan sisa XP. `compact` untuk halaman Today, `full` untuk Me dan hasil ronde.
 */
export function XpTrackBars({ tracks, variant = 'full', only, className }: { tracks: XpTrackDTO[]; variant?: 'compact' | 'full'; only?: XpTrackDTO['track']; className?: string }): ReactElement {
  const list = only ? tracks.filter((t) => t.track === only) : tracks
  return (
    <ul aria-label="XP and levels" className={cx('m-0 grid list-none gap-3 p-0', variant === 'compact' ? 'sm:grid-cols-3' : only ? '' : 'md:grid-cols-3', className)}>
      {list.map((t) => {
        const tone = TRACK_TONE[t.track]
        return (
          <li key={t.track} className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className={cx('text-body font-bold', tone.text)}>{t.track === 'belajar' ? 'Learning' : t.name}</span>
              <span className="font-display text-h2 leading-none font-semibold tabular-nums">Level {t.level}</span>
            </div>
            <span role="img" aria-label={`${t.name}, level ${t.level}. ${t.line}`} className="flex h-3 overflow-hidden rounded-control bg-divider">
              <span className={cx('kira-bar-fill', tone.bar)} style={{ '--p': Math.min(1, Math.max(0, t.percent / 100)) } as CSSProperties} />
            </span>
            <span className="text-body text-fg-muted tabular-nums">{t.line}</span>
          </li>
        )
      })}
    </ul>
  )
}
