import type { ReactElement } from 'react'
import type { IconName } from '../spec'
import { DANGER, DIVIDER, ENGLISH, ENGLISH_50, MATH, MATH_50, MUTED, SCIENCE, STAR, WARN, WARN_50, WHITE } from '../palette'
import { THIN, dot, ink, tube } from './glyphs-kit'

/** Mainan, alat sekolah, benda rumah, dan bentuk sederhana. */
export const THING_GLYPHS = {
  ball: ink(
    <>
      <circle cx="24" cy="24" r="19" fill={STAR} />
      <path d="M24 5 A19 19 0 0 0 24 43 C14 36 14 12 24 5 Z" fill={ENGLISH} />
      <path d="M24 5 A19 19 0 0 1 24 43 C34 36 34 12 24 5 Z" fill={MATH} />
      <path d="M10.5 19 C11.2 15.8 13 13 15.5 11.2" stroke={WHITE} />
    </>,
    'rotate(-20 24 24)',
  ),
  marble: ink(
    <>
      <circle cx="24" cy="24" r="17" fill={MATH_50} />
      <path d="M12.7 27.4 C16.1 18.4 25.1 16.7 30.2 21.2 C34.2 25.1 29.7 31.4 24.6 29.1" stroke={MATH} strokeWidth={3} />
      <path d="M18.4 35.3 C23.4 37.4 30.2 36.4 34.2 31.9" stroke={ENGLISH} strokeWidth={3} />
      <circle cx="24" cy="24" r="17" />
      <ellipse cx="17.8" cy="15.5" rx="2.8" ry="1.9" fill={WHITE} stroke="none" transform="rotate(-30 17.8 15.5)" />
    </>,
  ),
  block: ink(
    <>
      <path d="M8 18 L17 9 L40 9 L31 18 Z" fill={WHITE} />
      <path d="M31 18 L40 9 L40 31 L31 40 Z" fill={MATH_50} />
      <path d="M8 18 L31 18 L31 40 L8 40 Z" fill={MATH} />
      <rect x="12" y="22" width="15" height="14" rx="2" stroke={WHITE} strokeWidth={THIN} />
    </>,
  ),
  car: ink(
    <>
      <path d="M5 31 L5 26.5 C5 25 6 24 7.5 23.8 L12.5 23 L17 15.5 C17.8 14.3 19 13.5 20.5 13.5 L30.5 13.5 C32 13.5 33.2 14.3 34 15.5 L38.5 23 L41 23.5 C42.5 23.8 43 25 43 26.5 L43 31 C43 32.1 42.1 33 41 33 L7 33 C5.9 33 5 32.1 5 31 Z" fill={ENGLISH} />
      <path d="M19.5 16.5 L16.5 23 L23 23 L23 16.5 Z" fill={MATH_50} strokeWidth={THIN} />
      <path d="M26 16.5 L26 23 L35 23 L32 16.5 Z" fill={MATH_50} strokeWidth={THIN} />
      <circle cx="14" cy="33" r="5" fill={MUTED} />
      <circle cx="34" cy="33" r="5" fill={MUTED} />
      {dot(14, 33, 1.8, WHITE)}
      {dot(34, 33, 1.8, WHITE)}
    </>,
    'translate(0 -1.5)',
  ),
  bus: ink(
    <>
      <rect x="4" y="9" width="40" height="23" rx="4" fill={STAR} />
      <rect x="8" y="13" width="6" height="7" rx="1" fill={MATH_50} strokeWidth={THIN} />
      <rect x="16.5" y="13" width="6" height="7" rx="1" fill={MATH_50} strokeWidth={THIN} />
      <rect x="25" y="13" width="6" height="7" rx="1" fill={MATH_50} strokeWidth={THIN} />
      <path d="M34 13 L40 13 L40 21 L34 21 Z" fill={MATH_50} strokeWidth={THIN} />
      <path d="M4 25 L44 25" strokeWidth={THIN} />
      <circle cx="13" cy="32.5" r="4.5" fill={MUTED} />
      <circle cx="35" cy="32.5" r="4.5" fill={MUTED} />
      {dot(13, 32.5, 1.5, WHITE)}
      {dot(35, 32.5, 1.5, WHITE)}
    </>,
  ),
  boat: ink(
    <>
      <path d="M24 5 L24 32" />
      <path d="M24 5 L30.5 7.2 L24 9.4" fill={ENGLISH} />
      <path d="M26.5 10 L26.5 29 L40 29 Z" fill={WHITE} />
      <path d="M21.5 12 L21.5 29 L10 29 Z" fill={ENGLISH} />
      <path d="M5 32 L43 32 L37.5 41 C37 41.6 36.3 42 35.5 42 L12.5 42 C11.7 42 11 41.6 10.5 41 Z" fill={MATH} />
      <path d="M9 36 L39 36" stroke={WHITE} strokeWidth={THIN} />
    </>,
  ),
  plane: ink(
    <>
      <path d="M21 19 L6 28 L6 31.5 L21 27.5 Z" fill={MATH} />
      <path d="M27 19 L42 28 L42 31.5 L27 27.5 Z" fill={MATH} />
      <path d="M22 36 L15.5 41 L15.5 43.5 L23 41.5 Z" fill={MATH} />
      <path d="M26 36 L32.5 41 L32.5 43.5 L25 41.5 Z" fill={MATH} />
      <path d="M24 4.5 C26.5 4.5 27.5 8 27.5 11 L27.5 36 C27.5 40 26 44 24 44 C22 44 20.5 40 20.5 36 L20.5 11 C20.5 8 21.5 4.5 24 4.5 Z" fill={WHITE} />
      <path d="M22.3 11.5 C22.3 9 25.7 9 25.7 11.5 L25.7 14 L22.3 14 Z" fill={MATH_50} strokeWidth={THIN} />
    </>,
    'translate(2.6 -2.6) rotate(45 24 24)',
  ),
  bicycle: ink(
    <>
      <circle cx="12.5" cy="31" r="8" strokeWidth={3} />
      <circle cx="35.5" cy="31" r="8" strokeWidth={3} />
      {tube('M12.5 31 L22 31 L18.5 19 Z M18.5 19 L31.5 19 L22 31 M31.5 19 L35.5 31', ENGLISH, 2)}
      <path d="M31.5 19 L30.5 13.5 L35 12.5" />
      <path d="M15 16.5 L21.5 16.5" strokeWidth={3.5} />
      <path d="M18.5 19 L18.3 16.8" />
      {dot(12.5, 31, 1.8)}
      {dot(35.5, 31, 1.8)}
      {dot(22, 31, 2.2)}
    </>,
    'translate(0 -1.5)',
  ),
  kite: ink(
    <>
      <path d="M24 33 C21 36.5 27 38.5 24 41.5 C22.5 43 20.5 43.5 18.5 44" strokeWidth={THIN} />
      <path d="M21 35.5 L24.2 37.5 L21 39.5 Z M27.4 35.5 L24.2 37.5 L27.4 39.5 Z" fill={MATH} strokeWidth={THIN} />
      <path d="M24 4 L11 17 L24 17 Z" fill={ENGLISH} />
      <path d="M24 4 L37 17 L24 17 Z" fill={STAR} />
      <path d="M11 17 L24 33 L24 17 Z" fill={STAR} />
      <path d="M37 17 L24 33 L24 17 Z" fill={ENGLISH} />
    </>,
    'rotate(-12 24 24)',
  ),
  balloon: ink(
    <>
      <path d="M24 37 C21 39.5 27 41.5 24 44.5" strokeWidth={THIN} />
      <path d="M21.5 38.3 L24 35 L26.5 38.3 Z" fill={MATH} />
      <path d="M24 4 C32.5 4 38.5 10.5 38.5 19 C38.5 27.5 31 35.5 24 35.5 C17 35.5 9.5 27.5 9.5 19 C9.5 10.5 15.5 4 24 4 Z" fill={MATH} />
      <path d="M14.5 17.5 C14.5 13.5 16.5 10.5 19.5 9" stroke={WHITE} />
    </>,
  ),
  pencil: ink(
    <>
      <path d="M9 19 L6.5 19 C5.1 19 4 20.1 4 21.5 L4 26.5 C4 27.9 5.1 29 6.5 29 L9 29 Z" fill={ENGLISH_50} />
      <path d="M9 19 L13 19 L13 29 L9 29 Z" fill={DIVIDER} />
      <path d="M13 19 L34 19 L34 29 L13 29 Z" fill={STAR} />
      <path d="M13 24 L34 24" strokeWidth={THIN} />
      <path d="M34 19 L44 24 L34 29 Z" fill={WARN_50} />
      <path d="M40.4 22.2 L44 24 L40.4 25.8 Z" fill={MUTED} />
    </>,
    'translate(1.3 -1.3) rotate(-45 24 24)',
  ),
  crayon: ink(
    <>
      <path d="M33 19.5 L41 22.3 C42.2 22.7 43 23.3 43 24 C43 24.7 42.2 25.3 41 25.7 L33 28.5 Z" fill={MATH} />
      <path d="M7 18 L33 18 L33 30 L7 30 C5.9 30 5 29.1 5 28 L5 20 C5 18.9 5.9 18 7 18 Z" fill={MATH} />
      <path d="M12 18 L27 18 L27 30 L12 30 Z" fill={MATH_50} />
      <path d="M15 24 L24 24" strokeWidth={THIN} />
    </>,
    'translate(1.6 -1.5) rotate(-45 24 24)',
  ),
  eraser: ink(
    <>
      <path d="M6 22 L15 14 L27 14 L18 22 Z" fill={WHITE} />
      <path d="M18 22 L27 14 L43 14 L34 22 Z" fill={MATH_50} />
      <path d="M34 22 L43 14 L43 26 L34 34 Z" fill={MATH} />
      <path d="M6 22 L18 22 L18 34 L6 34 Z" fill={ENGLISH_50} />
      <path d="M18 22 L34 22 L34 34 L18 34 Z" fill={MATH} />
    </>,
  ),
  book: ink(
    <>
      <path d="M10 40 C10 38.3 11.3 37 13 37 L38 37 L38 43 L13 43 C11.3 43 10 41.7 10 40 Z" fill={WHITE} />
      <path d="M10 40 L10 8 C10 6.3 11.3 5 13 5 L38 5 L38 37 L13 37 C11.3 37 10 38.3 10 40 Z" fill={ENGLISH} />
      <path d="M14.5 5.5 L14.5 36.5" strokeWidth={THIN} />
      <rect x="19" y="11" width="14" height="7" rx="1" fill={WHITE} strokeWidth={THIN} />
    </>,
  ),
  bag: ink(
    <>
      <path d="M19 11 C19 5 29 5 29 11" />
      <path d="M11 17 C11 13 14 10.5 18 10.5 L30 10.5 C34 10.5 37 13 37 17 L37 41 C37 42.4 36.4 43 35 43 L13 43 C11.6 43 11 42.4 11 41 Z" fill={MATH} />
      <path d="M11 20 C16 22.5 32 22.5 37 20" strokeWidth={THIN} />
      <path d="M16 29 L32 29 L32 38.5 C32 39.9 31.4 40.5 30 40.5 L18 40.5 C16.6 40.5 16 39.9 16 38.5 Z" fill={MATH_50} />
      <path d="M16 33 L32 33" strokeWidth={THIN} />
      <rect x="22.5" y="31" width="3" height="4.5" rx="0.8" fill={STAR} strokeWidth={THIN} />
    </>,
  ),
  plate: ink(
    <>
      <ellipse cx="24" cy="25" rx="20" ry="11" fill={MATH_50} />
      <ellipse cx="24" cy="24.5" rx="13" ry="6.5" fill={WHITE} strokeWidth={THIN} />
    </>,
  ),
  basket: ink(
    <>
      {tube('M11.5 21 C11.5 5.5 36.5 5.5 36.5 21', WARN, 2.5)}
      <path d="M8 24 L40 24 L36.5 42 C36.3 43 35.4 43.5 34.5 43.5 L13.5 43.5 C12.6 43.5 11.7 43 11.5 42 Z" fill={STAR} />
      <path d="M16 26 L17.3 43" strokeWidth={THIN} />
      <path d="M24 26 L24 43" strokeWidth={THIN} />
      <path d="M32 26 L30.7 43" strokeWidth={THIN} />
      <path d="M9.6 32 L38.4 32" strokeWidth={THIN} />
      <path d="M10.8 38 L37.2 38" strokeWidth={THIN} />
      <path d="M6 22 C6 20.9 6.9 20 8 20 L40 20 C41.1 20 42 20.9 42 22 L42 24.5 C42 25.6 41.1 26.5 40 26.5 L8 26.5 C6.9 26.5 6 25.6 6 24.5 Z" fill={WARN} />
    </>,
  ),
  box: ink(
    <>
      <path d="M7 19 L15 11 L41 11 L33 19 Z" fill={WARN_50} />
      <path d="M33 19 L41 11 L41 35 L33 43 Z" fill={WARN} />
      <path d="M7 19 L33 19 L33 43 L7 43 Z" fill={STAR} />
      <path d="M17 19 L25 11 L29 11 L21 19 Z" fill={DIVIDER} strokeWidth={THIN} />
      <path d="M17 19 L21 19 L21 27 L17 27 Z" fill={DIVIDER} strokeWidth={THIN} />
    </>,
    'translate(0 -3)',
  ),
  jar: ink(
    <>
      <path d="M14 15 L34 15 L34 17 C37 18.5 38 21 38 24 L38 39 C38 41.8 35.8 44 33 44 L15 44 C12.2 44 10 41.8 10 39 L10 24 C10 21 11 18.5 14 17 Z" fill={MATH_50} />
      <path d="M14 7 L34 7 C35.1 7 36 7.9 36 9 L36 13 C36 14.1 35.1 15 34 15 L14 15 C12.9 15 12 14.1 12 13 L12 9 C12 7.9 12.9 7 14 7 Z" fill={ENGLISH} />
      <rect x="15.5" y="26" width="17" height="10" rx="1.5" fill={WHITE} strokeWidth={THIN} />
      <path d="M13.5 23 L13.5 39" stroke={WHITE} strokeWidth={3} />
    </>,
  ),
  cup: ink(
    <>
      <path d="M16 9 C14.5 7 17.5 5.5 16 3.5" strokeWidth={THIN} />
      <path d="M22 9 C20.5 7 23.5 5.5 22 3.5" strokeWidth={THIN} />
      {tube('M31 19 C38 18.5 40.5 21.5 39.5 26.5 C38.6 31 35 33 30 33', MATH, 2.5)}
      <path d="M8 13 L32 13 L30.2 39.5 C30 41.5 28.4 43 26.4 43 L13.6 43 C11.6 43 10 41.5 9.8 39.5 Z" fill={MATH} />
      <path d="M9 20 L31.5 20" stroke={WHITE} strokeWidth={THIN} />
    </>,
  ),
  button: ink(
    <>
      <circle cx="24" cy="24" r="18" fill={ENGLISH} />
      <circle cx="24" cy="24" r="12.5" strokeWidth={THIN} />
      <circle cx="20" cy="20" r="2.4" fill={WHITE} strokeWidth={THIN} />
      <circle cx="28" cy="20" r="2.4" fill={WHITE} strokeWidth={THIN} />
      <circle cx="20" cy="28" r="2.4" fill={WHITE} strokeWidth={THIN} />
      <circle cx="28" cy="28" r="2.4" fill={WHITE} strokeWidth={THIN} />
    </>,
  ),
  shell: ink(
    <>
      <path d="M18 38 L30 38 L31.5 43.5 L16.5 43.5 Z" fill={WARN_50} />
      <path d="M24 41 L10.1 33 A7 7 0 0 1 8.8 20.1 A7 7 0 0 1 17.5 10.4 A7 7 0 0 1 30.5 10.4 A7 7 0 0 1 39.2 20.1 A7 7 0 0 1 37.9 33 Z" fill={WARN_50} />
      <path d="M24 39 L11.5 21.5" strokeWidth={THIN} />
      <path d="M24 39 L19 12.5" strokeWidth={THIN} />
      <path d="M24 39 L29 12.5" strokeWidth={THIN} />
      <path d="M24 39 L36.5 21.5" strokeWidth={THIN} />
    </>,
  ),
  coin: ink(
    <>
      <circle cx="26" cy="25.5" r="16" fill={WARN} />
      <circle cx="23" cy="23" r="16" fill={STAR} />
      <circle cx="23" cy="23" r="11" strokeWidth={THIN} />
      <path d="M16 19.5 C17 16.5 19.5 14.5 22.5 14" stroke={WHITE} />
    </>,
  ),
  sock: ink(
    <>
      <path d="M14 5.5 L29 5.5 L29 26 L37.5 31 C42 33.5 42.5 39.5 38.5 42 C35.5 44 32 43.5 29.5 41.5 L17 32.5 C15 31 14 29 14 26.5 Z" fill={ENGLISH} />
      <path d="M14 5.5 L29 5.5 L29 11 L14 11 Z" fill={WHITE} />
      <path d="M15.5 17 L27.5 17" stroke={WHITE} strokeWidth={3} />
      <path d="M33.5 28.5 C30.5 31.5 30 37.5 31.5 42.4 C34 44 36.5 43.6 38.5 42 C42.5 39.5 42 33.5 37.5 31 Z" fill={STAR} />
    </>,
    'translate(-3.6 0)',
  ),
  hat: ink(
    <>
      <ellipse cx="24" cy="30" rx="20" ry="7" fill={STAR} />
      <path d="M13 30 C13 18 17 12 24 12 C31 12 35 18 35 30 C31 32 17 32 13 30 Z" fill={STAR} />
      <path d="M13.3 24.5 C18 26 30 26 34.7 24.5 L35 29.5 C30 31 18 31 13 29.5 Z" fill={ENGLISH} />
    </>,
  ),
  shoe: ink(
    <>
      <path d="M7 34 L7 20 C7 18.3 8.3 17 10 17 L18.5 17 C20.5 17 21.8 18.2 22.6 20 C24.5 24 29.5 26 36 27 C40.5 27.7 43 30 43 33 L43 34 Z" fill={MATH} />
      <path d="M5 34 L45 34 L45 36.5 C45 38.4 43.4 40 41.5 40 L8.5 40 C6.6 40 5 38.4 5 36.5 Z" fill={WHITE} />
      <path d="M24.5 23 L27 20" strokeWidth={THIN} />
      <path d="M28 25 L30.5 22" strokeWidth={THIN} />
      <path d="M31.8 26.2 L34.3 23.2" strokeWidth={THIN} />
    </>,
    'translate(-1.3 -4)',
  ),
  umbrella: ink(
    <>
      <path d="M24 24 L24 38 C24 41.5 18.5 41.5 18.5 38" />
      <path d="M24 6 L24 3.5" />
      <path d="M5 24 C5 13.5 13.5 6 24 6 C34.5 6 43 13.5 43 24 A4.75 4.75 0 0 0 33.5 24 A4.75 4.75 0 0 0 24 24 A4.75 4.75 0 0 0 14.5 24 A4.75 4.75 0 0 0 5 24 Z" fill={ENGLISH} />
      <path d="M24 6 C17 11 14.5 17 14.5 24" strokeWidth={THIN} />
      <path d="M24 6 C31 11 33.5 17 33.5 24" strokeWidth={THIN} />
    </>,
  ),
  key: ink(
    <>
      <path d="M19 21.5 L43 21.5 L43 30 L39.5 30 L39.5 26.5 L37 26.5 L37 29 L33.5 29 L33.5 26.5 L19 26.5 Z" fill={STAR} />
      <circle cx="13" cy="24" r="8" fill={STAR} />
      <circle cx="13" cy="24" r="3" fill={WHITE} strokeWidth={THIN} />
    </>,
    'rotate(-35 24 24)',
  ),
  clock: ink(
    <>
      <path d="M15 37 L11.5 42" />
      <path d="M33 37 L36.5 42" />
      <path d="M24 10 L24 7" />
      <path d="M8.5 17.5 C7 12.5 10 8 15 8.5 C17 8.8 18.2 9.8 18.8 11 Z" fill={STAR} />
      <path d="M39.5 17.5 C41 12.5 38 8 33 8.5 C31 8.8 29.8 9.8 29.2 11 Z" fill={STAR} />
      <circle cx="24" cy="26" r="15" fill={ENGLISH} />
      <circle cx="24" cy="26" r="11" fill={WHITE} strokeWidth={THIN} />
      <path d="M24 26 L24 19" strokeWidth={THIN} />
      <path d="M24 26 L29 29" strokeWidth={THIN} />
      {dot(24, 26, 1.6)}
      {dot(24, 17.5, 1)}
      {dot(32.5, 26, 1)}
      {dot(24, 34.5, 1)}
      {dot(15.5, 26, 1)}
    </>,
  ),
  bell: ink(
    <>
      <circle cx="24" cy="39" r="3.5" fill={WARN} />
      <circle cx="24" cy="8" r="2.5" fill={STAR} />
      <path d="M24 10.5 C16.5 10.5 13.5 16.5 13.5 23.5 L13.5 30.5 C13.5 32.5 11 34 9 35.5 L39 35.5 C37 34 34.5 32.5 34.5 30.5 L34.5 23.5 C34.5 16.5 31.5 10.5 24 10.5 Z" fill={STAR} />
      <path d="M18.5 29 L18.5 22 C18.5 19.5 19.5 17.5 21 16" stroke={WHITE} />
    </>,
  ),
  dot: ink(<circle cx="24" cy="24" r="12" fill={MATH} />),
  star: ink(
    <path d="M24 5.5 L29.29 18.22 L43.02 19.32 L32.56 28.28 L35.76 41.68 L24 34.5 L12.24 41.68 L15.44 28.28 L4.98 19.32 L18.71 18.22 Z" fill={STAR} />,
  ),
  heart: ink(
    <path d="M24 41 C17 35 6 28 6 18 C6 12 10.5 8 16 8 C19.5 8 22.5 10 24 13 C25.5 10 28.5 8 32 8 C37.5 8 42 12 42 18 C42 28 31 35 24 41 Z" fill={DANGER} />,
  ),
  square: ink(<rect x="8" y="8" width="32" height="32" rx="2" fill={MATH} />),
  circle: ink(<circle cx="24" cy="24" r="18" fill={ENGLISH} />),
  triangle: ink(<path d="M24 7.5 L43 40.5 L5 40.5 Z" fill={SCIENCE} />),
  flower: ink(
    <>
      {tube('M24 26 L24 43.5', SCIENCE, 2)}
      <path d="M24 38 C27 33 32 32 36 33 C34 37.5 29 39.5 24 38 Z" fill={SCIENCE} />
      <circle cx="24" cy="9.5" r="6" fill={ENGLISH_50} />
      <circle cx="31.1" cy="14.7" r="6" fill={ENGLISH_50} />
      <circle cx="28.4" cy="23.1" r="6" fill={ENGLISH_50} />
      <circle cx="19.6" cy="23.1" r="6" fill={ENGLISH_50} />
      <circle cx="16.9" cy="14.7" r="6" fill={ENGLISH_50} />
      <circle cx="24" cy="17" r="4.5" fill={STAR} />
    </>,
  ),
} satisfies Partial<Record<IconName, ReactElement>>
