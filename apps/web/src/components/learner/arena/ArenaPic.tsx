import type { ReactElement } from 'react'
import { Icon, PlanetArt } from '@kira/figures'
import type { Pic } from '@kira/content/knowledge'
import { cx } from '@/components/ui/cx'

/**
 * Gambar untuk soal Quiz Arena: bendera dari /flags (SVG milik sendiri, flag-icons MIT), ikon @kira/figures,
 * atau planet. Semua disajikan dari server sendiri; tanpa emoji dan tanpa aset luar.
 */
export function ArenaPic({ pic, label, size = 96, className }: { pic: Pic; label?: string; size?: number; className?: string }): ReactElement {
  if (pic.t === 'flag') {
    return (
      // Bendera berbingkai tipis supaya warna putih tetap terlihat di atas latar putih.
      <img
        src={`/flags/4x3/${pic.code}.svg`}
        alt={label ?? ''}
        width={Math.round((size * 4) / 3)}
        height={size}
        loading="lazy"
        decoding="async"
        className={cx('flex-none rounded-control border border-divider object-cover', className)}
        style={{ width: Math.round((size * 4) / 3), height: size }}
      />
    )
  }
  if (pic.t === 'planet') return <PlanetArt name={pic.name} size={size} {...(label ? { title: label } : {})} className={cx('flex-none', className)} />
  return <Icon name={pic.name} size={size} {...(label ? { title: label } : {})} className={cx('flex-none', className)} />
}
