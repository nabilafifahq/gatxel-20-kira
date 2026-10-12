import type { ReactElement } from 'react'
import type { AvatarName, IconName } from '../spec'
import { ICON_GLYPHS } from './glyphs'
import { AVATAR_GLYPHS } from './avatars'

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

export function Avatar({ name, size = 64, title, className }: { name: AvatarName; size?: number; title?: string; className?: string }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      {AVATAR_GLYPHS[name]}
    </svg>
  )
}
