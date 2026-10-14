import type { ReactElement } from 'react'
import type { AvatarName, IconName } from '../spec'
import { ICON_GLYPHS } from './glyphs'
import { AVATAR_GLYPHS } from './avatars'
import { ACCESSORY_ART, CHEST_ACCESSORY_ART, avatarBackgroundArt, isAccessoryArtId, isAvatarBackgroundId, isChestArtId } from './accessories'
import { PLANET_GLYPHS, type PlanetArtName } from './planets'

/**
 * Ikon 48 x 48 bergaris tinta. `ICON_GLYPHS[name]` berisi elemen SVG tanpa
 * pembungkus, jadi bisa dipakai di dalam figur lain lewat <IconGlyph>.
 */

export function IconGlyph({ name, x = 0, y = 0, size = 48 }: { name: IconName; x?: number; y?: number; size?: number }): ReactElement {
  const s = size / 48
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{ICON_GLYPHS[name]}</g>
}

export function Icon({ name, size = 48, title, className }: { name: IconName; size?: number; title?: string; className?: string }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      {ICON_GLYPHS[name]}
    </svg>
  )
}

export function Avatar({ name, size = 64, title, className, accessory, background }: { name: AvatarName; size?: number; title?: string; className?: string; accessory?: string | null; background?: string | null }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      {AVATAR_GLYPHS[name]}
      {background && isAvatarBackgroundId(background) ? avatarBackgroundArt(background) : null}
      {accessory && isAccessoryArtId(accessory) ? ACCESSORY_ART[accessory] : accessory && isChestArtId(accessory) ? CHEST_ACCESSORY_ART[accessory] : null}
    </svg>
  )
}

/** Planet, Matahari, atau Bulan untuk Quiz Arena. */
export function PlanetArt({ name, size = 48, title, className }: { name: PlanetArtName; size?: number; title?: string; className?: string }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      {PLANET_GLYPHS[name]}
    </svg>
  )
}
