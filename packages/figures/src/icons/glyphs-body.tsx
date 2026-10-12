import type { ReactElement } from 'react'
import type { IconName } from '../spec'
import { DANGER, DIVIDER, ENGLISH, ENGLISH_50, INK, MATH, MATH_50, MUTED, SCIENCE_50, STAR, WARN, WARN_50, WHITE } from '../palette'
import { THIN, dot, ink, tube } from './glyphs-kit'

/** Tubuh manusia, indra, dan kebiasaan sehat. Kulit memakai WARN_50. */
export const BODY_GLYPHS = {
  eye: ink(
    <>
      <path d="M24 10.5 L24 6.5 M15 13 L13 9.5 M33 13 L35 9.5 M8.5 17.5 L6 15 M39.5 17.5 L42 15" strokeWidth={THIN} />
      <path d="M4 24 C10 14.5 17 10.5 24 10.5 C31 10.5 38 14.5 44 24 C38 33.5 31 37.5 24 37.5 C17 37.5 10 33.5 4 24 Z" fill={WHITE} />
      <circle cx="24" cy="24" r="8.5" fill={MATH} strokeWidth={THIN} />
      {dot(24, 24, 3.8)}
      {dot(26.6, 21.4, 1.6, WHITE)}
    </>,
    'translate(0 1)',
  ),
  ear: ink(
    <>
      <path d="M16.5 15 C17.5 8.5 22.5 4.5 29 4.5 C36 4.5 41 10 41 17.5 C41 23.5 37.5 27 35 29.5 C32.5 32 32.5 36 30 39.5 C27.5 43 22 43.5 19.5 40.5 C17.5 38 18 35 20 33.5 C22 32 22.5 30 21.5 28 C19 24 15.5 21 16.5 15 Z" fill={WARN_50} />
      <path d="M23 14 C25 10 30.5 9.5 33.5 12 C36.5 14.5 36 19.5 33.5 22 C31 24.5 29.5 27 30.5 30" strokeWidth={THIN} />
      <path d="M25 20 C26 17.8 29 17.6 30 19.6 C30.8 21.3 29.4 23.4 27.2 23.2" strokeWidth={THIN} />
    </>,
    'translate(-4.7 0)',
  ),
  nose: ink(
    <>
      <path d="M35 13 C37.5 15 33.5 17.5 36 20 M40 11 C42.5 13 38.5 15.5 41 18" stroke={MATH} strokeWidth={THIN} />
      <path d="M21 6 C20 14 17.5 21 15.5 25.5 C12.5 27 10.5 30 11 33.5 C11.5 37 14.5 38.8 17.5 38 C19 40 20.5 41 22 41 C23.5 41 25 40 26.5 38 C29.5 38.8 32.5 37 33 33.5 C33.5 30 31.5 27 28.5 25.5 C26.5 21 24 14 23 6 Z" fill={WARN_50} />
      <path d="M15.5 30 C14.5 31.5 14.5 33.5 15.7 35 M28.5 30 C29.5 31.5 29.5 33.5 28.3 35" strokeWidth={THIN} />
      <ellipse cx="19" cy="35" rx="1.9" ry="1.2" fill={INK} stroke="none" transform="rotate(25 19 35)" />
      <ellipse cx="25" cy="35" rx="1.9" ry="1.2" fill={INK} stroke="none" transform="rotate(-25 25 35)" />
      <path d="M20.5 13 C20 18 18.8 22 17.5 25" stroke={WHITE} strokeWidth={THIN} />
    </>,
  ),
  hand: ink(
    <>
      <path d="M14.5 27 L14.5 12.5 C14.5 10.8 15.8 9.5 17.5 9.5 C19.2 9.5 20.5 10.8 20.5 12.5 L20.5 23 L20.5 7.5 C20.5 5.8 21.8 4.5 23.5 4.5 C25.2 4.5 26.5 5.8 26.5 7.5 L26.5 23 L26.5 9 C26.5 7.3 27.8 6 29.5 6 C31.2 6 32.5 7.3 32.5 9 L32.5 24 L32.5 14 C32.5 12.3 33.8 11 35.5 11 C37.2 11 38.5 12.3 38.5 14 L38.5 30 C38.5 37.5 33 43.5 25.5 43.5 C19.5 43.5 16 40.5 13 36 L7.5 28 C6.5 26.5 7 24.5 8.5 23.8 C10 23 11.8 23.5 12.8 24.8 Z" fill={WARN_50} />
      <path d="M20 33.5 C23 35.5 28 35.5 31 32.5" strokeWidth={THIN} />
    </>,
  ),
  tongue: ink(
    <>
      <path d="M7 15 C13 19.5 35 19.5 41 15 C40 27 33 33 24 33 C15 33 8 27 7 15 Z" fill={MUTED} />
      <path d="M9 16.7 C15 20 33 20 39 16.7 L38.6 19.4 C32 22.6 16 22.6 9.4 19.4 Z" fill={WHITE} strokeWidth={1.5} />
      <path d="M16 25 C15.5 34.5 19 42.5 24 42.5 C29 42.5 32.5 34.5 32 25 C28 23 20 23 16 25 Z" fill={ENGLISH} />
      <path d="M24 27 L24 35" stroke={ENGLISH_50} strokeWidth={THIN} />
    </>,
    'translate(0 -4.7)',
  ),
  tooth: ink(
    <>
      <path d="M13 8 C17 6 20.5 8 24 8 C27.5 8 31 6 35 8 C39.5 10.5 39.5 17 37.5 22 C36 26 35 31 34 36 C33.3 40 31.5 42.5 29.5 42 C27.5 41.5 27 38 26.5 34.5 C26 31.5 25 30 24 30 C23 30 22 31.5 21.5 34.5 C21 38 20.5 41.5 18.5 42 C16.5 42.5 14.7 40 14 36 C13 31 12 26 10.5 22 C8.5 17 8.5 10.5 13 8 Z" fill={WHITE} />
      <path d="M14.5 14 C15.8 12.2 17.8 11.6 19.8 12" stroke={MATH_50} strokeWidth={3} />
      <path d="M40 3.5 L40 8.5 M37.5 6 L42.5 6" stroke={STAR} strokeWidth={THIN} />
    </>,
  ),
  'heart-organ': ink(
    <>
      {tube('M27.5 16 C27.5 9 31 6 35 7.5 C37.5 8.5 38 11.5 37 14', DANGER, 3.5)}
      {tube('M20.5 16 L19.5 6.5', MATH, 3.5)}
      <path d="M24 15.5 C20.5 12.5 13.5 12 10 16.5 C6 21.5 7.5 30 13.5 35.5 C17.5 39 21.5 42 24.5 43.5 C28.5 41.5 33.5 37.5 37 32 C40.5 26.5 41 19.5 37 15.5 C33.5 12 28 12.5 24 15.5 Z" fill={DANGER} />
      <path d="M26.5 21 C24.5 27.5 22.5 33 24 39.5" stroke={ENGLISH_50} strokeWidth={THIN} />
      <path d="M12.5 22.5 C13 19.8 14.6 18.2 16.8 17.6" stroke={WHITE} />
    </>,
  ),
  lungs: ink(
    <>
      <path d="M20.5 17.5 C14.5 15.5 9 21 8 28.5 C7 35.5 8.5 40.5 12.5 40.5 C16.5 40.5 20.5 38.5 21.5 34 C22 30 21.5 22 20.5 17.5 Z" fill={ENGLISH_50} />
      <path d="M27.5 17.5 C33.5 15.5 39 21 40 28.5 C41 35.5 39.5 40.5 35.5 40.5 C31.5 40.5 27.5 38.5 26.5 34 C26 30 26.5 22 27.5 17.5 Z" fill={ENGLISH_50} />
      <path d="M18.5 23 L15.5 27.5 L12.5 29.5 M15.5 27.5 L16 33 M29.5 23 L32.5 27.5 L35.5 29.5 M32.5 27.5 L32 33" stroke={ENGLISH} strokeWidth={1.5} />
      {tube('M24 7 L24 17 L18.5 22.5 M24 17 L29.5 22.5', DIVIDER, 3)}
    </>,
    'translate(0 1)',
  ),
  brain: ink(
    <>
      <path d="M10 26 C6 24 5.5 17 10 14.5 C11 9 17 6 22 8 C25.5 5 31.5 5.5 34 9 C39.5 9 43 14 41.5 19 C44.5 22 43.5 28.5 39 30 C38 34.5 33 36.5 29.5 34.5 L28 39 C27.7 40.5 26.5 41 25 41 C23.5 41 22.5 40 22.5 38.5 L22.5 34.5 C18 36.5 12.5 34 12 30 C10.5 29.5 9.8 28 10 26 Z" fill={ENGLISH_50} />
      <path d="M17 13 C19.5 16 16.5 19.5 20 21.5 M26 10 C24 13.5 28 16.5 25.5 20 M34 13.5 C31 15.5 33.5 19.5 30.5 22.5 M12.5 22.5 C15.5 23 17 26.5 21 25.5 M30 27 C33 26 35 28.5 37.5 25.5" strokeWidth={THIN} />
    </>,
    'translate(0 1)',
  ),
  stomach: ink(
    <>
      <path d="M17 13 C17 17 15.5 19 13 21.5 C9 25.5 8.5 32 12 36.5 C15.5 41 23 42 29 39.5 C31 38.5 33 39 34.5 40.5 L37 43 C38.5 42.5 39.5 41 39 39.5 L37.5 36.5 C40.5 32 41.5 26 39.5 20.5 C37.5 15 31.5 12.5 26.5 14.5 C24.5 15.3 23 14.5 23 12.5 L23 4 L17 4 Z" fill={ENGLISH_50} />
      <path d="M15.5 30 C18 34 25 35.5 30 32 M20 23 C23 26 29 25 32 21" stroke={ENGLISH} strokeWidth={1.5} />
    </>,
  ),
  bone: ink(
    <path d="M14 19 C11 15.5 5.5 16.5 5.5 21 C5.5 22.8 6.6 24.2 8 24.8 C6.6 25.4 5.5 26.8 5.5 28.6 C5.5 33 11 34 14 30.5 L34 30.5 C37 34 42.5 33 42.5 28.6 C42.5 26.8 41.4 25.4 40 24.8 C41.4 24.2 42.5 22.8 42.5 21 C42.5 16.5 37 15.5 34 19 Z" fill={WARN_50} />,
    'rotate(-35 24 24.8)',
  ),
  skeleton: ink(
    <>
      <path d="M18 18 L30 18 M19 18 L14 25 L12.5 32 M29 18 L34 25 L35.5 32 M24 16 L24 31 M21 33.5 L19.5 38 L19 43 M27 33.5 L28.5 38 L29 43" strokeWidth={THIN} />
      <path d="M18 20 C20 19 22 19 24 20 C26 19 28 19 30 20 M18.5 23.5 C20.5 22.5 22 22.5 24 23.5 C26 22.5 27.5 22.5 29.5 23.5 M19.5 27 C21 26.2 22.5 26.2 24 27 C25.5 26.2 27 26.2 28.5 27" strokeWidth={THIN} />
      <path d="M19.5 30.5 C19.5 34.5 28.5 34.5 28.5 30.5 Z" fill={WHITE} strokeWidth={THIN} />
      <circle cx="24" cy="10.5" r="6" fill={WHITE} />
      {dot(21.6, 10, 1.5)}
      {dot(26.4, 10, 1.5)}
      <path d="M21.7 13.3 C23.1 14.4 24.9 14.4 26.3 13.3" strokeWidth={1.5} />
    </>,
  ),
  muscle: ink(
    <>
      <path d="M5 30 C9 24 15 21 20 22 C23.5 22.5 26 24.5 27 27 L27.5 16 C26 15 25.5 13 26 11 L27 7 C27.5 5 29.5 4 31.5 4.5 L37.5 6 C39.5 6.5 40.5 8.5 40 10.5 L38.5 16 C40.5 22 41.5 28 40.5 33.5 C39.8 37.5 37 40 33 40 L5 40 Z" fill={WARN_50} />
      <path d="M5 30 C6.6 27.6 8.6 25.7 11 24.6 L11 40 L5 40 Z" fill={MATH} />
      <path d="M15 28 C18 25.5 22 25.5 24.5 28" strokeWidth={THIN} />
      <path d="M27.8 9.5 L33.5 11 M27.2 13 L33 14.3" strokeWidth={1.5} />
    </>,
    'translate(0 2)',
  ),
  toothbrush: ink(
    <>
      <path d="M4 25 C4 23.3 5.3 22 7 22 L31 23 L31 27 L7 28 C5.3 28 4 26.7 4 25 Z" fill={MATH} />
      <rect x="30" y="22" width="14" height="5.5" rx="2" fill={MATH} />
      <rect x="31" y="15.5" width="12" height="6.5" rx="1" fill={WHITE} />
      <path d="M34.5 16 L34.5 21.5 M37 16 L37 21.5 M39.5 16 L39.5 21.5" strokeWidth={1.5} />
      <path d="M30.5 15.5 C30.5 12 33 11 35 12 C36.5 10 40 10 41 12 C43 11.5 44.5 13.5 43.5 15.5 Z" fill={SCIENCE_50} />
      <path d="M9 25 L25 25.5" stroke={MATH_50} strokeWidth={THIN} />
    </>,
    'rotate(-30 24 24) translate(0 3)',
  ),
  soap: ink(
    <>
      <circle cx="16" cy="12.5" r="4.5" fill={WHITE} strokeWidth={THIN} />
      <circle cx="26" cy="8.5" r="3" fill={WHITE} strokeWidth={THIN} />
      <circle cx="33.5" cy="14" r="2.3" fill={WHITE} strokeWidth={THIN} />
      <path d="M14 11 C14.4 10 15.2 9.4 16.2 9.2" stroke={MATH_50} strokeWidth={1.5} />
      <path d="M8 27 L14 21 L40 21 L34 27 Z" fill={WHITE} />
      <path d="M34 27 L40 21 L40 31 C40 31.8 39.7 32.4 39.2 32.9 L34 38 Z" fill={MATH} />
      <path d="M8 27 L34 27 L34 37 C34 38.1 33.1 39 32 39 L10 39 C8.9 39 8 38.1 8 37 Z" fill={MATH_50} />
      <path d="M12.5 31 C15 30 18 30 20.5 31" stroke={WHITE} strokeWidth={THIN} />
    </>,
  ),
  bed: ink(
    <>
      <rect x="5" y="10" width="7" height="31" rx="2" fill={WARN} />
      <rect x="38" y="21" width="5" height="20" rx="1.5" fill={WARN} />
      <rect x="11" y="25" width="28" height="7.5" fill={WHITE} />
      <rect x="12.5" y="19" width="9.5" height="6.5" rx="3" fill={WHITE} />
      <path d="M20 25 C20 23.6 21.1 22.5 22.5 22.5 L38.5 22.5 L38.5 32.5 L20 32.5 Z" fill={MATH} />
      <path d="M20.5 26.5 L38 26.5" stroke={MATH_50} strokeWidth={THIN} />
      <rect x="11" y="32.5" width="28" height="4" fill={WARN} />
    </>,
  ),
  running: ink(
    <>
      <path d="M4 17 L10 17 M5 23 L11 23 M7 29 L12 29" strokeWidth={THIN} />
      {tube('M23.5 17 L18 21 L15.5 16.5', WARN_50, 3.5)}
      {tube('M23 27 L17.5 32.5 L11.5 30.5', WARN_50, 4)}
      <ellipse cx="10.5" cy="30.5" rx="3" ry="2" fill={ENGLISH} strokeWidth={THIN} transform="rotate(-25 10.5 30.5)" />
      {tube('M26 28 L31.5 33.5 L28.5 41', WARN_50, 4)}
      <path d="M26 40.5 L31.5 40.5 C32.6 40.5 33.2 41.6 32.7 42.5 L25.3 42.5 C24.5 42.5 24.6 40.9 26 40.5 Z" fill={ENGLISH} strokeWidth={THIN} />
      <path d="M21 24.5 L29.5 25.5 L29 30.5 L25.5 29.5 L23 31 L20.5 29.5 Z" fill={MUTED} />
      <path d="M22 15 C23 13.5 25.5 13 28 13.8 C29.5 14.3 30.5 15.5 30.3 17 L29.3 26 L21 25 Z" fill={MATH} />
      {tube('M28.5 16 L33.5 21.5 L39 18.5', WARN_50, 3.5)}
      <circle cx="28" cy="8.5" r="5" fill={WARN_50} />
      <path d="M23 8 C23 4.5 26 3 28.5 3 C31.5 3 33.5 5 33 7.5 C31 6 27.5 6 25.5 8.5 C24.8 9.3 23.5 9.5 23 8 Z" fill={MUTED} strokeWidth={THIN} />
      {dot(30.5, 8.8, 1)}
    </>,
  ),
} satisfies Partial<Record<IconName, ReactElement>>
