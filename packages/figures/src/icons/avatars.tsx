import type { ReactElement } from 'react'
import { AVATARS, type AvatarName } from '../spec'
import { INK, WARN, WHITE } from '../palette'

/** Rubah dari desain Today; avatar lain menyusul dengan gaya yang sama. */
const fox = (
  <>
    <circle cx="32" cy="32" r="31" fill={WHITE} stroke={INK} strokeWidth="2" />
    <path d="M15 13l13 10-12 8z" fill={WARN} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    <path d="M49 13L36 23l12 8z" fill={WARN} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    <path d="M11 30l21-10 21 10-21 24z" fill={WARN} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    <path d="M18 35l14 19 14-19-14 5z" fill={WHITE} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    <circle cx="24" cy="31" r="2.5" fill={INK} />
    <circle cx="40" cy="31" r="2.5" fill={INK} />
    <path d="M29 47h6l-3 4z" fill={INK} />
  </>
)

export const AVATAR_GLYPHS: Record<AvatarName, ReactElement> = Object.fromEntries(
  AVATARS.map((n) => [n, fox]),
) as Record<AvatarName, ReactElement>
