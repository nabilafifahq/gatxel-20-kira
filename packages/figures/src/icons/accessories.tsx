import type { ReactElement } from 'react'
import { ENGLISH, INK, KNOWLEDGE, MENTAL, SCIENCE, STAR, WARN, WARN_50, WHITE } from '../palette'

/**
 * Aksesori avatar 64 x 64, digambar di atas avatar hewan (lingkaran putih bergaris tinta). Posisi mengikuti
 * kepala semua delapan avatar: mata sekitar y 31 sampai 33, kepala dari y 11 sampai 55. Id sama dengan
 * ACCESSORY_IDS di @kira/core.
 */

export const ACCESSORY_ART_IDS = ['star-pin', 'scarf', 'crown', 'visor', 'glasses', 'headphones', 'bow-tie', 'explorer-hat', 'laurel'] as const
export type AccessoryArtId = (typeof ACCESSORY_ART_IDS)[number]

const line = { fill: 'none', stroke: INK, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function leaf(x: number, y: number, angle: number): ReactElement {
  return <ellipse cx={x} cy={y} rx={4.6} ry={2.3} fill={SCIENCE} stroke={INK} strokeWidth={1.4} transform={`rotate(${angle} ${x} ${y})`} />
}

export const ACCESSORY_ART: Record<AccessoryArtId, ReactElement> = {
  'star-pin': (
    <g {...line}>
      <path d="M50 41.5l2.3 4.8 5.2.7-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.7 5.2-.7z" fill={STAR} />
    </g>
  ),
  scarf: (
    <g {...line}>
      <path d="M13 49c6 5 32 5 38 0l-1.5 7c-6 3.5-29 3.5-35 0z" fill={ENGLISH} />
      <path d="M40 53.5l3 8.5 5-1.3-2-8z" fill={ENGLISH} />
      <path d="M21 52.4l.5 1.6M27 53.8l.3 1.7M33 54.1l0 1.7" strokeWidth={1.6} stroke={WARN_50} />
    </g>
  ),
  crown: (
    <g {...line}>
      <path d="M19.5 15.5l1.7-9.5 6.3 5.3 4.5-8 4.5 8 6.3-5.3 1.7 9.5z" fill={STAR} />
      <circle cx="32" cy="12.2" r="1.3" fill={ENGLISH} stroke="none" />
      <circle cx="24.6" cy="12.6" r="1.1" fill={MENTAL} stroke="none" />
      <circle cx="39.4" cy="12.6" r="1.1" fill={KNOWLEDGE} stroke="none" />
    </g>
  ),
  visor: (
    <g {...line}>
      <path d="M13.5 26c1.5-9 12-12 18.5-12s17 3 18.5 12z" fill={MENTAL} />
      <path d="M11 26h42l-3.5 4.3h-35z" fill={MENTAL} />
      <path d="M25 17.5c4-1.4 10-1.4 14 0" stroke={WHITE} strokeWidth={1.6} />
    </g>
  ),
  glasses: (
    <g {...line}>
      <circle cx="24" cy="32" r="7.4" fill={WHITE} fillOpacity={0.28} />
      <circle cx="40" cy="32" r="7.4" fill={WHITE} fillOpacity={0.28} />
      <path d="M31.4 31.4c.4-.9 1.2-.9 1.2 0M16.6 31l-4.6-2M47.4 31l4.6-2" />
    </g>
  ),
  headphones: (
    <g {...line}>
      <path d="M11 37C8.5 12 55.5 12 53 37" strokeWidth={3.2} />
      <rect x="6.6" y="32" width="8.4" height="14" rx="3.4" fill={MENTAL} />
      <rect x="49" y="32" width="8.4" height="14" rx="3.4" fill={MENTAL} />
    </g>
  ),
  'bow-tie': (
    <g {...line}>
      <path d="M32 52.5L21 47.5v11z" fill={KNOWLEDGE} />
      <path d="M32 52.5l11-5v11z" fill={KNOWLEDGE} />
      <rect x="29.2" y="49.6" width="5.6" height="5.8" rx="1.8" fill={KNOWLEDGE} />
    </g>
  ),
  'explorer-hat': (
    <g {...line}>
      <path d="M21 19.5C20.5 5 43.5 5 43 19.5z" fill={STAR} />
      <path d="M20.6 16.6h22.8v3.4H20.6z" fill={WARN} />
      <path d="M8 21.5c4.5-3.2 12.5-3.4 24-3.4s19.5.2 24 3.4c-2.5 3.6-11 5.2-24 5.2S10.5 25.1 8 21.5z" fill={STAR} />
    </g>
  ),
  laurel: (
    <g {...line}>
      <path d="M17 52C6.5 44 5 28 12.5 17.5" strokeWidth={2.2} />
      <path d="M47 52c10.5-8 12-24 4.5-34.5" strokeWidth={2.2} />
      {leaf(10.5, 22, -70)}
      {leaf(8.2, 30, -95)}
      {leaf(8.6, 38.5, -118)}
      {leaf(12.2, 46, -140)}
      {leaf(17, 51.2, -160)}
      {leaf(53.5, 22, 70)}
      {leaf(55.8, 30, 95)}
      {leaf(55.4, 38.5, 118)}
      {leaf(51.8, 46, 140)}
      {leaf(47, 51.2, 160)}
    </g>
  ),
}

export function isAccessoryArtId(value: unknown): value is AccessoryArtId {
  return typeof value === 'string' && (ACCESSORY_ART_IDS as readonly string[]).includes(value)
}
