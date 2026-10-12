import type { ReactElement, ReactNode } from 'react'
import type { AvatarName } from '../spec'
import { ENGLISH, ENGLISH_50, INK, MATH, MATH_50, MUTED, REVIEW, SCIENCE, SCIENCE_50, STAR, WARN, WARN_50, WHITE } from '../palette'

/**
 * Avatar hewan 64 x 64: lencana putih bergaris tinta dengan wajah hewan.
 * Gaya mengikuti rubah dari desain Today: bentuk datar, garis 2, mata tinta.
 * Setiap hewan punya warna utama sendiri supaya mudah dibedakan anak.
 */

function badge(children: ReactNode): ReactElement {
  return (
    <>
      <circle cx="32" cy="32" r="31" fill={WHITE} stroke={INK} strokeWidth="2" />
      <g fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </>
  )
}

function eyes(y: number, left = 24, right = 40, r = 2.5): ReactElement {
  return (
    <>
      <circle cx={left} cy={y} r={r} fill={INK} stroke="none" />
      <circle cx={right} cy={y} r={r} fill={INK} stroke="none" />
      <circle cx={left + r * 0.35} cy={y - r * 0.35} r={r * 0.35} fill={WHITE} stroke="none" />
      <circle cx={right + r * 0.35} cy={y - r * 0.35} r={r * 0.35} fill={WHITE} stroke="none" />
    </>
  )
}

const fox = badge(
  <>
    <path d="M15 13l13 10-12 8z" fill={WARN} />
    <path d="M49 13L36 23l12 8z" fill={WARN} />
    <path d="M17.5 17.5l7 5.4-6.5 4.3z" fill={WARN_50} stroke="none" />
    <path d="M46.5 17.5l-7 5.4 6.5 4.3z" fill={WARN_50} stroke="none" />
    <path d="M11 30l21-10 21 10-21 24z" fill={WARN} />
    <path d="M18 35l14 19 14-19-14 5z" fill={WHITE} />
    {eyes(31)}
    <path d="M29 47h6l-3 4z" fill={INK} />
  </>,
)

const cat = badge(
  <>
    <path d="M14 31 L17 11 L29 19.5 Z" fill={STAR} />
    <path d="M50 31 L47 11 L35 19.5 Z" fill={STAR} />
    <path d="M18.5 24 L19.6 15.8 L25 19.8 Z" fill={ENGLISH_50} stroke="none" />
    <path d="M45.5 24 L44.4 15.8 L39 19.8 Z" fill={ENGLISH_50} stroke="none" />
    <path d="M12 35 C12 25 20 18.5 32 18.5 C44 18.5 52 25 52 35 C52 45.5 43 52.5 32 52.5 C21 52.5 12 45.5 12 35 Z" fill={STAR} />
    <path d="M32 19.5 L32 24.5 M26.5 20.5 L27.8 24.5 M37.5 20.5 L36.2 24.5" stroke={WARN} strokeWidth={2.2} />
    <path d="M23.5 42 C23.5 38.5 27.5 37 32 38.8 C36.5 37 40.5 38.5 40.5 42 C40.5 45.5 36.5 47.3 32 45.8 C27.5 47.3 23.5 45.5 23.5 42 Z" fill={WHITE} />
    {eyes(32.5)}
    <path d="M29.8 38.6 L34.2 38.6 L32 41 Z" fill={ENGLISH} strokeWidth={1.5} />
    <path d="M32 41 L32 42.8 M32 42.8 C31 44.3 29 44.3 28 43.2 M32 42.8 C33 44.3 35 44.3 36 43.2" strokeWidth={1.5} />
    <path d="M7.5 38.5 L18 40 M8 44 L18 42.5 M56.5 38.5 L46 40 M56 44 L46 42.5" strokeWidth={1.5} />
  </>,
)

const owl = badge(
  <>
    <path d="M14.5 23 L15.5 12.5 L25 16.5 Z" fill={MATH} />
    <path d="M49.5 23 L48.5 12.5 L39 16.5 Z" fill={MATH} />
    <path d="M11 30 C11 19.5 20 13.5 32 13.5 C44 13.5 53 19.5 53 30 L53 40 C53 49 44 55.5 32 55.5 C20 55.5 11 49 11 40 Z" fill={MATH} />
    <path d="M32 24.5 C28.5 20 15.5 20 15.5 31.5 C15.5 38 21 42.5 26 42.5 C29 42.5 31 41 32 39.5 C33 41 35 42.5 38 42.5 C43 42.5 48.5 38 48.5 31.5 C48.5 20 35.5 20 32 24.5 Z" fill={MATH_50} />
    <circle cx="24.5" cy="31.5" r="6" fill={WHITE} />
    <circle cx="39.5" cy="31.5" r="6" fill={WHITE} />
    {eyes(31.8, 25, 39, 3)}
    <path d="M29.5 38 L34.5 38 L32 42.5 Z" fill={STAR} />
    <path d="M25 48 L27.5 50.5 L30 48 M34 48 L36.5 50.5 L39 48" stroke={MATH_50} strokeWidth={2} />
  </>,
)

const bear = badge(
  <>
    <circle cx="18" cy="19.5" r="6.5" fill={ENGLISH} />
    <circle cx="46" cy="19.5" r="6.5" fill={ENGLISH} />
    <circle cx="18" cy="19.5" r="3.2" fill={WARN_50} stroke="none" />
    <circle cx="46" cy="19.5" r="3.2" fill={WARN_50} stroke="none" />
    <path d="M11 35.5 C11 23.5 20 16.5 32 16.5 C44 16.5 53 23.5 53 35.5 C53 46.5 44 53.5 32 53.5 C20 53.5 11 46.5 11 35.5 Z" fill={ENGLISH} />
    <ellipse cx="32" cy="42.5" rx="9.5" ry="7.5" fill={WARN_50} />
    {eyes(32)}
    <ellipse cx="32" cy="39" rx="3.4" ry="2.4" fill={INK} stroke="none" />
    <path d="M32 41 L32 44 M28.5 45 C30 46.6 34 46.6 35.5 45" strokeWidth={1.8} />
  </>,
)

const rabbit = badge(
  <>
    <path d="M22.5 27.5 C18.5 20.5 17.5 11 21.2 8.6 C24.8 6.6 28.6 14.5 28.3 25.5 Z" fill={REVIEW} />
    <path d="M41.5 27.5 C45.5 20.5 46.5 11 42.8 8.6 C39.2 6.6 35.4 14.5 35.7 25.5 Z" fill={REVIEW} />
    <path d="M23 22.5 C21.4 17.5 21.2 12.8 22.5 12 C23.8 11.5 25.4 15.5 25.5 21.5 Z" fill={ENGLISH_50} stroke="none" />
    <path d="M41 22.5 C42.6 17.5 42.8 12.8 41.5 12 C40.2 11.5 38.6 15.5 38.5 21.5 Z" fill={ENGLISH_50} stroke="none" />
    <path d="M13 38.5 C13 28.5 21 22.5 32 22.5 C43 22.5 51 28.5 51 38.5 C51 48.5 43 54.5 32 54.5 C21 54.5 13 48.5 13 38.5 Z" fill={REVIEW} />
    <rect x="30" y="46" width="4" height="3.8" rx="0.8" fill={WHITE} strokeWidth={1.5} />
    <path d="M24.5 44 C24.5 40.5 28.5 39 32 40.5 C35.5 39 39.5 40.5 39.5 44 C39.5 47 36 48.5 32 47 C28 48.5 24.5 47 24.5 44 Z" fill={WHITE} />
    {eyes(36, 24.5, 39.5)}
    <path d="M30 41 L34 41 L32 43.2 Z" fill={ENGLISH} strokeWidth={1.5} />
    <circle cx="19.5" cy="43" r="2.2" fill={ENGLISH_50} stroke="none" />
    <circle cx="44.5" cy="43" r="2.2" fill={ENGLISH_50} stroke="none" />
  </>,
)

const turtle = badge(
  <>
    <path d="M9 41 C9 25 19 14.5 32 14.5 C45 14.5 55 25 55 41 Z" fill={SCIENCE} />
    <path d="M9.6 34 L17 31.5 L20.5 22.5 L17.5 18.5 M20.5 22.5 L27 19.5 L37 19.5 L43.5 22.5 L46.5 18.5 M43.5 22.5 L47 31.5 L54.4 34 M27 19.5 L25.5 15 M37 19.5 L38.5 15" strokeWidth={1.6} />
    <path d="M7.5 41 L56.5 41 C56.5 43.5 54.5 45.5 52 45.5 L12 45.5 C9.5 45.5 7.5 43.5 7.5 41 Z" fill={WARN} />
    <path d="M19 38.5 C19 29.5 24.8 24 32 24 C39.2 24 45 29.5 45 38.5 C45 47.5 39.2 53.5 32 53.5 C24.8 53.5 19 47.5 19 38.5 Z" fill={SCIENCE_50} />
    {eyes(36.5, 26.5, 37.5)}
    <path d="M27.5 44 C30 46.5 34 46.5 36.5 44" strokeWidth={1.8} />
    <circle cx="23.5" cy="42" r="1.9" fill={ENGLISH_50} stroke="none" />
    <circle cx="40.5" cy="42" r="1.9" fill={ENGLISH_50} stroke="none" />
  </>,
)

const penguin = badge(
  <>
    <path d="M10 38.5 C10 24 19 13 32 13 C45 13 54 24 54 38.5 C54 49.5 44 55.5 32 55.5 C20 55.5 10 49.5 10 38.5 Z" fill={MUTED} />
    <path d="M32 29.5 C30 22 18 21.5 17 32.5 C16 41.5 22 49.5 32 49.5 C42 49.5 48 41.5 47 32.5 C46 21.5 34 22 32 29.5 Z" fill={WHITE} />
    {eyes(33.5, 25, 39)}
    <path d="M28 38.5 L36 38.5 L32 43.5 Z" fill={STAR} />
    <circle cx="21.5" cy="40.5" r="2.2" fill={ENGLISH_50} stroke="none" />
    <circle cx="42.5" cy="40.5" r="2.2" fill={ENGLISH_50} stroke="none" />
  </>,
)

const frog = badge(
  <>
    <path d="M8 38.5 C8 28.5 18 23 32 23 C46 23 56 28.5 56 38.5 C56 47.5 46 53.5 32 53.5 C18 53.5 8 47.5 8 38.5 Z" fill={SCIENCE} />
    <circle cx="20" cy="21" r="8.5" fill={SCIENCE} />
    <circle cx="44" cy="21" r="8.5" fill={SCIENCE} />
    <circle cx="20" cy="21" r="5" fill={WHITE} />
    <circle cx="44" cy="21" r="5" fill={WHITE} />
    {eyes(21.3, 20.5, 43.5)}
    <circle cx="29.5" cy="33.5" r="1" fill={INK} stroke="none" />
    <circle cx="34.5" cy="33.5" r="1" fill={INK} stroke="none" />
    <path d="M18 40 C24 46.5 40 46.5 46 40" />
    <circle cx="14" cy="40" r="2.6" fill={ENGLISH_50} stroke="none" />
    <circle cx="50" cy="40" r="2.6" fill={ENGLISH_50} stroke="none" />
  </>,
)

export const AVATAR_GLYPHS: Record<AvatarName, ReactElement> = { fox, cat, owl, bear, rabbit, turtle, penguin, frog }

