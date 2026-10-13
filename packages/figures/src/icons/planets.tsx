import type { ReactElement } from 'react'
import { BORDER, ENGLISH, INK, MATH, MATH_50, MUTED, REVIEW, STAR, WARN, WARN_50, WHITE } from '../palette'
import { ICON_GLYPHS } from './glyphs'
import { ink } from './glyphs-kit'

/**
 * Planet, Matahari, dan Bulan untuk Quiz Arena (ukuran 48 x 48, gaya sama dengan ikon lain).
 * Bumi, Saturnus, Matahari, dan Bulan memakai ikon yang sudah ada.
 */

export const PLANET_ART_NAMES = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'sun', 'moon'] as const
export type PlanetArtName = (typeof PLANET_ART_NAMES)[number]

const R = 16

/** Lebar potongan lingkaran pada ketinggian y, supaya pita planet tidak keluar dari bulatannya. */
function chord(cy: number, y: number, r: number): number {
  const dy = y - cy
  return Math.sqrt(Math.max(0, r * r - dy * dy))
}

function band(y: number, color: string, width = 3.2): ReactElement {
  const w = chord(24, y, R - 1.2)
  return <path d={`M${24 - w} ${y}H${24 + w}`} stroke={color} strokeWidth={width} strokeLinecap="butt" />
}

export const PLANET_GLYPHS: Record<PlanetArtName, ReactElement> = {
  mercury: ink(
    <>
      <circle cx="24" cy="24" r={R} fill={REVIEW} />
      <circle cx="18" cy="19" r="2.8" fill={BORDER} strokeWidth="1.6" />
      <circle cx="30.5" cy="17" r="1.9" fill={BORDER} strokeWidth="1.6" />
      <circle cx="29" cy="29.5" r="3.4" fill={BORDER} strokeWidth="1.6" />
      <circle cx="18.5" cy="30.5" r="1.8" fill={BORDER} strokeWidth="1.6" />
    </>,
  ),
  venus: ink(
    <>
      <circle cx="24" cy="24" r={R} fill={STAR} />
      <path d="M10.5 19c4.5 3 9-3 13.500 0s9 3 13.500 0" stroke={WARN} strokeWidth="2" />
      <path d="M9 26c4.5 3 10-3 15 0s10 3 15 0" stroke={WARN} strokeWidth="2" />
      <path d="M12 33c4 2.5 8-2.5 12 0s8 2.5 12 0" stroke={WARN} strokeWidth="2" />
    </>,
  ),
  earth: ICON_GLYPHS.earth,
  mars: ink(
    <>
      <circle cx="24" cy="24" r={R} fill={ENGLISH} />
      <ellipse cx="24" cy="10.6" rx="5.4" ry="2.2" fill={WHITE} strokeWidth="1.6" />
      <circle cx="17" cy="22" r="3" fill={WARN} strokeWidth="1.6" />
      <circle cx="29.5" cy="27" r="3.6" fill={WARN} strokeWidth="1.6" />
      <circle cx="21" cy="32" r="1.8" fill={WARN} strokeWidth="1.6" />
    </>,
  ),
  jupiter: ink(
    <>
      <circle cx="24" cy="24" r="17" fill={WARN_50} />
      <g strokeWidth="0">
        <path d={`M${24 - chord(24, 14, 16)} 14H${24 + chord(24, 14, 16)}`} stroke={WARN} strokeWidth="3" />
        {band(21, ENGLISH, 2.6)}
        {band(31, WARN, 3.4)}
        {band(37, ENGLISH, 2.2)}
      </g>
      <ellipse cx="29.5" cy="27" rx="3.6" ry="2.2" fill={ENGLISH} strokeWidth="1.5" />
      <circle cx="24" cy="24" r="17" fill="none" />
    </>,
  ),
  saturn: ICON_GLYPHS.planet,
  uranus: ink(
    <>
      <ellipse cx="24" cy="24" rx="4" ry="19" fill="none" stroke={MUTED} strokeWidth="2" />
      <circle cx="24" cy="24" r="14" fill={MATH_50} />
      <path d="M24 10a14 14 0 0 0 0 28" stroke={MATH} strokeWidth="1.8" fill="none" />
      <path d="M21 8.3c2 .6 4 .6 6 0" stroke={MUTED} strokeWidth="2" />
    </>,
  ),
  neptune: ink(
    <>
      <circle cx="24" cy="24" r="15" fill={MATH} />
      <path d="M12 20c4-2.5 8 2 12 0s7-1.5 11 0" stroke={WHITE} strokeWidth="2" />
      <path d="M11 29c5 2.5 9-2 14 0s6 1 11-.5" stroke={WHITE} strokeWidth="2" />
      <circle cx="30" cy="24.5" r="2.4" fill={INK} stroke="none" />
    </>,
  ),
  sun: ICON_GLYPHS.sun,
  moon: ICON_GLYPHS.moon,
}

