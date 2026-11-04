import type { ReactElement } from 'react'
import { Avatar } from '../icons'
import type { AvatarName } from '../spec'
import { DANGER, DIVIDER, ENGLISH, INK, MATH, MATH_50, SCIENCE, SCIENCE_50, STAR, WARN, WARN_50, WHITE, REVIEW } from '../palette'

/** Bingkai profil, medali, piala, dan segel sertifikat. Garis tinta 2,5 dan palet Brand Kit. */

const line = { stroke: INK, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const FRAME_ART_IDS = ['frame-leaf', 'frame-wave', 'frame-gold', 'frame-star'] as const

function ring(id: string): ReactElement {
  switch (id) {
    case 'frame-leaf':
      return (
        <g>
          <circle cx="32" cy="32" r="30" fill="none" stroke={SCIENCE} strokeWidth="5" />
          <circle cx="32" cy="32" r="30" fill="none" {...line} strokeWidth="1.500" />
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse key={i} cx="32" cy="3" rx="4.500" ry="2.500" fill={SCIENCE_50} {...line} strokeWidth="1.500" transform={`rotate(${i * 45} 32 32)`} />
          ))}
        </g>
      )
    case 'frame-wave':
      return (
        <g>
          <circle cx="32" cy="32" r="30" fill="none" stroke={MATH} strokeWidth="5" />
          {Array.from({ length: 12 }, (_, i) => (
            <circle key={i} cx="32" cy="3" r="2.600" fill={WHITE} stroke={INK} strokeWidth="1.500" transform={`rotate(${i * 30} 32 32)`} />
          ))}
        </g>
      )
    case 'frame-gold':
      return (
        <g>
          <circle cx="32" cy="32" r="30" fill="none" stroke={STAR} strokeWidth="6" />
          <circle cx="32" cy="32" r="33" fill="none" {...line} strokeWidth="1.600" />
          <circle cx="32" cy="32" r="27" fill="none" {...line} strokeWidth="1.600" />
        </g>
      )
    default:
      return (
        <g>
          <circle cx="32" cy="32" r="30" fill="none" stroke={ENGLISH} strokeWidth="5" />
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} d="M32 -1l2.300 4.700 5.200 0.700 -3.800 3.600 0.900 5.100 -4.600 -2.500 -4.600 2.500 0.900 -5.100 -3.800 -3.600 5.200 -0.700z" fill={STAR} stroke={INK} strokeWidth="1.400" strokeLinejoin="round" transform={`translate(0 3) rotate(${i * 60} 32 29)`} />
          ))}
        </g>
      )
  }
}

/** Avatar dengan bingkai profil dan aksesori. */
export function FramedAvatar({ name, size = 80, frame, accessory, background, title, className }: { name: AvatarName; size?: number; frame?: string | null; accessory?: string | null; background?: string | null; title?: string; className?: string }): ReactElement {
  const inner = size * 0.82
  const off = (size - inner) / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      <circle cx={size / 2} cy={size / 2} r={size * 0.45} fill={WHITE} />
      <svg x={off} y={off} width={inner} height={inner} viewBox="0 0 64 64">
        <Avatar name={name} size={64} accessory={accessory ?? null} background={background ?? null} />
      </svg>
      {frame ? (
        <g transform={`scale(${size / 64})`}>{ring(frame)}</g>
      ) : (
        <circle cx={size / 2} cy={size / 2} r={size * 0.45} fill="none" stroke={DIVIDER} strokeWidth="2" />
      )}
    </svg>
  )
}

export function FrameThumb({ id, size = 64 }: { id: string; size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="26" fill={MATH_50} />
      <circle cx="32" cy="26" r="9" fill={WARN_50} {...line} strokeWidth="2" />
      <path d="M16 52q16 -22 32 0z" fill={WARN_50} {...line} strokeWidth="2" />
      {ring(id)}
    </svg>
  )
}

const MEDAL_TONE = { gold: STAR, silver: REVIEW, bronze: WARN, honour: SCIENCE, participant: MATH } as const
export type MedalKind = keyof typeof MEDAL_TONE

/** Medali dengan pita. Kilau ditambahkan CSS (kelas kw-shine). */
export function MedalArt({ kind, size = 64, title, className }: { kind: MedalKind; size?: number; title?: string; className?: string }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      <path d="M18 4l10 22h8L46 4z" fill={ENGLISH} {...line} />
      <path d="M28 26l-2 -6M36 26l2 -6" {...line} strokeWidth="1.800" stroke={WHITE} />
      <g className="kw-shine-medal">
        <circle cx="32" cy="42" r="17" fill={MEDAL_TONE[kind]} {...line} />
        <circle cx="32" cy="42" r="11.500" fill="none" {...line} strokeWidth="1.600" />
        <path d="M32 34.500l2.200 4.500 5 0.700 -3.600 3.500 0.900 4.900 -4.500 -2.400 -4.500 2.400 0.900 -4.900 -3.600 -3.500 5 -0.700z" fill={WHITE} stroke={INK} strokeWidth="1.400" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

export function CupArt({ size = 64, tone = STAR, title, className }: { size?: number; tone?: string; title?: string; className?: string }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      <g {...line}>
        <path d="M18 10h28v14a14 14 0 0 1 -28 0z" fill={tone} />
        <path d="M18 14h-7q0 12 9 14M46 14h7q0 12 -9 14" fill="none" />
        <path d="M32 38v8" />
        <path d="M22 54h20l-2 -8h-16z" fill={WARN} />
        <path d="M26 17l2 4 4.500 0.600 -3.200 3 0.800 4.300 -4.100 -2.200" fill="none" stroke={WHITE} strokeWidth="2" />
      </g>
    </svg>
  )
}

/** Segel sertifikat: lingkaran bergerigi dengan jumlah hari. */
export function SealArt({ days, unit = 'DAYS', size = 96, className }: { days: number; unit?: string; size?: number; className?: string }): ReactElement {
  const teeth = Array.from({ length: 16 }, (_, i) => i)
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} aria-hidden>
      <g {...line}>
        {teeth.map((i) => (
          <circle key={i} cx="48" cy="9" r="6" fill={STAR} transform={`rotate(${i * 22.5} 48 48)`} />
        ))}
        <circle cx="48" cy="48" r="34" fill={STAR} />
        <circle cx="48" cy="48" r="27" fill={WARN_50} strokeWidth="1.600" />
        <text x="48" y="54" textAnchor="middle" fontSize="24" fontWeight="700" fill={INK} stroke="none" fontFamily="system-ui, sans-serif">
          {days}
        </text>
        <text x="48" y="68" textAnchor="middle" fontSize="9" fontWeight="700" fill={INK} stroke="none" fontFamily="system-ui, sans-serif">
          {unit}
        </text>
      </g>
      <path d="M30 80l-6 14l12 -4l4 6l6 -14zM66 80l6 14l-12 -4l-4 6l-6 -14z" fill={DANGER} {...line} strokeWidth="2" />
    </svg>
  )
}
