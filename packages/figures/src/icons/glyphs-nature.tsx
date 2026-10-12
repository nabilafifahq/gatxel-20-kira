import type { ReactElement } from 'react'
import type { IconName } from '../spec'
import {
  BORDER,
  DANGER,
  DIVIDER,
  ENGLISH,
  ENGLISH_50,
  MATH,
  MATH_50,
  REVIEW,
  SCIENCE,
  SCIENCE_50,
  STAR,
  WARN,
  WARN_50,
  WHITE,
} from '../palette'
import { THIN, dot, ink, rays, scallop, tube } from './glyphs-kit'

const SNOWFLAKE =
  'M24 24 L24 5 M24 12 L19.76 7.76 M24 12 L28.24 7.76 M24 24 L40.45 14.5 M34.39 18 L35.95 12.2 M34.39 18 L40.19 19.55 ' +
  'M24 24 L40.45 33.5 M34.39 30 L40.19 28.45 M34.39 30 L35.95 35.8 M24 24 L24 43 M24 36 L28.24 40.24 M24 36 L19.76 40.24 ' +
  'M24 24 L7.55 33.5 M13.61 30 L12.05 35.8 M13.61 30 L7.81 28.45 M24 24 L7.55 14.5 M13.61 18 L7.81 19.55 M13.61 18 L12.05 12.2'

const CLOUD =
  'M12 36 C7 36 4 32.5 4 28.5 C4 24.5 7 21.5 11 21.5 C11.5 15.5 16.5 11 22.5 11 C27.5 11 31.5 14 33 18.5 C34 18.2 35 18 36 18 C40.5 18 44 21.5 44 27 C44 32 40.5 36 36 36 Z'

/** Tumbuhan, cuaca, langit, dan bahan alam. */
export const NATURE_GLYPHS = {
  plant: ink(
    <>
      <path d="M24 27 L24 11" />
      <path d="M24 22.5 C19 23 13.5 20.5 12 14.5 C17.5 13.5 22.5 16.5 24 22.5 Z" fill={SCIENCE} />
      <path d="M24 17.5 C27 12.5 33 10 38 11.5 C36 17 30 19.5 24 17.5 Z" fill={SCIENCE} />
      <path d="M24 11.5 C21.5 8.5 22 5 24.5 3.5 C27 6 27 9.5 24 11.5 Z" fill={SCIENCE} />
      <path d="M14 30 L34 30 L31.5 42.5 C31.3 43.4 30.6 44 29.7 44 L18.3 44 C17.4 44 16.7 43.4 16.5 42.5 Z" fill={WARN} />
      <rect x="12" y="26.5" width="24" height="5.5" rx="1.5" fill={WARN} />
    </>,
  ),
  tree: ink(
    <>
      <path d="M21 29 L20 42.5 L28 42.5 L27 29 Z" fill={WARN} />
      <path d="M24 34 L20.5 31 M24 37 L27.5 34.5" strokeWidth={THIN} />
      <path d={scallop(24, 19, 13.5, 9, 0.62)} fill={SCIENCE} />
      <path d="M15 20 C15 16 17.5 13 21 12" stroke={SCIENCE_50} />
      <path d="M13 43 L35 43" />
    </>,
  ),
  leaf: ink(
    <>
      <path d="M10 38 C8 24 18 9 40 8 C40.5 28 28 40 10 38 Z" fill={SCIENCE} />
      <path d="M6 42 L10 38 C18 30 26 22 34 14" />
      <path d="M19.5 28.5 Q18.8 25.5 19.8 22.8 M19.5 28.5 Q22.5 28.2 25.2 29.2 M26.5 21.5 Q25.8 18.5 26.8 15.8 M26.5 21.5 Q29.5 21.2 32.2 22.2" stroke={SCIENCE_50} strokeWidth={1.5} />
    </>,
  ),
  seed: ink(
    <>
      <path d="M24 5.5 C32 11.5 35 21.5 33.5 31.5 C32.3 38.5 28 43 24 43 C20 43 15.7 38.5 14.5 31.5 C13 21.5 16 11.5 24 5.5 Z" fill={WARN} />
      <path d="M24 10 C21.5 18 21.5 30 24 39" stroke={WARN_50} strokeWidth={THIN} />
      <path d="M18.5 30 C18 25 18.8 20 20.5 16" stroke={WHITE} />
    </>,
  ),
  seedling: ink(
    <>
      <path d="M24 33 C24 27 24 22 24.5 18" />
      <path d="M24.5 20 C19 21 13 18 11.5 11.5 C18 10.5 23 14 24.5 20 Z" fill={SCIENCE} />
      <path d="M24.5 18 C27 12 33 9 38.5 10.5 C37 16.5 31 19.5 24.5 18 Z" fill={SCIENCE} />
      <path d="M6 41 C10 35 17 32.5 24 32.5 C31 32.5 38 35 42 41 L42 42 C42 43.1 41.1 44 40 44 L8 44 C6.9 44 6 43.1 6 42 Z" fill={WARN} />
      {dot(15, 39.5, 1.1, WARN_50)}
      {dot(22, 37.5, 1.1, WARN_50)}
      {dot(30, 39.5, 1.1, WARN_50)}
      {dot(35, 37.5, 1.1, WARN_50)}
    </>,
    'translate(0 -3)',
  ),
  cactus: ink(
    <>
      <path d="M17 30 L12.5 30 C10 30 8.5 28.5 8.5 26 L8.5 17 C8.5 15.3 9.8 14 11.5 14 C13.2 14 14.5 15.3 14.5 17 L14.5 24 L17 24 Z" fill={SCIENCE} />
      <path d="M31 26 L35.5 26 C38 26 39.5 24.5 39.5 22 L39.5 13 C39.5 11.3 38.2 10 36.5 10 C34.8 10 33.5 11.3 33.5 13 L33.5 20 L31 20 Z" fill={SCIENCE} />
      <path d="M17 42 L17 11 C17 7.1 20.1 4 24 4 C27.9 4 31 7.1 31 11 L31 42 Z" fill={SCIENCE} />
      <path d="M21 10 L21 40 M27 10 L27 40" stroke={SCIENCE_50} strokeWidth={THIN} />
      <path d="M7 42.5 L41 42.5" />
    </>,
  ),
  mushroom: ink(
    <>
      <path d="M18 27 L17 40 C17 42 19 43.5 24 43.5 C29 43.5 31 42 31 40 L30 27 Z" fill={WHITE} />
      <path d="M5 26 C5 14 13.5 6 24 6 C34.5 6 43 14 43 26 C43 28 41.5 29 39.5 29 L8.5 29 C6.5 29 5 28 5 26 Z" fill={ENGLISH} />
      {dot(15.5, 15.5, 3, WHITE)}
      {dot(25, 11, 2.3, WHITE)}
      {dot(33, 17, 3.3, WHITE)}
      {dot(11.5, 23.5, 2, WHITE)}
      {dot(24, 21.5, 2.6, WHITE)}
      {dot(37.5, 24.5, 1.8, WHITE)}
    </>,
  ),
  grass: ink(
    <>
      <path d="M5 42 C7 35 7.5 30 7 24 C9.5 29 11 33 12 37 C13 29 14.5 21 16 14 C18 22 19.5 29 20 35 C21 26 22.5 16 24.5 8 C26.5 16 27.5 26 28 35 C29 28 30.5 21 32.5 14.5 C34 21 35 29 35.5 37 C37 33 39 29 41.5 24.5 C41 30.5 41.5 36 43 42 Z" fill={SCIENCE} />
      <path d="M4 42.5 L44 42.5" />
    </>,
  ),
  sun: ink(
    <>
      {tube(rays(24, 24, 14, 18.5, 8), STAR, 3)}
      <circle cx="24" cy="24" r="10.5" fill={STAR} />
      <path d="M17.5 22 C18 19.5 19.6 17.8 22 17.2" stroke={WHITE} />
    </>,
  ),
  moon: ink(
    <>
      <path d="M23.46 6.06 A18 18 0 1 0 38.77 30.55 A14.5 14.5 0 1 1 23.46 6.06 Z" fill={STAR} />
      <circle cx="11.5" cy="22" r="2.2" fill={WARN_50} strokeWidth={THIN} />
      <circle cx="15.5" cy="32" r="2.8" fill={WARN_50} strokeWidth={THIN} />
      <circle cx="24.5" cy="37" r="1.7" fill={WARN_50} strokeWidth={THIN} />
    </>,
    'translate(2 0)',
  ),
  earth: ink(
    <>
      <circle cx="24" cy="24" r="19" fill={MATH} />
      <path d="M13 11.5 C17 10 21.5 11 21.5 14.5 C21.5 17.5 24.5 18.5 23.5 22 C22.5 25.5 18 26 16 23 C14.5 20.5 10.5 21 9.5 18 C8.8 15.5 10.5 12.5 13 11.5 Z" fill={SCIENCE} />
      <path d="M29 9 C33 9.5 37.5 12.5 39 16.5 C40 19.5 37.5 21.5 35 20.5 C32.5 19.5 30 21 29.5 18 C29 15.5 26.5 14.5 26.5 12 C26.5 10 27.5 8.8 29 9 Z" fill={SCIENCE} />
      <path d="M27.5 27 C30.5 25.5 35 26.5 36.5 29.5 C38 32.5 35 37.5 31 38.5 C28 39.3 26.5 36.5 27.5 33.5 C28.2 31.5 25.5 29 27.5 27 Z" fill={SCIENCE} />
      <path d="M12 31 C13.5 29.5 16.5 30 17 32 C17.5 34 15.5 35.5 13.5 35 C12 34.5 11 32.5 12 31 Z" fill={SCIENCE} />
      <path d="M9.5 28 C9 25 9.3 22.5 10 20.5" stroke={MATH_50} />
    </>,
  ),
  planet: ink(
    <>
      {tube('M42.07 19.13 A19 6 -18 0 0 5.93 30.87', WARN_50, 3)}
      <circle cx="24" cy="25" r="12.5" fill={STAR} />
      <path d="M12.6 20 C18 21.5 30 20 35.2 18 M11.6 26.5 C18 28 30 27 36.4 24.5" stroke={WARN} strokeWidth={THIN} />
      <circle cx="24" cy="25" r="12.5" />
      {tube('M5.93 30.87 A19 6 -18 0 0 42.07 19.13', WARN_50, 3)}
    </>,
  ),
  cloud: ink(<path d={CLOUD} fill={WHITE} />, 'translate(0 -0.5)'),
  rain: ink(
    <>
      <path d="M15 33 C15 33 11.5 37.5 11.5 39.5 C11.5 41.4 13.1 43 15 43 C16.9 43 18.5 41.4 18.5 39.5 C18.5 37.5 15 33 15 33 Z" fill={MATH} strokeWidth={THIN} />
      <path d="M25 31 C25 31 21.5 35.5 21.5 37.5 C21.5 39.4 23.1 41 25 41 C26.9 41 28.5 39.4 28.5 37.5 C28.5 35.5 25 31 25 31 Z" fill={MATH} strokeWidth={THIN} />
      <path d="M35 33 C35 33 31.5 37.5 31.5 39.5 C31.5 41.4 33.1 43 35 43 C36.9 43 38.5 41.4 38.5 39.5 C38.5 37.5 35 33 35 33 Z" fill={MATH} strokeWidth={THIN} />
      <path d={CLOUD} fill={REVIEW} transform="translate(2.4 -4) scale(0.9)" />
    </>,
  ),
  snowflake: ink(
    <>
      {tube(SNOWFLAKE, MATH_50, 2.5)}
      <circle cx="24" cy="24" r="3" fill={WHITE} strokeWidth={THIN} />
    </>,
  ),
  rainbow: ink(
    <>
      <path d="M5 31 A19 19 0 0 1 43 31 L39 31 A15 15 0 0 0 9 31 Z" fill={ENGLISH} />
      <path d="M9 31 A15 15 0 0 1 39 31 L35 31 A11 11 0 0 0 13 31 Z" fill={STAR} />
      <path d="M13 31 A11 11 0 0 1 35 31 L31 31 A7 7 0 0 0 17 31 Z" fill={MATH} />
      <path d="M4 37 C4 34.5 6 32.5 8.5 32.5 C9.5 30 12.5 29 14.5 30.5 C17 30.5 18.5 32.5 18 35 C18 36.4 16.9 37.5 15.5 37.5 L5 37.5 C4.4 37.5 4 37.4 4 37 Z" fill={WHITE} />
      <path d="M44 37 C44 34.5 42 32.5 39.5 32.5 C38.5 30 35.5 29 33.5 30.5 C31 30.5 29.5 32.5 30 35 C30 36.4 31.1 37.5 32.5 37.5 L43 37.5 C43.6 37.5 44 37.4 44 37 Z" fill={WHITE} />
    </>,
    'translate(0 -2)',
  ),
  wind: ink(
    <>
      <path d="M5 17 L28 17 C32 17 34.5 14.5 33.5 11.5 C32.7 9 29.5 8.5 28 10.5" />
      <path d="M5 25 L37 25 C41 25 43.5 28 42.5 31 C41.5 34 37.5 34.5 36 32" />
      <path d="M9 33 L24 33 C27.5 33 29 35.5 28 38 C27.2 40 24.5 40.5 23 38.5" />
      <path d="M33 9 C36.5 6 41 6 43.5 8 C41 11 37 12 33 9 Z" fill={SCIENCE} strokeWidth={THIN} transform="rotate(-10 38 8.5)" />
    </>,
  ),
  lightning: ink(<path d="M28 4 L12 26 L22.5 26 L18 44 L36.5 19 L26 19 L31.5 4 Z" fill={STAR} />),
  rock: ink(
    <>
      <path d="M5.5 38 L8 25 L17 14.5 L30 11 L39.5 17 L42.5 30 L38 39 Z" fill={REVIEW} />
      <path d="M25 22 L39.5 17 L42.5 30 L38 39 L27 39 Z" fill={BORDER} strokeWidth={THIN} />
      <path d="M17 14.5 L30 11 L39.5 17 L25 22 Z" fill={DIVIDER} strokeWidth={THIN} />
      <path d="M25 22 L8 25" strokeWidth={THIN} />
      <path d="M5.5 38 L8 25 L17 14.5 L30 11 L39.5 17 L42.5 30 L38 39 Z" />
    </>,
  ),
  soil: ink(
    <>
      <path d="M4.5 37 C7.5 23 15 12 24 12 C33 12 40.5 23 43.5 37 Z" fill={WARN} />
      {tube('M28.5 26 C29.5 22 32 20 35 21', ENGLISH_50, 3)}
      {dot(35.3, 20.7, 0.9)}
      <ellipse cx="15.5" cy="29.5" rx="3" ry="2" fill={REVIEW} strokeWidth={THIN} />
      {dot(21.5, 22, 1.2, WARN_50)}
      {dot(11, 33.5, 1.2, WARN_50)}
      {dot(24.5, 31.5, 1.2, WARN_50)}
      {dot(33, 31, 1.2, WARN_50)}
      {dot(18, 17.5, 1.2, WARN_50)}
      {dot(27.5, 16, 1.2, WARN_50)}
      <path d="M3.5 37.5 L44.5 37.5" />
    </>,
  ),
  sand: ink(
    <>
      <path d="M4 37 C8 23 14 12 21 12 C28 12 33.5 23 38 37 Z" fill={STAR} />
      {dot(14, 29.5, 1.1, WARN)}
      {dot(20, 21, 1.1, WARN)}
      {dot(25.5, 29, 1.1, WARN)}
      {dot(10.5, 34.5, 1.1, WARN)}
      {dot(19.5, 33.5, 1.1, WARN)}
      {dot(29, 34.5, 1.1, WARN)}
      {dot(17, 16.5, 1.1, WARN)}
      <path d="M33.5 28 C33.5 22.5 42.5 22.5 42.5 28" strokeWidth={THIN} />
      <path d="M32.5 28 L43.5 28 L42 37 L34 37 Z" fill={MATH} />
      <path d="M3.5 37.5 L44.5 37.5" />
    </>,
  ),
  'water-drop': ink(
    <>
      <path d="M24 5 C24 5 37 20 37 29 C37 36.5 31.2 42.5 24 42.5 C16.8 42.5 11 36.5 11 29 C11 20 24 5 24 5 Z" fill={MATH} />
      <path d="M16.5 30 C16.5 26.5 18 23.5 20 21" stroke={WHITE} />
    </>,
  ),
  'ice-cube': ink(
    <>
      <path d="M7 16.5 L16 7.5 L41 7.5 L32 16.5 Z" fill={WHITE} />
      <path d="M32 16.5 L41 7.5 L41 31.5 L32 40.5 Z" fill={MATH_50} />
      <path d="M7 16.5 L32 16.5 L32 40.5 L7 40.5 Z" fill={MATH_50} />
      <path d="M11 22 L11 30 M11 33.5 L11 35.5" stroke={WHITE} strokeWidth={3} />
      <path d="M35.5 16.5 L35.5 21.5" stroke={WHITE} strokeWidth={THIN} />
    </>,
  ),
  steam: ink(
    <>
      {tube('M16 26 C13 22.5 19 20 16 16 C13 12 19 10 16 6.5', DIVIDER, 3.5)}
      {tube('M24 26 C21 22.5 27 20 24 16 C21 12 27 10 24 6.5', DIVIDER, 3.5)}
      {tube('M32 26 C29 22.5 35 20 32 16 C29 12 35 10 32 6.5', DIVIDER, 3.5)}
      <path d="M8.5 34 L4.5 34 M39.5 34 L43.5 34" strokeWidth={3} />
      <path d="M10 32 L38 32 L36.5 40.5 C36.3 41.9 35.1 43 33.7 43 L14.3 43 C12.9 43 11.7 41.9 11.5 40.5 Z" fill={MATH} />
      <rect x="8" y="29" width="32" height="4" rx="1.5" fill={MATH} />
    </>,
  ),
  puddle: ink(
    <>
      <path d="M24 9 C24 9 20 14 20 16.5 C20 18.7 21.8 20.5 24 20.5 C26.2 20.5 28 18.7 28 16.5 C28 14 24 9 24 9 Z" fill={MATH} strokeWidth={THIN} />
      <path d="M6 34 C6 30 11 28 17 28.5 C21 27 28 26.5 33 28 C39 28.5 43 31 42.5 34.5 C42 38 36 39.5 29 39 C24 40 15 40.5 10 39 C7 38 6 36 6 34 Z" fill={MATH_50} />
      <ellipse cx="24" cy="33.5" rx="9" ry="2.8" stroke={MATH} strokeWidth={THIN} />
      <ellipse cx="24" cy="33.5" rx="4" ry="1.2" stroke={MATH} strokeWidth={THIN} />
    </>,
  ),
  volcano: ink(
    <>
      <path d="M18 12 C18 9.5 20 8 22 8.5 C23 5.5 26.5 4.5 29 6 C31 4.5 35 5.5 35.5 8.5 C38 9 38.5 13 36 13.5 L19.5 13.5 C18.6 13.5 18 12.8 18 12 Z" fill={REVIEW} />
      <path d="M4 42 L16.5 18 C17.5 16.5 18.5 16 20 16 L28 16 C29.5 16 30.5 16.5 31.5 18 L44 42 Z" fill={WARN} />
      <path d="M16.5 18 C17.5 16.5 18.5 16 20 16 L28 16 C29.5 16 30.5 16.5 31.5 18 L33 21 C31 23 30 21 29 23.5 C28 26 26 24 25.5 27 C25 29.5 23 29.5 22.5 26.5 C22 24 20 25.5 19.5 23 C19 21 17 22.5 15.5 20 Z" fill={DANGER} />
    </>,
  ),
  mountain: ink(
    <>
      <path d="M17 40 L30.5 13 L43.5 40 Z" fill={REVIEW} />
      <path d="M30.5 13 L26.5 21 L28.6 19.6 L30.5 22 L32.4 19.6 L34.35 21 Z" fill={WHITE} strokeWidth={THIN} />
      <path d="M5 40 L18.5 9 L32 40 Z" fill={BORDER} />
      <path d="M18.5 9 L14.58 18 L16.8 16.5 L18.5 19 L20.2 16.5 L22.42 18 Z" fill={WHITE} strokeWidth={THIN} />
      <path d="M4 40.5 L44 40.5" />
    </>,
  ),
  river: ink(
    <>
      <rect x="4" y="4" width="40" height="40" rx="7" fill={SCIENCE_50} />
      <path d="M21.5 4.5 C15 9 12.5 14 17 19 C21.5 24 18 32 8 43.5 L27 43.5 C32.5 34 34 25 28 19 C24 15 24.5 9 27 4.5 Z" fill={MATH} />
      <path d="M17 33 C19 31.5 21 31.5 23 33 M24 23 C25.5 22 27 22 28.5 23" stroke={MATH_50} strokeWidth={THIN} />
      <path d="M33.5 36 L35 31.5 L36.5 36 M38 38 L39.5 33.5 L41 38 M8 23 L9.5 18.5 L11 23" stroke={SCIENCE} strokeWidth={THIN} />
    </>,
  ),
  fossil: ink(
    <>
      <path d="M5 34 C4 25 9 16 17 12 C25 8 35 9 40 15 C44.5 20.5 44 30 39 35.5 C35 40 26 41.5 17 40.5 C10 39.8 5.5 38 5 34 Z" fill={DIVIDER} />
      <circle cx="24" cy="25.5" r="11" fill={WARN_50} />
      <path d="M24 26 C24 24.3 26.4 24.3 26.4 26 C26.4 28.6 21.8 28.6 21.6 25.8 C21.4 22.2 26.6 21 28.8 23.6 C31.4 26.6 29.2 31.5 24.8 31.8 C19.5 32.2 16.5 27.8 17.6 23.5 C18.8 18.8 24 16.6 28.5 18" strokeWidth={THIN} />
      <path d="M24 14.5 L24 17.5 M31.8 17.7 L29.8 19.7 M35 25.5 L32 25.5 M31.8 33.3 L29.8 31.3 M24 36.5 L24 33.5 M16.2 33.3 L18.2 31.3 M13 25.5 L16 25.5" strokeWidth={1.5} />
    </>,
  ),
  feather: ink(
    <>
      <path d="M39 5 C30 6 19 12 14 23 C12 28 11.5 33 12.5 36.5 C16 36.5 20 34.5 23 32 L20 31 L25.5 29.5 L22.5 28 L29 25.5 L26 24.5 C33.5 18.5 38.5 11.5 39 5 Z" fill={MATH} />
      <path d="M7 42 L14 34 C20 27 28 17 37 8" stroke={WHITE} strokeWidth={THIN} />
      <path d="M7 42 L13 35" />
    </>,
  ),
} satisfies Partial<Record<IconName, ReactElement>>

