import type { ReactElement } from 'react'
import type { IconName } from '../spec'
import { DANGER, ENGLISH, ENGLISH_50, INK, MATH, MATH_50, SCIENCE, SCIENCE_50, STAR, WARN, WARN_50, WHITE } from '../palette'
import { THIN, dot, ink } from './glyphs-kit'

/** Makanan dan minuman untuk soal hitung. */
export const FOOD_GLYPHS = {
  apple: ink(
    <>
      <path d="M24 15 C24 11 25.5 8 28 6" />
      <path d="M24 15 C20 11.5 9 11 8 23 C7 34 14.5 44 20 43 C22 42.6 23 42 24 42 C25 42 26 42.6 28 43 C33.5 44 41 34 40 23 C39 11 28 11.5 24 15 Z" fill={ENGLISH} />
      <path d="M27 10.5 C29 6 34 4.5 38 6 C36.5 10 32 12 27 10.5 Z" fill={SCIENCE} />
      <path d="M13.5 22 C14 19 15.5 17.2 17.8 16.5" stroke={WHITE} />
    </>,
  ),
  pear: ink(
    <>
      <path d="M24 12 C24.5 9 25.5 6.5 27 4.5" />
      <path d="M24 11 C19.5 11 18.5 15 18.5 19 C18.5 22.5 16.5 24.5 13.5 28.5 C10.5 32.5 10.5 38.5 14.5 41.5 C18.5 44.5 29.5 44.5 33.5 41.5 C37.5 38.5 37.5 32.5 34.5 28.5 C31.5 24.5 29.5 22.5 29.5 19 C29.5 15 28.5 11 24 11 Z" fill={STAR} />
      <path d="M25.5 8.5 C27.5 4.5 32 3.5 35.5 5 C34 9 29.5 10 25.5 8.5 Z" fill={SCIENCE} />
      <path d="M15.5 33.5 C15.5 31 16.5 29.2 18 28" stroke={WHITE} />
    </>,
  ),
  banana: ink(
    <>
      <path d="M40.6 22 L42 15 L45 15.8 L43.6 23.2 Z" fill={SCIENCE} />
      <path d="M6.5 15 C7 28.5 18 37 30 35.5 C36 34.7 40 30.5 41.5 24 L40.5 20.5 C38 25.5 33 28.5 26 28.5 C17.5 28.5 11.5 22.5 9.5 14.5 C9 13 7 13 6.5 15 Z" fill={STAR} />
      <path d="M12 20.5 C16 27.5 22.5 31.5 31 31.8" strokeWidth={THIN} />
    </>,
    'translate(-1.7 0)',
  ),
  orange: ink(
    <>
      <path d="M24 11 L24 6.5" />
      <circle cx="24" cy="26" r="17" fill={WARN} />
      <path d="M24.5 8.5 C26.5 4.5 31.5 3.5 35 5 C33.5 9 28.5 10 24.5 8.5 Z" fill={SCIENCE} />
      <path d="M13.5 23 C14 19.5 16 16.8 19 15.5" stroke={WARN_50} />
      {dot(30, 31, 1.1, WARN_50)}
      {dot(33, 25, 1.1, WARN_50)}
      {dot(26, 36, 1.1, WARN_50)}
      {dot(19, 33, 1.1, WARN_50)}
    </>,
  ),
  strawberry: ink(
    <>
      <path d="M24 12 L24 5.5" />
      <path d="M24 43.5 C15 40 7.5 31 8 22.5 C8.5 15.5 15 13.5 24 15.5 C33 13.5 39.5 15.5 40 22.5 C40.5 31 33 40 24 43.5 Z" fill={DANGER} />
      <path d="M12 17 C15 14.5 18 13.5 20.5 14 L18.5 8.5 L24 11.5 L29.5 8.5 L27.5 14 C30 13.5 33 14.5 36 17 C32 19.5 28 18.5 24 17.5 C20 18.5 16 19.5 12 17 Z" fill={SCIENCE} />
      {dot(16, 25, 1.2, STAR)}
      {dot(24, 24, 1.2, STAR)}
      {dot(32, 25, 1.2, STAR)}
      {dot(19.5, 31.5, 1.2, STAR)}
      {dot(28.5, 31.5, 1.2, STAR)}
      {dot(24, 37.5, 1.2, STAR)}
    </>,
  ),
  cherry: ink(
    <>
      <path d="M15 27 C16 20 21 12.5 29 8" />
      <path d="M33 28.5 C32 21.5 31 14.5 29 8" />
      <path d="M29 8 C32.5 4 38 3.5 42 5.5 C39 9.5 33.5 10.5 29 8 Z" fill={SCIENCE} />
      <circle cx="15" cy="34" r="8.5" fill={DANGER} />
      <circle cx="33" cy="35.5" r="8" fill={DANGER} />
      <path d="M10.3 32.5 C10.6 30.4 12 28.9 14 28.4" stroke={WHITE} />
      <path d="M28.5 34 C28.8 32 30.1 30.6 32 30.1" stroke={WHITE} />
    </>,
  ),
  grapes: ink(
    <>
      <path d="M24 13 L25 6" />
      <circle cx="24" cy="38" r="6.5" fill={SCIENCE} />
      <circle cx="18" cy="29" r="6.5" fill={SCIENCE} />
      <circle cx="30" cy="29" r="6.5" fill={SCIENCE} />
      <circle cx="12" cy="20" r="6.5" fill={SCIENCE} />
      <circle cx="24" cy="20" r="6.5" fill={SCIENCE} />
      <circle cx="36" cy="20" r="6.5" fill={SCIENCE} />
      {dot(21.5, 35.5, 1.4, SCIENCE_50)}
      {dot(15.5, 26.5, 1.4, SCIENCE_50)}
      {dot(27.5, 26.5, 1.4, SCIENCE_50)}
      {dot(9.5, 17.5, 1.4, SCIENCE_50)}
      {dot(21.5, 17.5, 1.4, SCIENCE_50)}
      {dot(33.5, 17.5, 1.4, SCIENCE_50)}
      <path d="M25 8 C28 3.5 34 3 38 5 C36 9.5 30 10.5 25 8 Z" fill={SCIENCE_50} />
    </>,
  ),
  watermelon: ink(
    <>
      <path d="M4 14 A20 20 0 0 0 44 14 Z" fill={SCIENCE} />
      <path d="M7.5 14 A16.5 16.5 0 0 0 40.5 14 Z" fill={SCIENCE_50} stroke="none" />
      <path d="M9.5 14 A14.5 14.5 0 0 0 38.5 14 Z" fill={DANGER} stroke="none" />
      <path d="M4 14 L44 14" />
      <ellipse cx="16" cy="19" rx="1.2" ry="1.9" fill={INK} stroke="none" />
      <ellipse cx="24" cy="21" rx="1.2" ry="1.9" fill={INK} stroke="none" />
      <ellipse cx="32" cy="19" rx="1.2" ry="1.9" fill={INK} stroke="none" />
      <ellipse cx="20" cy="27" rx="1.2" ry="1.9" fill={INK} stroke="none" />
      <ellipse cx="28" cy="27" rx="1.2" ry="1.9" fill={INK} stroke="none" />
    </>,
  ),
  carrot: ink(
    <>
      <path d="M31 16 C29 11 29 7 31 4 C34 7 34 11 32.5 16 Z" fill={SCIENCE} />
      <path d="M33 17.5 C35 12.5 39 10 43 10 C42 14 38 17.5 33 17.5 Z" fill={SCIENCE} />
      <path d="M32 16.5 C33.5 11 36 7 39.5 5 C40 9 37 14 32 16.5 Z" fill={SCIENCE} />
      <path d="M26.6 13 A6 6 0 0 1 35.4 21 C28 29 18 37 11 42 C9.5 43 7.5 41.5 8.5 40 C14 32 20 21 26.6 13 Z" fill={WARN} />
      <path d="M21.5 23.5 L25 25.5" strokeWidth={THIN} />
      <path d="M16.5 31 L19.5 32.8" strokeWidth={THIN} />
      <path d="M26 17.5 L29 19" strokeWidth={THIN} />
    </>,
  ),
  bread: ink(
    <>
      <path d="M11 42 L11 23 C6.5 22 5 16.5 7 12.5 C10 7 17.5 6 24 6 C30.5 6 38 7 41 12.5 C43 16.5 41.5 22 37 23 L37 42 C37 43.1 36.1 44 35 44 L13 44 C11.9 44 11 43.1 11 42 Z" fill={WARN} />
      <path d="M15.5 39.5 L15.5 19.5 C12 18.8 11 16.2 12 14.5 C14 11.4 19 10.5 24 10.5 C29 10.5 34 11.4 36 14.5 C37 16.2 36 18.8 32.5 19.5 L32.5 39.5 Z" fill={WARN_50} strokeWidth={THIN} />
    </>,
  ),
  cookie: ink(
    <>
      <path d="M33 8.4 A18 18 0 1 0 42 24 A4.5 4.5 0 0 1 37.5 17.5 A5.5 5.5 0 0 1 33 8.4 Z" fill={STAR} />
      {dot(16, 17, 2.2, WARN)}
      {dot(26, 15, 2, WARN)}
      {dot(21, 25, 2.2, WARN)}
      {dot(31, 29, 2.2, WARN)}
      {dot(14.5, 31, 2, WARN)}
      {dot(24, 36, 2.2, WARN)}
    </>,
  ),
  muffin: ink(
    <>
      <path d="M11 26 L14.5 43 L33.5 43 L37 26 Z" fill={ENGLISH_50} />
      <path d="M17.5 28 L19 42.5" strokeWidth={THIN} />
      <path d="M24 28 L24 42.5" strokeWidth={THIN} />
      <path d="M30.5 28 L29 42.5" strokeWidth={THIN} />
      <path d="M8.5 25 C7 16 14 8 24 8 C34 8 41 16 39.5 25 C39.2 27 37.5 28 35.5 28 L12.5 28 C10.5 28 8.8 27 8.5 25 Z" fill={WARN} />
      {dot(17, 18, 1.8, MATH)}
      {dot(25, 13.5, 1.8, MATH)}
      {dot(32, 18.5, 1.8, MATH)}
      {dot(22, 22.5, 1.8, MATH)}
      {dot(29, 24, 1.8, MATH)}
    </>,
  ),
  cake: ink(
    <>
      <path d="M8 27 L8 40 C8 41.7 9.3 43 11 43 L37 43 C38.7 43 40 41.7 40 40 L40 27 Z" fill={WARN_50} />
      <path d="M8 34 L40 34 L40 37.5 L8 37.5 Z" fill={DANGER} strokeWidth={THIN} />
      <path d="M8 27 L8 23 C8 20.8 9.8 19 12 19 L36 19 C38.2 19 40 20.8 40 23 L40 27 A4 4 0 0 1 32 27 A4 4 0 0 1 24 27 A4 4 0 0 1 16 27 A4 4 0 0 1 8 27 Z" fill={ENGLISH_50} />
      <rect x="22" y="10.5" width="4" height="8.5" rx="1" fill={MATH} />
      <path d="M24 3.5 C26.5 6.5 27 9 24 10.5 C21 9 21.5 6.5 24 3.5 Z" fill={STAR} />
    </>,
  ),
  sweet: ink(
    <>
      <path d="M15 20.5 L6 14.5 L7.5 19.5 L5.5 24 L7.5 28.5 L6 33.5 L15 27.5 Z" fill={ENGLISH_50} />
      <path d="M33 20.5 L42 14.5 L40.5 19.5 L42.5 24 L40.5 28.5 L42 33.5 L33 27.5 Z" fill={ENGLISH_50} />
      <ellipse cx="24" cy="24" rx="11" ry="9" fill={ENGLISH} />
      <path d="M19.5 16.5 C17.5 21 18.5 27.5 22 31.8" stroke={WHITE} />
      <path d="M26.5 15.5 C24.5 20 25.5 26.5 29 31" stroke={WHITE} />
    </>,
  ),
  'ice-cream': ink(
    <>
      <path d="M14 25 L24 44 L34 25 Z" fill={STAR} />
      <path d="M19 26 L28.5 35.5" strokeWidth={THIN} />
      <path d="M29 26 L19.5 35.5" strokeWidth={THIN} />
      <path d="M12 25 C9.5 24.5 9 21.5 10.2 19 C11.5 11.5 17 6.5 24 6.5 C31 6.5 36.5 11.5 37.8 19 C39 21.5 38.5 24.5 36 25 C34.5 27.5 31 27.5 30 25.5 C28.5 28 25 28 24 26 C22.5 28 19.5 28 18 25.5 C17 27.5 13.5 27.5 12 25 Z" fill={ENGLISH_50} />
      <path d="M15.5 17 C16 14 18 11.8 20.5 11" stroke={WHITE} />
    </>,
  ),
  egg: ink(
    <>
      <path d="M24 5.5 C31.5 5.5 37.5 17 37.5 27 C37.5 36 31.5 42.5 24 42.5 C16.5 42.5 10.5 36 10.5 27 C10.5 17 16.5 5.5 24 5.5 Z" fill={WARN_50} />
      <path d="M16 25 C16.3 20.5 18 16.5 20.5 13.8" stroke={WHITE} strokeWidth={3} />
    </>,
  ),
  milk: ink(
    <>
      <path d="M15 10 L15 6.5 L33 6.5 L33 10" fill={WHITE} />
      <path d="M10 20 L15 10 L33 10 L28 20 Z" fill={WHITE} />
      <path d="M28 20 L33 10 L38 16 Z" fill={MATH_50} />
      <path d="M28 20 L38 16 L38 40 L28 44 Z" fill={MATH_50} />
      <path d="M10 20 L28 20 L28 44 L10 44 Z" fill={WHITE} />
      <path d="M10 27 L28 27 L28 38 L10 38 Z" fill={MATH} strokeWidth={THIN} />
      <path d="M19 29 C20.8 31.6 21.8 33.2 21.8 34.2 C21.8 35.7 20.5 36.8 19 36.8 C17.5 36.8 16.2 35.7 16.2 34.2 C16.2 33.2 17.2 31.6 19 29 Z" fill={WHITE} stroke="none" />
    </>,
  ),
  rice: ink(
    <>
      <path d="M17 37 L18 41 L30 41 L31 37" fill={MATH} />
      <path d="M8 21 C8 13 15 7.5 24 7.5 C33 7.5 40 13 40 21 Z" fill={WHITE} />
      <path d="M5 21 L43 21 C43 31 34.5 38 24 38 C13.5 38 5 31 5 21 Z" fill={MATH} />
      <path d="M8 26 C12 31 18 33.5 24 33.5 C30 33.5 36 31 40 26" stroke={WHITE} strokeWidth={THIN} />
      <path d="M15 16 L17 15" strokeWidth={THIN} />
      <path d="M23 12.5 L25 12.5" strokeWidth={THIN} />
      <path d="M30.5 15 L32.5 16" strokeWidth={THIN} />
      <path d="M20 18 L22 17.5" strokeWidth={THIN} />
      <path d="M27 18 L29 18.5" strokeWidth={THIN} />
    </>,
  ),
  cheese: ink(
    <>
      <path d="M5 24 L31 11 L43 19 Z" fill={WARN_50} />
      <path d="M5 24 L43 19 L43 35 L5 39 Z" fill={STAR} />
      <ellipse cx="14" cy="31.5" rx="3" ry="2.5" fill={WARN} strokeWidth={THIN} />
      <ellipse cx="27" cy="27.5" rx="2.5" ry="2" fill={WARN} strokeWidth={THIN} />
      <ellipse cx="36.5" cy="30.5" rx="2.5" ry="3" fill={WARN} strokeWidth={THIN} />
      <ellipse cx="29" cy="17" rx="2.5" ry="1.4" fill={WARN} strokeWidth={THIN} />
    </>,
  ),
  juice: ink(
    <>
      <path d="M27 13.5 L27.8 7.5 L33 6" strokeWidth={5.5} />
      <path d="M27 13.5 L27.8 7.5 L33 6" stroke={WHITE} strokeWidth={2.5} />
      <path d="M11 15 L17 12 L37 12 L31 15 Z" fill={WARN_50} />
      <path d="M31 15 L37 12 L37 40.5 L31 43.5 Z" fill={WARN} />
      <path d="M11 15 L31 15 L31 43.5 L11 43.5 Z" fill={STAR} />
      <circle cx="21" cy="30" r="6.5" fill={WARN} />
      <path d="M21.5 23.5 C23 20.5 26 20 28 21 C27 23.5 24.5 24.5 21.5 23.5 Z" fill={SCIENCE} strokeWidth={THIN} />
    </>,
  ),
} satisfies Partial<Record<IconName, ReactElement>>
