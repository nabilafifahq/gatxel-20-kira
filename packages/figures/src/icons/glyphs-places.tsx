import type { ReactElement } from 'react'
import type { IconName } from '../spec'
import { DANGER, DIVIDER, ENGLISH, MATH, MATH_50, SCIENCE, SCIENCE_50, STAR, WARN, WARN_50, WHITE } from '../palette'
import { THIN, dot, ground, ink, scallop, scene, tube } from './glyphs-kit'

const AWNING = Array.from({ length: 7 }, (_, i) => {
  const x0 = Math.round((4 + i * (40 / 7)) * 100) / 100
  const x1 = Math.round((4 + (i + 1) * (40 / 7)) * 100) / 100
  return { key: i, d: `M${x0} 11 L${x1} 11 L${x1} 18 A2.86 2.86 0 0 1 ${x0} 18 Z`, fill: i % 2 === 0 ? ENGLISH : WHITE }
})

/** Bangunan dan habitat. Habitat digambar di dalam bingkai pemandangan. */
export const PLACE_GLYPHS = {
  house: ink(
    <>
      <rect x="30.5" y="8" width="5" height="10" fill={ENGLISH} />
      <rect x="9" y="21" width="30" height="21.5" fill={STAR} />
      <path d="M5 23 L24 6.5 L43 23 Z" fill={ENGLISH} />
      <path d="M20 42.5 L20 31 C20 29.3 21.3 28 23 28 L25 28 C26.7 28 28 29.3 28 31 L28 42.5 Z" fill={WARN} />
      <rect x="12" y="27" width="5.5" height="5.5" fill={MATH_50} strokeWidth={THIN} />
      <rect x="30.5" y="27" width="5.5" height="5.5" fill={MATH_50} strokeWidth={THIN} />
      {dot(26, 36, 1)}
      <path d="M4.5 42.5 L43.5 42.5" />
    </>,
  ),
  school: ink(
    <>
      <path d="M24 4 L24 12" strokeWidth={THIN} />
      <path d="M24 4.2 L31 4.2 L31 7 L24 7 Z" fill={DANGER} strokeWidth={1.5} />
      <path d="M24 7 L31 7 L31 9.8 L24 9.8 Z" fill={WHITE} strokeWidth={1.5} />
      <rect x="5" y="22" width="38" height="20.5" fill={WARN_50} />
      <path d="M3.5 22.5 L44.5 22.5 L44.5 19.5 L3.5 19.5 Z" fill={MATH} />
      <rect x="16.5" y="17" width="15" height="25.5" fill={WARN_50} />
      <path d="M14.5 18 L24 11 L33.5 18 Z" fill={MATH} />
      <circle cx="24" cy="23" r="3.2" fill={WHITE} strokeWidth={THIN} />
      <path d="M24 21 L24 23 L25.5 23.8" strokeWidth={1.5} />
      <path d="M20 42.5 L20 33 L28 33 L28 42.5" fill={WARN} />
      <path d="M24 33 L24 42.5" strokeWidth={THIN} />
      <rect x="7.5" y="26" width="6" height="5.5" fill={MATH_50} strokeWidth={THIN} />
      <rect x="7.5" y="34" width="6" height="5.5" fill={MATH_50} strokeWidth={THIN} />
      <rect x="34.5" y="26" width="6" height="5.5" fill={MATH_50} strokeWidth={THIN} />
      <rect x="34.5" y="34" width="6" height="5.5" fill={MATH_50} strokeWidth={THIN} />
      <path d="M3.5 42.5 L44.5 42.5" />
    </>,
  ),
  shop: ink(
    <>
      <rect x="6" y="15" width="36" height="27.5" fill={WHITE} />
      <rect x="9" y="4.5" width="30" height="6.5" rx="1.5" fill={MATH} />
      {AWNING.map((a) => (
        <path key={a.key} d={a.d} fill={a.fill} />
      ))}
      <rect x="9" y="25" width="16" height="11" rx="1" fill={MATH_50} />
      <circle cx="13.5" cy="32" r="2.5" fill={ENGLISH} strokeWidth={THIN} />
      <circle cx="19.5" cy="32" r="2.5" fill={STAR} strokeWidth={THIN} />
      <rect x="29" y="24" width="9.5" height="18.5" fill={MATH} />
      {dot(31.5, 34, 1, WHITE)}
      <path d="M4.5 42.5 L43.5 42.5" />
    </>,
  ),
  park: ink(
    scene(
      MATH_50,
      <>
        <circle cx="36.5" cy="11.5" r="3.5" fill={STAR} strokeWidth={THIN} />
        <path d={ground(30)} fill={SCIENCE_50} stroke="none" />
        <path d="M4 30 L44 30" strokeWidth={THIN} />
        <rect x="11.5" y="21" width="4" height="13" fill={WARN} strokeWidth={THIN} />
        <path d={scallop(13.5, 16.5, 7.5, 7, 0.6)} fill={SCIENCE} strokeWidth={THIN} />
        <path d="M26 26 L26 29 M37 26 L37 29 M26 31 L26 35 M37 31 L37 35" strokeWidth={THIN} />
        <rect x="24" y="23.5" width="15" height="2.5" rx="1" fill={WARN} strokeWidth={THIN} />
        <rect x="24" y="28.5" width="15" height="2.5" rx="1" fill={WARN} strokeWidth={THIN} />
        {dot(9, 38.5, 1.5, ENGLISH)}
        {dot(20, 39.5, 1.5, STAR)}
        {dot(31, 39, 1.5, ENGLISH)}
      </>,
    ),
  ),
  pond: ink(
    scene(
      MATH_50,
      <>
        <path d={ground(22)} fill={SCIENCE_50} stroke="none" />
        <path d="M4 22 L44 22" strokeWidth={THIN} />
        <ellipse cx="25" cy="33" rx="16" ry="7.5" fill={MATH} strokeWidth={THIN} />
        <path d="M30.5 34.5 L34.2 31.6 A4.5 4.5 0 1 1 30.8 30 Z" fill={SCIENCE} strokeWidth={THIN} />
        <path d="M15 32 C17 31 19 31 21 32 M20 37 C22 36 24 36 26 37" stroke={WHITE} strokeWidth={1.5} />
        <path d="M9.5 31 L9.5 17 M13 30 L13 14" strokeWidth={THIN} />
        <rect x="8" y="13.5" width="3" height="6.5" rx="1.5" fill={WARN} strokeWidth={1.5} />
        <rect x="11.5" y="10.5" width="3" height="6.5" rx="1.5" fill={WARN} strokeWidth={1.5} />
      </>,
    ),
  ),
  sea: ink(
    scene(
      MATH_50,
      <>
        <circle cx="33" cy="15" r="5" fill={STAR} strokeWidth={THIN} />
        <path d="M10 13 C11.5 11.5 13 11.5 14 13 C15 11.5 16.5 11.5 18 13" strokeWidth={THIN} />
        <path d="M4 25 C8 22.5 12 22.5 16 25 C20 27.5 24 27.5 28 25 C32 22.5 36 22.5 40 25 C41.5 26 42.8 26.4 44 26.4 L44 37 A7 7 0 0 1 37 44 L11 44 A7 7 0 0 1 4 37 Z" fill={MATH} strokeWidth={THIN} />
        <path d="M9 32 C11 30.5 13 30.5 15 32 C17 33.5 19 33.5 21 32 M27 37 C29 35.5 31 35.5 33 37 C35 38.5 37 38.5 39 37" stroke={WHITE} strokeWidth={THIN} />
      </>,
    ),
  ),
  desert: ink(
    scene(
      WARN_50,
      <>
        <circle cx="34" cy="13" r="5" fill={STAR} strokeWidth={THIN} />
        <path d="M4 29 C14 22 24 23 32 28 C36 26 40 25.5 44 26.5 L44 37 A7 7 0 0 1 37 44 L11 44 A7 7 0 0 1 4 37 Z" fill={STAR} strokeWidth={THIN} />
        <path d="M4 37 C14 31 28 31 44 36 L44 37 A7 7 0 0 1 37 44 L11 44 A7 7 0 0 1 4 37 Z" fill={WARN} strokeWidth={THIN} />
        {tube('M16 25 L12.5 25 C11.4 25 10.5 24.1 10.5 23 L10.5 19.5 M21 22 L24.5 22 C25.6 22 26.5 21.1 26.5 20 L26.5 17', SCIENCE, 2)}
        <path d="M15.5 33 L15.5 16 C15.5 14.3 16.8 13 18.5 13 C20.2 13 21.5 14.3 21.5 16 L21.5 32 Z" fill={SCIENCE} strokeWidth={THIN} />
      </>,
    ),
  ),
  forest: ink(
    scene(
      MATH_50,
      <>
        <path d={ground(36)} fill={SCIENCE_50} stroke="none" />
        <path d="M4 36 L44 36" strokeWidth={THIN} />
        <rect x="11.5" y="29" width="3" height="8" fill={WARN} strokeWidth={THIN} />
        <path d="M13 9 L19.5 21 L17 21 L21 30 L5 30 L9 21 L6.5 21 Z" fill={SCIENCE} strokeWidth={THIN} />
        <rect x="33.5" y="29" width="3" height="8" fill={WARN} strokeWidth={THIN} />
        <path d="M35 11 L41 22 L38.8 22 L42.5 30 L27.5 30 L31.2 22 L29 22 Z" fill={SCIENCE} strokeWidth={THIN} />
        <rect x="22.5" y="32" width="3" height="8" fill={WARN} strokeWidth={THIN} />
        <path d="M24 8 L31.5 21.5 L28.5 21.5 L33 33 L15 33 L19.5 21.5 L16.5 21.5 Z" fill={SCIENCE} strokeWidth={THIN} />
      </>,
    ),
  ),
  arctic: ink(
    scene(
      MATH_50,
      <>
        <path d={ground(31)} fill={MATH} stroke="none" />
        <path d="M4 31 L44 31" strokeWidth={THIN} />
        <path d="M10 31 L14.5 18 L19 21.5 L24 11 L31 21 L34.5 18.5 L39 31 Z" fill={WHITE} strokeWidth={THIN} />
        <path d="M24 11 L25.5 21 L31 21" stroke={DIVIDER} strokeWidth={THIN} />
        <path d="M12 33.5 L36 33.5 L32 38 L16 38 Z" fill={MATH_50} stroke="none" />
        {dot(10, 11, 1.2, WHITE)}
        {dot(36, 9, 1.2, WHITE)}
        {dot(39, 15, 1.2, WHITE)}
        {dot(15, 7.5, 1.2, WHITE)}
      </>,
    ),
  ),
  farm: ink(
    scene(
      MATH_50,
      <>
        <path d={ground(32)} fill={SCIENCE_50} stroke="none" />
        <path d="M4 32 L44 32" strokeWidth={THIN} />
        <path d="M30 32 L30 17.5 C30 15.3 31.8 13.5 34 13.5 C36.2 13.5 38 15.3 38 17.5 L38 32 Z" fill={DIVIDER} strokeWidth={THIN} />
        <path d="M9 32 L9 20.5 L18.5 13 L28 20.5 L28 32 Z" fill={ENGLISH} strokeWidth={THIN} />
        <rect x="14.5" y="24" width="8" height="8" fill={WHITE} strokeWidth={THIN} />
        <path d="M14.5 24 L22.5 32 M22.5 24 L14.5 32" stroke={ENGLISH} strokeWidth={1.5} />
        <path d="M4.5 36 L43.5 36 M4.5 39.5 L43.5 39.5" stroke={WARN} strokeWidth={THIN} />
        <path d="M9 34 L9 42 M17 34 L17 42 M25 34 L25 42 M33 34 L33 42 M40 34 L40 42" stroke={WARN} strokeWidth={THIN} />
      </>,
    ),
  ),
} satisfies Partial<Record<IconName, ReactElement>>
