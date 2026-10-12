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
import { THIN, dot, ink, scallop, tube } from './glyphs-kit'

/** Hewan, digambar utuh supaya kaki, sayap, dan sirip bisa dipakai di soal Science. */
export const ANIMAL_GLYPHS = {
  cat: ink(
    <>
      {tube('M31 41 C38 42.5 42.5 38.5 41.5 32.5 C41 29.5 38.5 27.5 36 28.5', REVIEW, 3)}
      <path d="M14.5 41.5 C13 35 14.5 28.5 19 25.5 L29 25.5 C33.5 28.5 35 35 33.5 41.5 C33.3 42.6 32.5 43.5 31.5 43.5 L16.5 43.5 C15.5 43.5 14.7 42.6 14.5 41.5 Z" fill={REVIEW} />
      <path d="M21 34 L21 43" strokeWidth={THIN} />
      <path d="M27 34 L27 43" strokeWidth={THIN} />
      <path d="M14.5 15 L14 5 L22 10 Z" fill={REVIEW} />
      <path d="M33.5 15 L34 5 L26 10 Z" fill={REVIEW} />
      <path d="M15.8 10.5 L15.6 7.6 L18.4 9.4 Z" fill={ENGLISH_50} stroke="none" />
      <path d="M32.2 10.5 L32.4 7.6 L29.6 9.4 Z" fill={ENGLISH_50} stroke="none" />
      <path d="M13 18.5 C13 12 18 9 24 9 C30 9 35 12 35 18.5 C35 24.5 30 28 24 28 C18 28 13 24.5 13 18.5 Z" fill={REVIEW} />
      {dot(19.5, 17.5, 1.9)}
      {dot(28.5, 17.5, 1.9)}
      <path d="M22.6 21 L25.4 21 L24 22.6 Z" fill={ENGLISH} strokeWidth={1.5} />
      <path d="M24 22.6 C23.6 24.2 22 24.6 20.8 23.6 M24 22.6 C24.4 24.2 26 24.6 27.2 23.6" strokeWidth={1.5} />
      <path d="M9.5 19.5 L15.5 20.5 M9.5 23.5 L15.5 22.5 M38.5 19.5 L32.5 20.5 M38.5 23.5 L32.5 22.5" strokeWidth={1.5} />
    </>,
    'translate(-2 0)',
  ),
  dog: ink(
    <>
      {tube('M10.5 22 C7 20 5.5 16 6.5 11.5', WARN_50, 3)}
      <rect x="14.5" y="26" width="5" height="14.5" rx="2" fill={WARN_50} />
      <rect x="32" y="26" width="5" height="14.5" rx="2" fill={WARN_50} />
      <rect x="10" y="27" width="5" height="15" rx="2" fill={WARN_50} />
      <rect x="27.5" y="27" width="5" height="15" rx="2" fill={WARN_50} />
      <path d="M9 24 C9 20 12 18 16 18 L31 18 C35 18 38 20.5 38 24.5 L38 27.5 C38 30 36.5 31.5 34 31.5 L13 31.5 C10.5 31.5 9 30 9 27.5 Z" fill={WARN_50} />
      <path d="M16 18.3 C16 21.5 19 23.5 22.5 23 C25 22.5 26 20.5 25.5 18.3 Z" fill={WARN} strokeWidth={THIN} />
      {tube('M32 20.5 L37 24', ENGLISH, 2.5)}
      <path d="M31 13 C31 8.5 34 6 38 6 C41 6 43 8 43.5 10.5 L45 11.5 C46 12.2 46 15.8 45 16.5 L42.5 18 C41 20.5 38.5 22 35.5 22 C32.5 22 31 19.5 31 16.5 Z" fill={WARN_50} />
      <path d="M33 8 C29.5 8.5 28.5 14 30 18 C32.5 17.5 34.5 13.5 34.5 9.5 Z" fill={WARN} />
      {dot(38, 11.5, 1.8)}
      {dot(44.8, 13.2, 1.8)}
      <path d="M41.5 17.6 C40.5 18.6 39.2 18.8 38.2 18.3" strokeWidth={1.5} />
    </>,
    'translate(-1 0)',
  ),
  fish: ink(
    <>
      <path d="M13 24 L5.7 14 C5.2 13.4 4.2 13.7 4.3 14.5 L6.7 24 L4.3 33.5 C4.2 34.3 5.2 34.6 5.7 34 Z" fill={STAR} />
      <path d="M18.5 15.5 C20 10 26 6.5 32.5 7.5 C31 9.5 30.5 11.5 31 13.5 Z" fill={STAR} />
      <path d="M9 24 C13 16 21 12 30 12.5 C37.5 13 42.5 17.5 43.8 24 C42.5 30.5 37.5 35 30 35.5 C21 36 13 32 9 24 Z" fill={WARN} />
      <path d="M28 17 C26.3 21 26.3 27 28 31" strokeWidth={THIN} />
      <path d="M19 25.5 C20 30 24 31.5 26 30 C24.5 27.5 22 26 19 25.5 Z" fill={STAR} strokeWidth={THIN} />
      <circle cx="36" cy="21.5" r="3" fill={WHITE} strokeWidth={THIN} />
      {dot(36.8, 21.5, 1.5)}
      <path d="M40.5 27.6 C41.6 28 42.7 27.7 43.4 27" strokeWidth={1.5} />
    </>,
    'translate(0 2.6)',
  ),
  bird: ink(
    <>
      <path d="M19.5 38 L18.5 43 M16.5 43 L21 43 M25.5 38 L25.5 43 M23.5 43 L28 43" strokeWidth={THIN} />
      <path d="M12 28 L4 24.5 C3.4 24.2 2.9 24.9 3.3 25.4 L8.5 32 Z" fill={MATH} />
      <path d="M9.5 28 C9.5 21 14.5 17.5 20 17.5 C21 12 25 8.5 30.5 8.5 C36 8.5 39 12.5 39 17 C39 20 38 22 38 25 C38 33 31.5 38.5 23.5 38.5 C15.5 38.5 9.5 34.5 9.5 28 Z" fill={MATH} />
      <path d="M14 26.5 C17 21.5 25 21 29 25 C26 30.5 19.5 32 14 26.5 Z" fill={MATH_50} strokeWidth={THIN} />
      <path d="M38.5 14 L44.5 16.5 L38.5 19 Z" fill={STAR} />
      {dot(32.5, 14.5, 1.9)}
    </>,
  ),
  frog: ink(
    <>
      <path d="M11 37.5 C6 36.5 3.5 39.5 4.5 43 L13 43 Z" fill={SCIENCE} />
      <path d="M37 37.5 C42 36.5 44.5 39.5 43.5 43 L35 43 Z" fill={SCIENCE} />
      <path d="M9 30 C9 22.5 15.5 18 24 18 C32.5 18 39 22.5 39 30 C39 37.5 32.5 42 24 42 C15.5 42 9 37.5 9 30 Z" fill={SCIENCE} />
      <circle cx="16" cy="16" r="6" fill={SCIENCE} />
      <circle cx="32" cy="16" r="6" fill={SCIENCE} />
      <circle cx="16" cy="16" r="3.4" fill={WHITE} strokeWidth={THIN} />
      <circle cx="32" cy="16" r="3.4" fill={WHITE} strokeWidth={THIN} />
      {dot(16.6, 16.4, 1.7)}
      {dot(31.4, 16.4, 1.7)}
      <ellipse cx="24" cy="35" rx="8" ry="5.2" fill={SCIENCE_50} strokeWidth={THIN} />
      <path d="M15.5 25.5 C19.5 29.5 28.5 29.5 32.5 25.5" />
      {dot(12.5, 27.5, 1.8, ENGLISH_50)}
      {dot(35.5, 27.5, 1.8, ENGLISH_50)}
    </>,
    'translate(0 -2.5)',
  ),
  tadpole: ink(
    <>
      <path d="M22 21 C17 17.5 13.5 24.5 8.5 22 C6.5 21 5 19 4.5 17.5 C4.5 21.5 6 26 9.5 27.5 C14 29.5 17.5 25 22 27.5 Z" fill={MUTED} />
      <ellipse cx="29.5" cy="24.5" rx="11" ry="9" fill={MUTED} />
      <circle cx="34" cy="22" r="2.8" fill={WHITE} stroke="none" />
      {dot(34.8, 22, 1.4)}
      <path d="M35 28 C36.5 29 38.5 28.8 39.5 27.5" stroke={WHITE} strokeWidth={1.5} />
      <circle cx="42" cy="12" r="2" fill={MATH_50} strokeWidth={1.5} />
      <circle cx="38" cy="8" r="1.4" fill={MATH_50} strokeWidth={1.5} />
    </>,
    'translate(0 3.7)',
  ),
  butterfly: ink(
    <>
      <path d="M22.5 21 C19 12 12.5 7 7.5 8.5 C3.5 9.8 3.8 16 6.5 19.8 C9.5 24 16 25 22.5 23.5 Z" fill={MATH} />
      <path d="M25.5 21 C29 12 35.5 7 40.5 8.5 C44.5 9.8 44.2 16 41.5 19.8 C38.5 24 32 25 25.5 23.5 Z" fill={MATH} />
      <path d="M22.5 25 C17 25.5 11.5 28.5 10.5 34 C9.8 38.5 14 41 18 38.5 C21 36.5 22.5 31 22.8 27 Z" fill={MATH_50} />
      <path d="M25.5 25 C31 25.5 36.5 28.5 37.5 34 C38.2 38.5 34 41 30 38.5 C27 36.5 25.5 31 25.2 27 Z" fill={MATH_50} />
      <circle cx="11.5" cy="14" r="2.4" fill={STAR} strokeWidth={1.5} />
      <circle cx="36.5" cy="14" r="2.4" fill={STAR} strokeWidth={1.5} />
      <circle cx="16" cy="33.5" r="1.8" fill={STAR} strokeWidth={1.5} />
      <circle cx="32" cy="33.5" r="1.8" fill={STAR} strokeWidth={1.5} />
      <path d="M22.8 10.8 C21.5 7.5 19.5 5.5 17 5.5 M25.2 10.8 C26.5 7.5 28.5 5.5 31 5.5" strokeWidth={THIN} />
      {dot(17, 5.5, 1.4)}
      {dot(31, 5.5, 1.4)}
      <path d="M24 15.5 C25.6 15.5 26 17.5 26 19.5 L26 35 C26 37.5 25.2 39.5 24 39.5 C22.8 39.5 22 37.5 22 35 L22 19.5 C22 17.5 22.4 15.5 24 15.5 Z" fill={MUTED} />
      <circle cx="24" cy="13" r="2.8" fill={MUTED} />
    </>,
  ),
  caterpillar: ink(
    <>
      <path d="M15 35 L15 38 M22.5 35 L22.5 38 M30 34.5 L30 37.5" strokeWidth={THIN} />
      <path d="M34 16.5 L32 11 M39.5 16.5 L41 11" strokeWidth={THIN} />
      {dot(32, 11, 1.6)}
      {dot(41, 11, 1.6)}
      <circle cx="8.5" cy="31" r="4.5" fill={SCIENCE} />
      <circle cx="15" cy="29.5" r="5.5" fill={SCIENCE} />
      <circle cx="22.5" cy="29.5" r="5.5" fill={SCIENCE} />
      <circle cx="30" cy="29" r="5.5" fill={SCIENCE} />
      <circle cx="37" cy="23" r="7" fill={SCIENCE} />
      {dot(15, 27, 1.4, STAR)}
      {dot(22.5, 27, 1.4, STAR)}
      {dot(30, 26.5, 1.4, STAR)}
      {dot(38.5, 21.5, 1.8)}
      <path d="M36.5 26 C38 27.5 40.5 27.3 42 25.5" strokeWidth={1.5} />
    </>,
  ),
  chrysalis: ink(
    <>
      {tube('M5 8 L43 8', WARN, 3)}
      <path d="M33 8 C35 4.5 39.5 3.5 43 4.8 C41 8.3 37 9.6 33 8 Z" fill={SCIENCE} strokeWidth={THIN} />
      <path d="M24 9 L24 12.5" />
      <path d="M24 11.5 C29 13 31.5 19 31.5 26 C31.5 33.5 28 39.5 24 44 C20 39.5 16.5 33.5 16.5 26 C16.5 19 19 13 24 11.5 Z" fill={SCIENCE} />
      {dot(20, 21.5, 1.3, STAR)}
      {dot(24, 22.5, 1.3, STAR)}
      {dot(28, 21.5, 1.3, STAR)}
      <path d="M17.6 30.5 C21.5 32.5 26.5 32.5 30.4 30.5" strokeWidth={THIN} />
      <path d="M19.8 36.5 C22.5 38 25.5 38 28.2 36.5" strokeWidth={THIN} />
    </>,
  ),
  bee: ink(
    <>
      <path d="M12.5 26.5 L7 28 L12.5 29.5 Z" fill={INK} />
      <path d="M34 19.5 C35 16 36.5 14 39 13 M36.5 21 C38.5 18.5 40.5 17.5 43 17.5" strokeWidth={THIN} />
      {dot(39, 13, 1.4)}
      {dot(43, 17.5, 1.4)}
      <ellipse cx="25" cy="28" rx="13" ry="9.5" fill={STAR} />
      <path d="M19 19.6 Q17.6 28 19 36.4 L23 37.4 Q24.4 28 23 18.6 Z" fill={INK} stroke="none" />
      <path d="M27 18.6 Q28.4 28 27 37.4 L31 36.4 Q32.4 28 31 19.6 Z" fill={INK} stroke="none" />
      <ellipse cx="25" cy="28" rx="13" ry="9.5" />
      <ellipse cx="20.5" cy="14.5" rx="4.5" ry="7" fill={MATH_50} strokeWidth={THIN} transform="rotate(-25 20.5 14.5)" />
      <ellipse cx="28" cy="13.5" rx="4.5" ry="7" fill={MATH_50} strokeWidth={THIN} transform="rotate(20 28 13.5)" />
      {dot(34.5, 25.5, 1.8)}
      <path d="M33.5 30.5 C35 31.8 37 31.6 38 30" strokeWidth={1.5} />
    </>,
  ),
  ant: ink(
    <>
      <path d="M22.5 28.5 L18 33 L15.5 38.5" strokeWidth={THIN} />
      <path d="M25 29.5 L24.5 34 L26 39" strokeWidth={THIN} />
      <path d="M27.5 28.5 L31.5 33 L35 37.5" strokeWidth={THIN} />
      <path d="M36.5 20 L37.5 14.5 L42 12 M34 19.5 L33 14 L35.5 10.5" strokeWidth={THIN} />
      <ellipse cx="13" cy="27.5" rx="8.5" ry="7" fill={MUTED} />
      <ellipse cx="25" cy="26.5" rx="4.5" ry="3.8" fill={MUTED} />
      <circle cx="34.5" cy="24" r="5.5" fill={MUTED} />
      <circle cx="36" cy="23" r="1.9" fill={WHITE} stroke="none" />
      {dot(36.5, 23, 0.9)}
      <path d="M35.5 26.8 C36.8 27.6 38.3 27.4 39.3 26.4" stroke={WHITE} strokeWidth={1.5} />
    </>,
  ),
  snail: ink(
    <>
      <path d="M37.5 22 L35.5 13.5 M41 22 L42.5 14" />
      {dot(35.5, 13.3, 2.2)}
      {dot(42.5, 13.8, 2.2)}
      <path d="M5 39.5 C5 37.5 6.5 36.5 9 36.5 L31 36.5 C33.5 36.5 34.5 35 34.8 32 L35.2 25 C35.4 22 37 20.5 39.5 20.5 C42 20.5 43.5 22 43.5 25 L43.5 34 C43.5 38.5 40.5 41.5 36 41.5 L7 41.5 C5.9 41.5 5 40.6 5 39.5 Z" fill={WARN_50} />
      <circle cx="21" cy="26" r="12" fill={WARN} />
      <path d="M21 26.5 C21 24.5 23.8 24.5 23.8 26.5 C23.8 29.5 18.5 29.5 18.3 26.2 C18 22 24 20.5 26.5 23.5 C29.5 27 27 32.5 22 32.8 C16 33 12.5 28 14 23" strokeWidth={THIN} />
      <path d="M38.5 28 C39.5 29 41 29 42 28" strokeWidth={1.5} />
    </>,
    'translate(0 -2.9)',
  ),
  worm: ink(
    <>
      {tube('M8 27 C11 19 16.5 19 19.5 25 C22.5 31 28.5 31 31.5 25 C34 20 37 17.5 40 19', ENGLISH_50, 6.5)}
      <path d="M12.3 20.3 L14.6 24 M24.2 26.7 L26.3 30.6 M33.2 20 L35 24" strokeWidth={1.5} />
      {dot(40, 18, 1.3)}
    </>,
  ),
  spider: ink(
    <>
      <path d="M24 3.5 L24 18" strokeWidth={1.5} />
      <path d="M16.5 22 L11.5 16 L6 18.5 M15.5 25.5 L9.5 23 L4.5 26.5 M15.5 29 L9.5 31 L6.5 36 M17.5 32 L13.5 36.5 L13 41.5" strokeWidth={THIN} />
      <path d="M31.5 22 L36.5 16 L42 18.5 M32.5 25.5 L38.5 23 L43.5 26.5 M32.5 29 L38.5 31 L41.5 36 M30.5 32 L34.5 36.5 L35 41.5" strokeWidth={THIN} />
      <circle cx="24" cy="26.5" r="9" fill={MUTED} />
      <circle cx="20.8" cy="25.5" r="2.6" fill={WHITE} stroke="none" />
      <circle cx="27.2" cy="25.5" r="2.6" fill={WHITE} stroke="none" />
      {dot(21.3, 25.9, 1.3)}
      {dot(27.7, 25.9, 1.3)}
      <path d="M21.5 30.5 C23 31.7 25 31.7 26.5 30.5" stroke={WHITE} strokeWidth={1.5} />
    </>,
  ),
  ladybird: ink(
    <>
      <path d="M21.5 8 C20.5 5.5 18.5 4 16 4 M26.5 8 C27.5 5.5 29.5 4 32 4" strokeWidth={THIN} />
      <circle cx="24" cy="12" r="6.5" fill={INK} />
      <circle cx="24" cy="28" r="15.5" fill={DANGER} />
      <path d="M24 13 L24 43.5" strokeWidth={THIN} />
      {dot(16.5, 23, 3)}
      {dot(31.5, 23, 3)}
      {dot(17, 34, 2.8)}
      {dot(31, 34, 2.8)}
      {dot(21.5, 9.5, 1.2, WHITE)}
      {dot(26.5, 9.5, 1.2, WHITE)}
    </>,
  ),
  chick: ink(
    <>
      <path d="M18.5 39 L18 43.5 M15.5 43.5 L20.5 43.5 M25 39 L25 43.5 M22.5 43.5 L27.5 43.5" strokeWidth={THIN} />
      <path d="M9 27.5 L4.5 24 L6 30.5 Z" fill={STAR} />
      <ellipse cx="21" cy="30" rx="13.5" ry="11" fill={STAR} />
      <circle cx="29" cy="16.5" r="8.5" fill={STAR} />
      <path d="M27.5 8.2 C27 6 28.5 4.5 30.5 5 M29.5 8.1 C30.5 6.5 32.5 6.3 33.5 7.5" strokeWidth={THIN} />
      <path d="M37 15 L42.5 17.3 L37 19.8 Z" fill={WARN} />
      {dot(31, 14.8, 1.8)}
      {dot(33.5, 19.8, 1.6, ENGLISH_50)}
      <path d="M13 29 C16 24.5 22 25 23.5 29.5 C20.5 33.5 16 34 13 29 Z" fill={STAR} strokeWidth={THIN} />
    </>,
  ),
  hen: ink(
    <>
      <path d="M19 38 L19 43.5 M16.5 43.5 L21.5 43.5 M25.5 38 L25.5 43.5 M23 43.5 L28 43.5" strokeWidth={THIN} />
      <path d="M12.5 27 C7.5 25.5 4.5 20 5.5 13.5 C7.5 15.5 9.5 16.5 11.5 16.5 C11 13.5 12 10.5 14 8.5 C15 13.5 17.5 18 21 20 Z" fill={WARN} />
      <ellipse cx="21.5" cy="28.5" rx="14" ry="11" fill={WARN} />
      <circle cx="31.5" cy="17.5" r="7" fill={WARN} />
      <path d="M27 12.5 C26 9 28.5 7 30.5 9 C31 6 34.5 5.7 35 8.5 C37 7.3 39 9.5 37 12 C33.5 10.5 30.5 10.5 27 12.5 Z" fill={DANGER} />
      <path d="M37.8 15.8 L42.5 18 L37.8 20.2 Z" fill={STAR} />
      <path d="M36.7 21.5 C36.7 24.5 39 25.5 39.8 23.5 C40.1 22.5 39.5 21.5 38.8 21 Z" fill={DANGER} strokeWidth={THIN} />
      {dot(33, 16.2, 1.7)}
      <path d="M14 28 C17 23.5 25 23.5 28 28 C25 33 18 34 14 28 Z" fill={WARN_50} strokeWidth={THIN} />
    </>,
  ),
  duck: ink(
    <>
      <path d="M4 41 C7 39.5 10 39.5 13 41 C16 42.5 19 42.5 22 41 C25 39.5 28 39.5 31 41 C34 42.5 37 42.5 40 41 C41.5 40.3 43 40 44 40.5" stroke={MATH} strokeWidth={THIN} />
      <path d="M5 24 C8 27 13 28.5 19 28 L30 27 C36 27 40 30 39.5 33.5 C39 36.5 35 38.5 29 38.5 L17 38.5 C10.5 38.5 6 33 5 24 Z" fill={WHITE} />
      <circle cx="31" cy="19.5" r="7.5" fill={WHITE} />
      <path d="M37 19 L43.5 20 C44.5 20.2 44.5 22.3 43.5 22.5 L37.5 23.5 Z" fill={WARN} />
      {dot(32.5, 17.5, 1.7)}
      <path d="M13 31 C16 27.5 24 27.5 27 31.5 C23 34.5 17 34.5 13 31 Z" fill={WHITE} strokeWidth={THIN} />
    </>,
    'translate(-0.5 -2.9)',
  ),
  cow: ink(
    <>
      <path d="M5.5 19 C3.8 21 3.4 24.5 3.8 27.5" strokeWidth={THIN} />
      {dot(3.8, 28, 1.7)}
      <rect x="11" y="25" width="4.5" height="15.5" rx="1.5" fill={WHITE} />
      <rect x="26.5" y="25" width="4.5" height="15.5" rx="1.5" fill={WHITE} />
      <rect x="7" y="26" width="4.5" height="16" rx="1.5" fill={WHITE} />
      <rect x="22.5" y="26" width="4.5" height="16" rx="1.5" fill={WHITE} />
      <rect x="5" y="15" width="27" height="16" rx="6" fill={WHITE} />
      <path d="M11 16 C10 19.5 12.5 22.5 16 22 C19 21.5 20 18.5 19 16 Z" fill={MUTED} stroke="none" />
      <path d="M21.5 30.5 C20.5 27.5 23 24.5 26 25 C29 25.5 29.5 28.5 28.5 30.5 Z" fill={MUTED} stroke="none" />
      <path d="M15.5 31 C15.5 34.5 20 34.5 20 31" fill={ENGLISH_50} strokeWidth={THIN} />
      <path d="M32 9.5 C30 8 29.5 5.5 31 4 C32 5.5 33.5 6.8 35 7.5 Z" fill={STAR} strokeWidth={THIN} />
      <path d="M38 9.5 C40 8 40.5 5.5 39 4 C38 5.5 36.5 6.8 35 7.5 Z" fill={STAR} strokeWidth={THIN} />
      <path d="M30.5 13 L26.5 12 L28 15.5 Z" fill={WHITE} strokeWidth={THIN} />
      <path d="M39.5 13 L43.5 12 L42 15.5 Z" fill={WHITE} strokeWidth={THIN} />
      <path d="M30 13.5 C30 10.5 32 9 35 9 C38 9 40 10.5 40 13.5 L40 24 C40 27 38 28.5 35 28.5 C32 28.5 30 27 30 24 Z" fill={WHITE} />
      <ellipse cx="35" cy="24.5" rx="5" ry="3.8" fill={ENGLISH_50} />
      {dot(33.3, 24.5, 0.9)}
      {dot(36.7, 24.5, 0.9)}
      {dot(33, 16.5, 1.6)}
      {dot(37, 16.5, 1.6)}
    </>,
    'translate(1 0)',
  ),
  rabbit: ink(
    <>
      <ellipse cx="29.5" cy="41.5" rx="7" ry="2.6" fill={DIVIDER} />
      <ellipse cx="20" cy="33" rx="13" ry="10" fill={DIVIDER} />
      <circle cx="7.5" cy="33" r="4" fill={WHITE} />
      <path d="M26.5 16 C23 12 22 6 24 4.8 C26.5 3.8 29.5 9 30 15 Z" fill={DIVIDER} />
      <path d="M30.5 15 C30.5 9 32.5 4 35 4.5 C37.5 5 36.5 11.5 33.5 16.5 Z" fill={DIVIDER} />
      <path d="M26.8 13.5 C25.2 10.8 24.8 8 25.5 7.4 C26.5 7 27.8 10 28.3 13.2 Z" fill={ENGLISH_50} stroke="none" />
      <path d="M32 13.8 C32.2 10.5 33.2 7.5 34.3 7.6 C35.3 7.8 34.8 11 33.5 14 Z" fill={ENGLISH_50} stroke="none" />
      <circle cx="31" cy="22" r="8" fill={DIVIDER} />
      {dot(33.5, 20.5, 1.8)}
      {dot(38.6, 23.5, 1.4, ENGLISH)}
      {dot(35, 25, 1.6, ENGLISH_50)}
      <path d="M26 38.5 C27.5 37 29.5 37 30.5 38.5" strokeWidth={THIN} />
    </>,
    'translate(2.7 0)',
  ),
  mouse: ink(
    <>
      <path d="M8 34 C3 34.5 2.5 40.5 6.5 41 C10 41.5 12 38.5 15.5 40" strokeWidth={THIN} />
      <path d="M17 39.5 L16 42 M27 39.5 L27.5 42" strokeWidth={THIN} />
      <path d="M7 33.5 C7 26 13 21 21 21 C28 21 33 24.5 37.5 29 L42.5 31.5 C43.5 32 43.5 34 42.5 34.5 L38.5 36 C34.5 38.5 28.5 39.5 21.5 39.5 C13 39.5 7 38 7 33.5 Z" fill={BORDER} />
      <circle cx="28.5" cy="20" r="6.5" fill={BORDER} />
      <circle cx="28.5" cy="20" r="3.8" fill={ENGLISH_50} stroke="none" />
      {dot(34.5, 27.5, 1.8)}
      {dot(43, 33, 1.8, ENGLISH)}
    </>,
    'translate(0 -3.6)',
  ),
  lion: ink(
    <>
      <path d="M8 23 C5 25 4 30 5.5 34" strokeWidth={THIN} />
      <path d="M5.5 34 C3.5 35 3.5 38 5.5 38.5 C7.5 38.5 8 35.5 5.5 34 Z" fill={WARN} strokeWidth={THIN} />
      <rect x="13.5" y="26" width="4.5" height="15" rx="1.5" fill={STAR} />
      <rect x="27.5" y="26" width="4.5" height="15" rx="1.5" fill={STAR} />
      <rect x="9.5" y="27" width="4.5" height="15" rx="1.5" fill={STAR} />
      <rect x="23.5" y="27" width="4.5" height="15" rx="1.5" fill={STAR} />
      <rect x="7" y="18" width="26" height="14.5" rx="6" fill={STAR} />
      <path d={scallop(32, 19, 10, 12, 0.6)} fill={WARN} />
      <circle cx="27.5" cy="12.5" r="2.6" fill={STAR} />
      <circle cx="36.5" cy="12.5" r="2.6" fill={STAR} />
      <circle cx="32" cy="19.5" r="6.5" fill={STAR} />
      {dot(29.7, 18.5, 1.5)}
      {dot(34.3, 18.5, 1.5)}
      <path d="M30.8 21.3 L33.2 21.3 L32 22.8 Z" fill={WARN} strokeWidth={1.5} />
      <path d="M32 22.8 C31.5 24.2 30 24.5 29.3 23.8 M32 22.8 C32.5 24.2 34 24.5 34.7 23.8" strokeWidth={1.5} />
    </>,
  ),
  elephant: ink(
    <>
      <path d="M6.5 19 C5 21.5 4.8 25 5.2 28" strokeWidth={THIN} />
      <rect x="12.5" y="25" width="5.5" height="16" rx="2" fill={REVIEW} />
      <rect x="27" y="25" width="5.5" height="16" rx="2" fill={REVIEW} />
      <rect x="8" y="26" width="5.5" height="16" rx="2" fill={REVIEW} />
      <rect x="22.5" y="26" width="5.5" height="16" rx="2" fill={REVIEW} />
      <path d="M6 22 C6 15 10.5 11 17 11 L26 11 C31 11 34 14 34 19 L34 27 C34 29.5 32.5 31 30 31 L10 31 C7.5 31 6 29.5 6 27 Z" fill={REVIEW} />
      {tube('M40 21.5 C41.8 26 42.2 31 40.8 35.5 C40.3 37.5 40.8 39 42 38.7', REVIEW, 3.5)}
      <circle cx="35" cy="18" r="8.5" fill={REVIEW} />
      <path d="M31 10 C24.5 9.5 21.5 16 22.5 22.5 C23.5 28.5 30 30.5 33.5 27 C35.5 24.5 35.5 12.5 31 10 Z" fill={REVIEW} />
      <path d="M30.3 13 C26.5 13 24.8 17.5 25.5 22 C26.2 26 30 27.3 31.8 25.2 C33 23.5 33 14.5 30.3 13 Z" fill={ENGLISH_50} stroke="none" />
      {dot(37.5, 15.5, 1.8)}
    </>,
    'translate(-1 -1.5)',
  ),
  monkey: ink(
    <>
      {tube('M31 39 C38.5 41 43 36 41 30.5 C40 27.5 36.5 27.5 36 30', WARN, 2.5)}
      <ellipse cx="24" cy="33" rx="9" ry="9.5" fill={WARN} />
      <ellipse cx="24" cy="34.5" rx="5.5" ry="6" fill={WARN_50} strokeWidth={THIN} />
      <ellipse cx="17.5" cy="42" rx="4" ry="2.3" fill={WARN} />
      <ellipse cx="30.5" cy="42" rx="4" ry="2.3" fill={WARN} />
      <circle cx="12.5" cy="16" r="4.5" fill={WARN} />
      <circle cx="35.5" cy="16" r="4.5" fill={WARN} />
      <circle cx="12.5" cy="16" r="2.3" fill={WARN_50} stroke="none" />
      <circle cx="35.5" cy="16" r="2.3" fill={WARN_50} stroke="none" />
      <circle cx="24" cy="16" r="10.5" fill={WARN} />
      <path d="M17 15 C17 11 20.5 10 24 12.3 C27.5 10 31 11 31 15 C31 16.6 30.2 17.6 29.8 18.6 C31.2 20.5 30 25 24 25 C18 25 16.8 20.5 18.2 18.6 C17.8 17.6 17 16.6 17 15 Z" fill={WARN_50} />
      {dot(21, 15.5, 1.7)}
      {dot(27, 15.5, 1.7)}
      {dot(23, 19.5, 0.8)}
      {dot(25, 19.5, 0.8)}
      <path d="M20.5 21.5 C22.5 23.5 25.5 23.5 27.5 21.5" strokeWidth={1.5} />
    </>,
  ),
  snake: ink(
    <>
      {tube('M7 39 C13 43 23 41.5 23 35 C23 29 12.5 30 12.5 23 C12.5 16 22 13 29.5 15.5', SCIENCE, 6)}
      {dot(11, 40.4, 1.3, STAR)}
      {dot(18.5, 40, 1.3, STAR)}
      {dot(21.8, 32.5, 1.3, STAR)}
      {dot(14.5, 28.5, 1.3, STAR)}
      {dot(13.3, 21.5, 1.3, STAR)}
      {dot(20, 15.8, 1.3, STAR)}
      <path d="M39 15.5 L42.5 15.5 L44.5 13.5 M42.5 15.5 L44.5 17.5" stroke={DANGER} strokeWidth={1.5} />
      <ellipse cx="33" cy="15.5" rx="6.5" ry="5" fill={SCIENCE} />
      {dot(34.5, 13.8, 1.7)}
    </>,
    'translate(0 -3.5)',
  ),
  lizard: ink(
    <>
      {tube('M21 18.5 L15 15.5 L13.5 11.5', SCIENCE, 2.5)}
      {tube('M27 18.5 L33 15.5 L34.5 11.5', SCIENCE, 2.5)}
      {tube('M21.5 30 L15.5 33 L14.5 37', SCIENCE, 2.5)}
      {tube('M26.5 30 L32.5 33 L33.5 37', SCIENCE, 2.5)}
      <path d="M21.5 34 C21 40 25 44.5 31 43.8 C35.5 43.3 38 40 37 36.5 C35.5 38.5 33.5 40 30.5 40 C27.5 40 26 37.5 26.5 34 Z" fill={SCIENCE} />
      <path d="M24 6 C27.5 6 29 9 28.5 12.5 C28 15 27 16.5 27 19 C28 24 28 29 27 33 C26.5 35.5 25.3 37 24 37 C22.7 37 21.5 35.5 21 33 C20 29 20 24 21 19 C21 16.5 20 15 19.5 12.5 C19 9 20.5 6 24 6 Z" fill={SCIENCE} />
      {dot(21.8, 10.5, 1.5)}
      {dot(26.2, 10.5, 1.5)}
      {dot(24, 21.5, 1.5, STAR)}
      {dot(24, 27, 1.5, STAR)}
      {dot(24, 32, 1.3, STAR)}
    </>,
  ),
  turtle: ink(
    <>
      <path d="M9.5 31 L8.5 38.5 C8.3 39.8 9 40.5 10.2 40.5 L13 40.5 C14.2 40.5 15 39.8 15 38.5 L15.5 31 Z" fill={SCIENCE_50} />
      <path d="M29.5 31 L30.5 38.5 C30.7 39.8 31.5 40.5 32.7 40.5 L35.5 40.5 C36.7 40.5 37.3 39.6 37 38.4 L35.5 31 Z" fill={SCIENCE_50} />
      <path d="M7.5 30.5 L4.5 32 L7.5 33.5 Z" fill={SCIENCE_50} />
      <path d="M33.5 29 C34.5 25 37 21.5 40.3 21.5 C42.7 21.5 44 23.5 43.8 26 C43.5 29 41 31 37.5 31 Z" fill={SCIENCE_50} />
      <path d="M7 30 C7 19.5 14 12.5 23 12.5 C32 12.5 39 19.5 39 30 Z" fill={SCIENCE} />
      <path d="M18 21.5 L23 17.5 L28 21.5 L27 27.5 L19 27.5 Z" strokeWidth={THIN} />
      <path d="M23 17.5 L23 13 M18 21.5 L10.5 21 M28 21.5 L35.5 21 M19 27.5 L17 30 M27 27.5 L29 30" strokeWidth={THIN} />
      <path d="M5.5 30 L40.5 30 C40.5 32 39.5 33 38 33 L8 33 C6.5 33 5.5 32 5.5 30 Z" fill={SCIENCE_50} />
      {dot(40.5, 25, 1.7)}
      <path d="M39.5 28.3 C40.8 28.8 42.2 28.5 43.1 27.6" strokeWidth={1.5} />
    </>,
    'translate(0 -2.5)',
  ),
  crab: ink(
    <>
      <path d="M14 30 L8 32 L5.5 36.5 M15 33 L10 36.5 L9 41 M18 35.5 L15 39.5 L15 43" strokeWidth={THIN} />
      <path d="M34 30 L40 32 L42.5 36.5 M33 33 L38 36.5 L39 41 M30 35.5 L33 39.5 L33 43" strokeWidth={THIN} />
      {tube('M15 26 L11 21', ENGLISH, 2.5)}
      {tube('M33 26 L37 21', ENGLISH, 2.5)}
      <path d="M11.5 22.5 C6.5 23 3.5 19 4.5 14.5 C5 12.5 6.5 11 8 11 L9.5 16 L12.5 12.5 C14.5 14.5 15 19.5 11.5 22.5 Z" fill={ENGLISH} />
      <path d="M36.5 22.5 C41.5 23 44.5 19 43.5 14.5 C43 12.5 41.5 11 40 11 L38.5 16 L35.5 12.5 C33.5 14.5 33 19.5 36.5 22.5 Z" fill={ENGLISH} />
      <path d="M20.5 22 L19.5 16 M27.5 22 L28.5 16" strokeWidth={THIN} />
      <ellipse cx="24" cy="29" rx="12.5" ry="8.5" fill={ENGLISH} />
      <circle cx="19.5" cy="14.5" r="2.6" fill={WHITE} strokeWidth={THIN} />
      <circle cx="28.5" cy="14.5" r="2.6" fill={WHITE} strokeWidth={THIN} />
      {dot(19.8, 14.8, 1.2)}
      {dot(28.8, 14.8, 1.2)}
      <path d="M20.5 30 C22.5 32 25.5 32 27.5 30" strokeWidth={1.5} />
    </>,
    'translate(0 -2.9)',
  ),
  whale: ink(
    <>
      <path d="M28 13.5 L28 9 M28 9 C26.5 6.5 23.5 6 22 7.5 M28 9 C29.5 6.5 32.5 6 34 7.5" stroke={MATH} strokeWidth={THIN} />
      <path d="M14 31 C10 30 8 27 7.5 23 L4 20.5 C3 19.7 3.5 18 4.8 18.2 L8 19 L9.5 15.5 C10 14.3 11.6 14.5 11.7 15.8 L11.5 21 C12 24 13.5 26 16 27.5 Z" fill={MATH} />
      <path d="M44 29 C44 21 37 15 28 15 C20 15 14.5 20 13.5 27 C13 31 13.5 34 15 36 C17.5 39.5 22 40.5 28 40.5 L35 40.5 C40.5 40.5 44 36 44 29 Z" fill={MATH} />
      <path d="M15 36 C17.5 39.5 22 40.5 28 40.5 L35 40.5 C39.5 40.5 42.5 37.5 43.6 33 C35 36.5 23 37 15 36 Z" fill={MATH_50} strokeWidth={THIN} />
      {dot(35.5, 26.5, 1.9)}
      <path d="M37.5 31.5 C39.5 32 41.5 31.5 43 30" strokeWidth={1.5} />
    </>,
  ),
  camel: ink(
    <>
      <path d="M8.5 21 C6.5 23 6 26 6.5 29" strokeWidth={THIN} />
      <rect x="13" y="25" width="4.5" height="17" rx="2" fill={STAR} />
      <rect x="29.5" y="25" width="4.5" height="17" rx="2" fill={STAR} />
      <rect x="9.5" y="26" width="4.5" height="17" rx="2" fill={STAR} />
      <rect x="26" y="26" width="4.5" height="17" rx="2" fill={STAR} />
      <path d="M8 25 C8 20.5 10 18.5 12 18 C13 12.5 16 10 18.5 10 C21 10 22.5 12.5 23 15 C23.5 12.5 25.5 10 28 10 C31 10 33 12.5 33.5 17.5 L35 21 C35.5 25 34 28.5 30.5 28.5 L11.5 28.5 C9.5 28.5 8 27 8 25 Z" fill={STAR} />
      <path d="M33 19 C35.5 16.5 36.5 13.5 37 10.5 C37.5 7 40 5.5 42.5 6 C44.5 6.5 45.5 8.5 45 10.5 C44.5 12.8 42.8 13.5 41 14 C40.5 18 39 22 35.5 26 Z" fill={STAR} />
      <path d="M39.5 6.5 L38.8 4" strokeWidth={THIN} />
      {dot(41.5, 9.3, 1.5)}
    </>,
    'translate(-1 0)',
  ),
  penguin: ink(
    <>
      <path d="M16.5 42 C16 44 20 44.8 22 43 Z" fill={STAR} />
      <path d="M31.5 42 C32 44 28 44.8 26 43 Z" fill={STAR} />
      <path d="M13.5 22 C9.5 25 8 30 8.5 34 C11 33 13.5 30 14 27.5 Z" fill={MUTED} />
      <path d="M34.5 22 C38.5 25 40 30 39.5 34 C37 33 34.5 30 34 27.5 Z" fill={MUTED} />
      <path d="M24 4.5 C31 4.5 35 11.5 35 20.5 L35 32 C35 39 30.5 43 24 43 C17.5 43 13 39 13 32 L13 20.5 C13 11.5 17 4.5 24 4.5 Z" fill={MUTED} />
      <path d="M24 15 C25 11.5 30.5 10.5 31 15.5 C31.3 18 31 20 31.5 23 L31.5 32 C31.5 37.5 28.5 41 24 41 C19.5 41 16.5 37.5 16.5 32 L16.5 23 C17 20 16.7 18 17 15.5 C17.5 10.5 23 11.5 24 15 Z" fill={WHITE} />
      {dot(20.5, 15.5, 1.7)}
      {dot(27.5, 15.5, 1.7)}
      <path d="M21.5 19 L26.5 19 L24 22.5 Z" fill={STAR} />
      {dot(18.8, 20.5, 1.4, ENGLISH_50)}
      {dot(29.2, 20.5, 1.4, ENGLISH_50)}
    </>,
  ),
  'polar-bear': ink(
    <>
      <path d="M4 43.5 C8 38.5 16 37 24 37 C32 37 40 38.5 44 43.5 Z" fill={MATH_50} />
      <path d="M13 40 C11 32 13 24.5 18 21.5 L30 21.5 C35 24.5 37 32 35 40 Z" fill={WHITE} />
      <ellipse cx="18" cy="40" rx="5" ry="2.8" fill={WHITE} />
      <ellipse cx="30" cy="40" rx="5" ry="2.8" fill={WHITE} />
      <path d="M17.5 26 C15 29.5 15 34 17 36.5 M30.5 26 C33 29.5 33 34 31 36.5" strokeWidth={THIN} />
      <circle cx="15.5" cy="9.5" r="3.3" fill={WHITE} />
      <circle cx="32.5" cy="9.5" r="3.3" fill={WHITE} />
      <circle cx="24" cy="15.5" r="9.5" fill={WHITE} />
      <ellipse cx="24" cy="19.5" rx="4.8" ry="3.6" fill={WHITE} strokeWidth={THIN} />
      <ellipse cx="24" cy="18.2" rx="2" ry="1.3" fill={INK} stroke="none" />
      <path d="M24 19.5 L24 21.3 M22.2 21.8 C23.2 22.5 24.8 22.5 25.8 21.8" strokeWidth={1.5} />
      {dot(20, 13.5, 1.5)}
      {dot(28, 13.5, 1.5)}
    </>,
  ),
  owl: ink(
    <>
      <path d="M12.5 14 L10.5 5 L18.5 9.5 Z" fill={WARN} />
      <path d="M35.5 14 L37.5 5 L29.5 9.5 Z" fill={WARN} />
      <path d="M19 42.5 L18 45 M21 42.5 L21 45 M27 42.5 L27 45 M29 42.5 L30 45" strokeWidth={THIN} />
      <path d="M24 7 C32 7 37 13 37 21 L37 31 C37 38.5 31 43 24 43 C17 43 11 38.5 11 31 L11 21 C11 13 16 7 24 7 Z" fill={WARN} />
      <path d="M14 24 C12.5 28 12.5 33 14.5 37 M34 24 C35.5 28 35.5 33 33.5 37" strokeWidth={THIN} />
      <path d="M24 27 C29.5 27 32.5 30.5 32.5 34.5 C32.5 38.5 29 41.5 24 41.5 C19 41.5 15.5 38.5 15.5 34.5 C15.5 30.5 18.5 27 24 27 Z" fill={WARN_50} strokeWidth={THIN} />
      <path d="M20 32 L21.5 33.5 L23 32 M25 32 L26.5 33.5 L28 32 M22.5 36.5 L24 38 L25.5 36.5" strokeWidth={1.5} />
      <circle cx="18.5" cy="19" r="6" fill={WHITE} />
      <circle cx="29.5" cy="19" r="6" fill={WHITE} />
      {dot(19.5, 19.5, 2.4)}
      {dot(28.5, 19.5, 2.4)}
      {dot(20.3, 18.6, 0.8, WHITE)}
      {dot(29.3, 18.6, 0.8, WHITE)}
      <path d="M22 24 L26 24 L24 27.5 Z" fill={STAR} />
    </>,
  ),
  bat: ink(
    <>
      <path d="M20 19 C15 12.5 9 11 4 13.5 C5.8 15.5 6.3 18.5 5.5 21.5 C8 21 10 22 11 24.5 C13 23 15.5 23.5 17 26 C18.5 24.5 20 24.5 21 25.5 Z" fill={MUTED} />
      <path d="M28 19 C33 12.5 39 11 44 13.5 C42.2 15.5 41.7 18.5 42.5 21.5 C40 21 38 22 37 24.5 C35 23 32.5 23.5 31 26 C29.5 24.5 28 24.5 27 25.5 Z" fill={MUTED} />
      <path d="M20.5 14 L19.5 8.5 L23.5 12 Z" fill={MUTED} />
      <path d="M27.5 14 L28.5 8.5 L24.5 12 Z" fill={MUTED} />
      <path d="M22.5 32 L22 35 M25.5 32 L26 35" strokeWidth={THIN} />
      <ellipse cx="24" cy="25" rx="5.5" ry="8" fill={MUTED} />
      <circle cx="24" cy="17" r="5.5" fill={MUTED} />
      <circle cx="22" cy="16.5" r="1.7" fill={WHITE} stroke="none" />
      <circle cx="26" cy="16.5" r="1.7" fill={WHITE} stroke="none" />
      {dot(22.2, 16.7, 0.8)}
      {dot(26.2, 16.7, 0.8)}
      <path d="M22.3 19.5 C23.3 20.4 24.7 20.4 25.7 19.5" stroke={WHITE} strokeWidth={1.5} />
    </>,
    'translate(0 2)',
  ),
  shark: ink(
    <>
      <path d="M22.5 16 L27.5 6.5 C27.9 5.8 28.8 6 28.9 6.8 L31 16" fill={REVIEW} />
      <path d="M13.5 20.5 L6 11.5 C5.5 11 4.8 11.4 5 12 L8 24 L5.1 34.5 C4.9 35.2 5.7 35.6 6.2 35.1 L13.5 27.5 Z" fill={REVIEW} />
      <path d="M10 24 C14 17.5 23 14.5 31.5 15 C38 15.5 42.5 19.5 44 24 C42.5 28.5 38 32 31.5 32.5 C23 33.5 14 30.5 10 24 Z" fill={REVIEW} />
      <path d="M14 27.5 C20 31.5 31 32.5 39.5 29 C41.3 28 42.8 26.3 43.5 25.2 C41.5 28.8 37.5 31.8 31.5 32.4 C24.5 33.2 18 31 14 27.5 Z" fill={WHITE} strokeWidth={THIN} />
      <path d="M26 29 L22.5 36 C22.2 36.7 23 37.2 23.6 36.8 L31.5 31" fill={REVIEW} />
      <path d="M33.5 21.5 C32.8 23 32.8 25 33.5 26.5 M36 21 C35.3 22.8 35.3 24.8 36 26.3" strokeWidth={1.5} />
      {dot(39, 21, 1.7)}
      <path d="M39.5 26.5 C41 27 42.3 26.6 43.2 25.7" strokeWidth={1.5} />
    </>,
    'translate(-0.5 2.5)',
  ),
} satisfies Partial<Record<IconName, ReactElement>>
