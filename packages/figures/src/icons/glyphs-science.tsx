import type { ReactElement } from 'react'
import type { IconName } from '../spec'
import {
  BORDER,
  DANGER,
  DIVIDER,
  ENGLISH,
  ENGLISH_50,
  INK,
  MATH,
  MATH_50,
  MUTED,
  REVIEW,
  SCIENCE,
  SCIENCE_50,
  STAR,
  WARN,
  WARN_50,
  WHITE,
} from '../palette'
import { THIN, dot, ink, tube } from './glyphs-kit'

/** Bahan dan benda untuk percobaan Science: bahan, listrik, gaya, bunyi, cahaya. */
export const SCIENCE_GLYPHS = {
  spoon: ink(
    <>
      <path d="M22.4 21 L22 41.5 C22 42.6 22.9 43.5 24 43.5 C25.1 43.5 26 42.6 26 41.5 L25.6 21 Z" fill={DIVIDER} />
      <ellipse cx="24" cy="13.5" rx="6.5" ry="9" fill={DIVIDER} />
      <path d="M20.5 15 C20.5 11.5 21.5 9 23.5 7.8" stroke={WHITE} />
    </>,
    'rotate(40 24 24)',
  ),
  'wooden-spoon': ink(
    <>
      <path d="M22.6 18 L22.2 42 C22.2 43 23 43.8 24 43.8 C25 43.8 25.8 43 25.8 42 L25.4 18 Z" fill={WARN} />
      <path d="M24 3.5 C29 3.5 31.5 7.5 31.5 12 C31.5 17 28 20 24 20 C20 20 16.5 17 16.5 12 C16.5 7.5 19 3.5 24 3.5 Z" fill={WARN} />
      <path d="M21 9 C21.5 12 21.5 14.5 20.5 17" stroke={WARN_50} strokeWidth={THIN} />
      <path d="M24 26 L24 32" stroke={WARN_50} strokeWidth={THIN} />
    </>,
    'rotate(-40 24 24)',
  ),
  glass: ink(
    <>
      <path d="M12.5 6 L35.5 6 L32.6 41.5 C32.5 42.9 31.4 44 30 44 L18 44 C16.6 44 15.5 42.9 15.4 41.5 Z" fill={WHITE} />
      <path d="M13.8 20 L34.2 20 L32.6 41.5 C32.5 42.9 31.4 44 30 44 L18 44 C16.6 44 15.5 42.9 15.4 41.5 Z" fill={MATH_50} />
      <path d="M18.5 25 L19.5 38" stroke={WHITE} strokeWidth={3} />
      <path d="M17.5 10 L17.8 14" strokeWidth={THIN} />
    </>,
  ),
  bottle: ink(
    <>
      <rect x="19" y="3.5" width="10" height="6" rx="1.5" fill={MATH} />
      <path d="M20 9.5 L28 9.5 L28 12 C32.5 14 35 17.5 35 22 L35 41 C35 42.7 33.7 44 32 44 L16 44 C14.3 44 13 42.7 13 41 L13 22 C13 17.5 15.5 14 20 12 Z" fill={MATH_50} />
      <path d="M13 26 L35 26 L35 35 L13 35 Z" fill={WHITE} strokeWidth={THIN} />
      <path d="M17.5 30.5 C19.5 28.5 21.5 32.5 23.5 30.5 C25.5 28.5 27.5 32.5 29.5 30.5" stroke={MATH} strokeWidth={THIN} />
      <path d="M16.5 19 C17 16.8 18.2 15.5 20 14.8" stroke={WHITE} />
    </>,
  ),
  paper: ink(
    <>
      <path d="M11 5 L30 5 L38 13 L38 41 C38 42.1 37.1 43 36 43 L13 43 C11.9 43 11 42.1 11 41 Z" fill={WHITE} />
      <path d="M30 5 L30 13 L38 13 Z" fill={DIVIDER} />
      <path d="M16 20 L33 20 M16 25.5 L33 25.5 M16 31 L33 31 M16 36.5 L27 36.5" stroke={REVIEW} strokeWidth={THIN} />
    </>,
  ),
  fabric: ink(
    <>
      <path d="M7 9 L41 9 L38.5 13 L41 17 L38.5 21 L41 25 L38.5 29 L41 33 L38.5 37 L41 41 L7 41 L9.5 37 L7 33 L9.5 29 L7 25 L9.5 21 L7 17 L9.5 13 Z" fill={MATH_50} />
      <path d="M8.5 17 L40 17 M8.5 25 L40 25 M8.5 33 L40 33 M16 9.5 L16 40.5 M24 9.5 L24 40.5 M32 9.5 L32 40.5" stroke={MATH} strokeWidth={THIN} />
    </>,
    'rotate(-8 24 25)',
  ),
  'rubber-band': ink(
    <>{tube('M9.5 25 C8.5 16 18 10.5 29 11 C38.5 11.5 42 18 39 25 C36 32 28 37.5 18.5 37 C12.5 36.5 10 31 9.5 25 Z', ENGLISH, 3)}</>,
  ),
  brick: ink(
    <>
      <rect x="5" y="9" width="38" height="30" rx="2" fill={ENGLISH} />
      <path d="M5 19 L43 19 M5 29 L43 29 M17 9 L17 19 M31 9 L31 19 M11 19 L11 29 M24 19 L24 29 M37 19 L37 29 M17 29 L17 39 M31 29 L31 39" stroke={WARN_50} strokeWidth={THIN} />
      <rect x="5" y="9" width="38" height="30" rx="2" />
    </>,
  ),
  nail: ink(
    <>
      <path d="M21.8 12 L21.8 36 L24 43.5 L26.2 36 L26.2 12 Z" fill={DIVIDER} />
      <rect x="15.5" y="6" width="17" height="6" rx="2" fill={DIVIDER} />
      <path d="M22 20 L26 18.5 M22 24 L26 22.5" strokeWidth={1.5} />
    </>,
    'translate(-2.7 1.4) rotate(35 24 24)',
  ),
  paperclip: ink(
    <>{tube('M21 15 L21 32 C21 36.5 28 36.5 28 32 L28 10.5 C28 4 17 4 17 10.5 L17 36 C17 44 32 44 32 36 L32 16', REVIEW, 2)}</>,
    'rotate(25 24 24)',
  ),
  scissors: ink(
    <>
      <path d="M21.5 27 L17.5 5.5 C17.3 4.6 18.5 4.2 18.9 5 L27 25.5 Z" fill={DIVIDER} />
      <path d="M26.5 27 L30.5 5.5 C30.7 4.6 29.5 4.2 29.1 5 L21 25.5 Z" fill={DIVIDER} />
      {tube('M23 26.5 L19.5 31.5 M25 26.5 L28.5 31.5', ENGLISH, 2.5)}
      <circle cx="16.5" cy="36.5" r="6" fill={ENGLISH} />
      <circle cx="31.5" cy="36.5" r="6" fill={ENGLISH} />
      <circle cx="16.5" cy="36.5" r="2.8" fill={WHITE} strokeWidth={THIN} />
      <circle cx="31.5" cy="36.5" r="2.8" fill={WHITE} strokeWidth={THIN} />
      {dot(24, 25, 1.6)}
    </>,
  ),
  magnet: ink(
    <>
      <path d="M8 6 L18 6 L18 26 C18 29.3 20.7 32 24 32 C27.3 32 30 29.3 30 26 L30 6 L40 6 L40 26 C40 34.8 32.8 42 24 42 C15.2 42 8 34.8 8 26 Z" fill={ENGLISH} />
      <path d="M8 6 L18 6 L18 13 L8 13 Z" fill={DIVIDER} />
      <path d="M30 6 L40 6 L40 13 L30 13 Z" fill={DIVIDER} />
      <path d="M12.5 29 C13 33 15 36 18 37.5" stroke={WHITE} />
    </>,
  ),
  battery: ink(
    <>
      <rect x="20.5" y="4.5" width="7" height="5" rx="1" fill={DIVIDER} />
      <rect x="15" y="9" width="18" height="34.5" rx="3" fill={MUTED} />
      <path d="M15 12 C15 10.3 16.3 9 18 9 L30 9 C31.7 9 33 10.3 33 12 L33 18 L15 18 Z" fill={STAR} />
      <path d="M19 23 L19 38" stroke={REVIEW} strokeWidth={THIN} />
    </>,
  ),
  bulb: ink(
    <>
      <path d="M18 32 L30 32 L30 38 C30 39.1 29.1 40 28 40 L20 40 C18.9 40 18 39.1 18 38 Z" fill={DIVIDER} />
      <path d="M18 34.5 L30 34.5 M18 37.2 L30 37.2" strokeWidth={1.5} />
      <path d="M21.5 40 L26.5 40 L25.5 43 L22.5 43 Z" fill={MUTED} strokeWidth={THIN} />
      <path d="M18 32 C18 28 16.5 26.5 14 23.5 C12 21 11 18.5 11 15.5 C11 8.5 17 3.5 24 3.5 C31 3.5 37 8.5 37 15.5 C37 18.5 36 21 34 23.5 C31.5 26.5 30 28 30 32 Z" fill={WHITE} />
      <path d="M21 32 L21 23 L19 19 M27 32 L27 23 L29 19 M19 19 C21 16.5 23 21.5 24 19 C25 16.5 27 21.5 29 19" strokeWidth={1.5} />
      <path d="M15.5 15 C15.8 11.5 18 8.8 21 7.8" stroke={MATH_50} strokeWidth={3} />
    </>,
  ),
  switch: ink(
    <>
      <rect x="9" y="5" width="30" height="38" rx="5" fill={WHITE} />
      <rect x="17" y="12" width="14" height="24" rx="3" fill={DIVIDER} />
      <path d="M17 15 C17 13.3 18.3 12 20 12 L28 12 C29.7 12 31 13.3 31 15 L31 24 L17 24 Z" fill={MATH} />
      {dot(24, 8.5, 1.2, BORDER)}
      {dot(24, 39.5, 1.2, BORDER)}
    </>,
  ),
  wire: ink(
    <>
      {tube('M12 35.5 L9.6 41.5', WARN, 1.8)}
      {tube('M37.5 14 L42 9.5', WARN, 1.8)}
      {tube('M12 35.5 C17 23 23 40 29 28 C31.5 23 34 17.5 37.5 14', ENGLISH, 3.5)}
    </>,
  ),
  torch: ink(
    <>
      {tube('M37 17.5 L42 14.5 M37.5 24 L43 24 M37 30.5 L42 33.5', STAR, 2.5)}
      <rect x="5" y="19" width="21" height="10" rx="2.5" fill={MATH} />
      <path d="M25 17.5 L32 14.5 L32 33.5 L25 30.5 Z" fill={MATH} />
      <path d="M32 14.5 L34.5 14.5 L34.5 33.5 L32 33.5 Z" fill={STAR} />
      <rect x="12" y="16.5" width="6" height="2.5" rx="1" fill={ENGLISH} strokeWidth={THIN} />
      <path d="M8 22 L22 22" stroke={MATH_50} strokeWidth={THIN} />
    </>,
    'translate(-1 0)',
  ),
  candle: ink(
    <>
      <path d="M8 41 C8 39.3 9.3 38 11 38 L37 38 C38.7 38 40 39.3 40 41 L40 41.5 C40 42.6 39.1 43.5 38 43.5 L10 43.5 C8.9 43.5 8 42.6 8 41.5 Z" fill={DIVIDER} />
      <path d="M18 18 L30 18 L30 38 L18 38 Z" fill={ENGLISH} />
      <path d="M18 18 L30 18 L30 21 C30 23 28.5 23 28.5 25 C28.5 26.5 27 26.5 27 25 L27 22.5 C26 22.5 25 23.5 24 22.5 C23 21.5 21 22 20.5 24 C20.2 25.2 18 25 18 23 Z" fill={ENGLISH_50} strokeWidth={THIN} />
      <path d="M24 18 L24 14.5" strokeWidth={THIN} />
      <path d="M24 3.5 C27.5 7.5 28.5 10.5 27 12.5 C26 14 22 14 21 12.5 C19.5 10.5 20.5 7.5 24 3.5 Z" fill={STAR} />
      <path d="M24 8 C25.5 10 25.8 11.3 25 12.3 C24.4 12.9 23.6 12.9 23 12.3 C22.2 11.3 22.5 10 24 8 Z" fill={WARN} stroke="none" />
    </>,
  ),
  mirror: ink(
    <>
      {tube('M24 34 L24 41.5', STAR, 4)}
      <ellipse cx="24" cy="19.5" rx="13" ry="15" fill={STAR} />
      <ellipse cx="24" cy="19.5" rx="9.5" ry="11.5" fill={MATH_50} strokeWidth={THIN} />
      <path d="M18.5 20 L25 11.5 M19.5 25.5 L28.5 14" stroke={WHITE} strokeWidth={THIN} />
    </>,
  ),
  kettle: ink(
    <>
      {tube('M16 16 C17 7.5 31 7.5 32 16', MUTED, 3)}
      <path d="M12.5 28 L5 20 C4.3 19.3 3.3 19.8 3.5 20.7 L7 32 Z" fill={SCIENCE} />
      <path d="M9.5 40 L11.5 23 C12.3 17 17.5 13.5 24 13.5 C30.5 13.5 35.7 17 36.5 23 L38.5 40 Z" fill={SCIENCE} />
      <path d="M9 38.5 L39 38.5 L39.5 42 C39.6 43 38.8 44 37.8 44 L10.2 44 C9.2 44 8.4 43 8.5 42 Z" fill={MUTED} />
      <path d="M17 15.5 C20 17 28 17 31 15.5" strokeWidth={THIN} />
      {dot(24, 12.5, 2.2, MUTED)}
      <path d="M15 33 C15 28 16.5 24 19.5 21.5" stroke={SCIENCE_50} />
    </>,
    'translate(2.5 -1.9)',
  ),
  thermometer: ink(
    <>
      <path d="M19 37 L19 9 C19 6.2 21.2 4 24 4 C26.8 4 29 6.2 29 9 L29 37" fill={WHITE} />
      <path d="M22 37 L22 17 C22 15.9 22.9 15 24 15 C25.1 15 26 15.9 26 17 L26 37 Z" fill={DANGER} stroke="none" />
      <circle cx="24" cy="37" r="7" fill={DANGER} />
      <path d="M22 31 L22 17 C22 15.9 22.9 15 24 15 C25.1 15 26 15.9 26 17 L26 31" strokeWidth={1.5} />
      <path d="M29 10 L32.5 10 M29 15 L31.5 15 M29 20 L32.5 20 M29 25 L31.5 25 M29 30 L32.5 30" strokeWidth={THIN} />
      <path d="M20.5 36 C20.5 34.5 21.2 33.3 22.2 32.6" stroke={WHITE} strokeWidth={THIN} />
    </>,
  ),
  drum: ink(
    <>
      {tube('M14 5 L22 15 M34 5 L26 15', WARN, 2.5)}
      {dot(14, 5, 2.4, WARN_50)}
      {dot(34, 5, 2.4, WARN_50)}
      <path d="M7 21 L7 37 C7 40.5 14.6 43.5 24 43.5 C33.4 43.5 41 40.5 41 37 L41 21 Z" fill={ENGLISH} />
      <path d="M7 23.5 L13 39.5 L19 26.5 L24 43 L29 26.5 L35 39.5 L41 23.5" stroke={WHITE} strokeWidth={THIN} />
      <ellipse cx="24" cy="21" rx="17" ry="5.5" fill={WHITE} />
      <path d="M7 36.5 C7 40 14.6 43 24 43 C33.4 43 41 40 41 36.5" />
    </>,
  ),
  guitar: ink(
    <>
      <rect x="21" y="1.5" width="6" height="6.5" rx="1.5" fill={MUTED} />
      <path d="M22.4 8 L25.6 8 L25.6 24 L22.4 24 Z" fill={WARN_50} />
      <path d="M24 14.5 C28 14.5 30.5 17.5 30.5 21 C30.5 23 29.5 24.5 29 25.5 C32 27 33.5 30 33.5 33.5 C33.5 39 29.5 43 24 43 C18.5 43 14.5 39 14.5 33.5 C14.5 30 16 27 19 25.5 C18.5 24.5 17.5 23 17.5 21 C17.5 17.5 20 14.5 24 14.5 Z" fill={WARN} />
      <path d="M22.4 14.6 L22.4 24 L25.6 24 L25.6 14.6" fill={WARN_50} strokeWidth={THIN} />
      <circle cx="24" cy="28.5" r="3.2" fill={INK} />
      <rect x="20" y="35.5" width="8" height="2.5" rx="1" fill={MUTED} strokeWidth={THIN} />
    </>,
    'rotate(-40 24 24) translate(0 1) scale(0.94) translate(1.5 1.5)',
  ),
  whistle: ink(
    <>
      <circle cx="40" cy="20" r="2.6" strokeWidth={THIN} />
      <path d="M37.8 21.5 C36 23 34.5 23.5 33 23.5" strokeWidth={THIN} />
      <path d="M5 19 L25 19 C27.5 17 30.5 16 33.5 16.5 C39 17.5 42.5 22.5 41.5 28 C40.5 34 35 38 29 37.5 C23 37 18.5 32 18.5 26 L18.5 25.5 L7 25.5 C5.9 25.5 5 24.6 5 23.5 Z" fill={STAR} />
      <path d="M19 19 L22.5 19 L22.5 22.5 L19 22.5 Z" fill={INK} strokeWidth={1.5} />
      <circle cx="30" cy="27" r="4" fill={WARN_50} strokeWidth={THIN} />
    </>,
    'translate(0 -3)',
  ),
  parachute: ink(
    <>
      <path d="M7 20 L20 36 M17 21 L22 36 M31 21 L26 36 M41 20 L28 36" strokeWidth={1.5} />
      <path d="M5 21 C5 11.5 13.5 4.5 24 4.5 C34.5 4.5 43 11.5 43 21 C40.5 19 37.5 19 35.5 21 C33 19 29.5 19 27 21 C25 19 23 19 21 21 C18.5 19 15 19 12.5 21 C10.5 19 7.5 19 5 21 Z" fill={ENGLISH} />
      <path d="M17 21 C17 13 19.5 7 24 4.6 C28.5 7 31 13 31 21 C29 19.6 27.8 19.6 27 21 C25 19 23 19 21 21 C20.2 19.6 19 19.6 17 21 Z" fill={WHITE} strokeWidth={THIN} />
      <rect x="18.5" y="35" width="11" height="8.5" rx="1.5" fill={WARN} />
    </>,
  ),
  'toy-car': ink(
    <>
      <path d="M27 14 L27 8" strokeWidth={THIN} />
      <ellipse cx="23" cy="6.5" rx="3.2" ry="2.2" fill={DIVIDER} strokeWidth={THIN} />
      <ellipse cx="31" cy="6.5" rx="3.2" ry="2.2" fill={DIVIDER} strokeWidth={THIN} />
      <rect x="25.6" y="5" width="2.8" height="3" rx="0.8" fill={DIVIDER} strokeWidth={1.5} />
      <path d="M6 30 C6 26 8 24 11 23.5 L15 17 C16 15 18 14 20 14 L30 14 C32.5 14 34.5 15.5 35.5 18 L38 23.5 C41 24 42.5 26 42.5 29.5 L42.5 31 C42.5 32.7 41.2 34 39.5 34 L9 34 C7.3 34 6 32.7 6 31 Z" fill={STAR} />
      <path d="M18.5 17 L16 23.5 L23.5 23.5 L23.5 17 Z" fill={MATH_50} strokeWidth={THIN} />
      <path d="M26.5 17 L26.5 23.5 L34.5 23.5 L32.5 17 Z" fill={MATH_50} strokeWidth={THIN} />
      <circle cx="14" cy="34" r="6.5" fill={MUTED} />
      <circle cx="34.5" cy="34" r="6.5" fill={MUTED} />
      {dot(14, 34, 2.5, DIVIDER)}
      {dot(34.5, 34, 2.5, DIVIDER)}
    </>,
  ),
  ramp: ink(
    <>
      <path d="M4 40 L44 40 L44 15 Z" fill={WARN} />
      <path d="M12 38 L40 21.5 M26 38 L40 30" stroke={WARN_50} strokeWidth={THIN} />
      <circle cx="18" cy="24.5" r="6" fill={ENGLISH} transform="rotate(-32 18 24.5)" />
      <path d="M14.5 21.5 C15.3 20 16.6 19.2 18 19" stroke={WHITE} strokeWidth={THIN} />
      <path d="M8.5 14 L12.5 11.5 M5 20 L9 17.5" strokeWidth={THIN} />
      <path d="M4 41 L44 41" />
    </>,
    'translate(0 -2.4)',
  ),
  spring: ink(
    <>
      {tube('M14 8 C34 6 34 13 24 13 C14 13 14 18.5 24 18.5 C34 18.5 34 24 24 24 C14 24 14 29.5 24 29.5 C34 29.5 34 35 24 35 C14 35 14 41.5 34 40', REVIEW, 2.5)}
    </>,
  ),
  sponge: ink(
    <>
      <path d="M7 19 L15 11 L41 11 L33 19 Z" fill={SCIENCE} />
      <path d="M33 19 L41 11 L41 31 L33 39 Z" fill={WARN} />
      <path d="M7 19 L33 19 L33 39 L7 39 Z" fill={STAR} />
      <path d="M7 23 L33 23 L41 15" strokeWidth={THIN} />
      <ellipse cx="13" cy="29" rx="2" ry="1.5" fill={WARN} strokeWidth={1.5} />
      <ellipse cx="21" cy="33.5" rx="2.3" ry="1.6" fill={WARN} strokeWidth={1.5} />
      <ellipse cx="27.5" cy="28" rx="1.8" ry="1.4" fill={WARN} strokeWidth={1.5} />
      <ellipse cx="12.5" cy="35" rx="1.4" ry="1.1" fill={WARN} strokeWidth={1.5} />
    </>,
    'translate(0 -1)',
  ),
  stone: ink(
    <>
      <path d="M6.5 31 C6.5 22.5 15 17 25.5 17 C35.5 17 42 22 42 29 C42 35.5 35 39 25 39 C14 39 6.5 37 6.5 31 Z" fill={BORDER} />
      <path d="M13 26 C15 23 19 21 23 21" stroke={REVIEW} />
      {dot(29, 31, 1.1, REVIEW)}
      {dot(33.5, 27.5, 1.1, REVIEW)}
      {dot(22, 33.5, 1.1, REVIEW)}
    </>,
    'translate(0 -4)',
  ),
} satisfies Partial<Record<IconName, ReactElement>>

