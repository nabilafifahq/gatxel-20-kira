import type { ReactElement, ReactNode } from 'react'
import { cx } from './cx'

/**
 * Ikon UI 24 x 24, garis 2 sampai 3 px, warna mengikuti currentColor.
 * Path diambil dari papan desain Kira. Ikon objek, avatar, dan figur soal
 * ada di @kira/figures, bukan di sini.
 */

type IconDef = { sw: number; d: ReactNode }

const F = { fill: 'currentColor', stroke: 'none' } as const

const ICONS = {
  'arrow-right': { sw: 2.5, d: <path d="M5 12h14M13 6l6 6-6 6" /> },
  'arrow-left': { sw: 2.5, d: <path d="M19 12H5M11 6l-6 6 6 6" /> },
  'arrow-up': { sw: 2.5, d: <path d="M12 19V5M6 11l6-6 6 6" /> },
  'arrow-down': { sw: 2.5, d: <path d="M12 5v14M6 13l6 6 6-6" /> },
  check: { sw: 3, d: <path d="M5 12.5l4.5 4.5L19 7.5" /> },
  'check-circle': {
    sw: 2.5,
    d: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.8 2.8L16.5 9.5" />
      </>
    ),
  },
  'not-yet': {
    sw: 2.5,
    d: (
      <>
        <polyline points="2.25 5.25 2.25 9.75 6.75 9.75" />
        <path d="M6.34 18A8.25 8.25 0 1 0 6.17 6.17L2.25 9.75" />
      </>
    ),
  },
  replay: {
    sw: 2.5,
    d: (
      <>
        <polyline points="2.25 5.25 2.25 9.75 6.75 9.75" />
        <path d="M6.34 18A8.25 8.25 0 1 0 6.17 6.17L2.25 9.75" />
      </>
    ),
  },
  refresh: {
    sw: 2.5,
    d: (
      <>
        <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" />
        <path d="M18 3v4h-4M6 21v-4h4" />
      </>
    ),
  },
  hint: {
    sw: 2,
    d: (
      <>
        <path d="M9 21h6" />
        <path d="M12 2.5a6.5 6.5 0 0 0-3.9 11.7c.6.5.9 1.1.9 1.8v1h6v-1c0-.7.3-1.4.9-1.8A6.5 6.5 0 0 0 12 2.5z" />
      </>
    ),
  },
  speaker: {
    sw: 2,
    d: (
      <>
        <path d="M3.5 9.5v5h4l5 4v-13l-5 4h-4z" />
        <path d="M16 9a4.2 4.2 0 0 1 0 6" />
        <path d="M18.8 6.5a8 8 0 0 1 0 11" />
      </>
    ),
  },
  'speaker-off': {
    sw: 2,
    d: (
      <>
        <path d="M3.5 9.5v5h4l5 4v-13l-5 4h-4z" />
        <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
      </>
    ),
  },
  waveform: { sw: 2.5, d: <path d="M5 10v4M9.5 6v12M14 8.5v7M18.5 10.5v3" /> },
  close: { sw: 2.5, d: <path d="M6 6l12 12M18 6L6 18" /> },
  lock: {
    sw: 2,
    d: (
      <>
        <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      </>
    ),
  },
  gift: {
    sw: 2,
    d: (
      <>
        <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
        <path d="M5 12.5v8h14v-8M12 8.5v12" />
        <path d="M12 8.5C10.5 5 7 4.5 7 6.8S10 8.5 12 8.5zM12 8.5c1.5-3.5 5-4 5-1.7S14 8.5 12 8.5z" />
      </>
    ),
  },
  trophy: {
    sw: 2,
    d: (
      <>
        <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0V4z" />
        <path d="M7.5 6h-3v1.5a3 3 0 0 0 3 3M16.5 6h3v1.5a3 3 0 0 1-3 3" />
        <path d="M12 13.5V17M8.5 20.5h7M9.5 17h5v3.5h-5z" />
      </>
    ),
  },
  bolt: { sw: 2, d: <path d="M13 2.5L5.5 13.5H11l-1 8L18.5 10H13l0-7.5z" /> },
  globe: {
    sw: 2,
    d: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18" />
      </>
    ),
  },
  flag: {
    sw: 2,
    d: (
      <>
        <path d="M6 21V4" />
        <path d="M6 4.5c3.5-2 6.5 2 12 0v8.5c-5.5 2-8.5-2-12 0z" />
      </>
    ),
  },
  'flag-filled': {
    sw: 2,
    d: (
      <>
        <path d="M6 21V4" />
        <path d="M6 4.5c3.5-2 6.5 2 12 0v8.5c-5.5 2-8.5-2-12 0z" fill="currentColor" />
      </>
    ),
  },
  report: {
    sw: 2,
    d: (
      <>
        <path d="M4 4.5h16v11H11l-4.5 4v-4H4z" />
        <path d="M12 7.5v4M12 13.6v.2" />
      </>
    ),
  },
  moon: { sw: 2, d: <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" /> },
  snowflake: { sw: 2, d: <path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5M9.5 4.5L12 6.5l2.5-2M9.5 19.5l2.5-2 2.5 2" /> },
  clock: {
    sw: 2,
    d: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
  },
  stopwatch: {
    sw: 2,
    d: (
      <>
        <circle cx="12" cy="13.5" r="7.5" />
        <path d="M12 9.5v4l2.5 1.5M10 2.5h4M12 2.5v3.5" />
      </>
    ),
  },
  map: {
    sw: 2,
    d: (
      <>
        <path d="M3.5 6.5l5.5-2.5 6 2.5 5.5-2.5v13.5l-5.5 2.5-6-2.5-5.5 2.5V6.5z" />
        <path d="M9 4v13.5M15 6.5V20" />
      </>
    ),
  },
  person: {
    sw: 2,
    d: (
      <>
        <circle cx="12" cy="8.5" r="4" />
        <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
      </>
    ),
  },
  sun: {
    sw: 2,
    d: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
      </>
    ),
  },
  cards: {
    sw: 2,
    d: (
      <>
        <rect x="7" y="3.5" width="13" height="15" rx="2" />
        <path d="M4 7v11.5a2 2 0 0 0 2 2h10" />
      </>
    ),
  },
  play: { sw: 2, d: <path d="M8 5.5v13l11-6.5z" {...F} /> },
  pause: {
    sw: 2,
    d: (
      <>
        <rect x="6.5" y="5.5" width="4" height="13" rx="1" {...F} />
        <rect x="13.5" y="5.5" width="4" height="13" rx="1" {...F} />
      </>
    ),
  },
  'skip-back': {
    sw: 2.5,
    d: (
      <>
        <path d="M6 6v12" />
        <path d="M18 6l-9 6 9 6z" fill="currentColor" />
      </>
    ),
  },
  'skip-next': {
    sw: 2.5,
    d: (
      <>
        <path d="M18 6v12" />
        <path d="M6 6l9 6-9 6z" fill="currentColor" />
      </>
    ),
  },
  mic: {
    sw: 2,
    d: (
      <>
        <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3.5M8.5 21h7" />
      </>
    ),
  },
  'mic-off': {
    sw: 2,
    d: (
      <>
        <path d="M3 3l18 18" />
        <path d="M15 9.5V5.5a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5" />
        <path d="M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.5 11c0 .8-.1 1.5-.4 2.2M12 17.5v3.5M8.5 21h7" />
      </>
    ),
  },
  stop: { sw: 2, d: <rect x="6" y="6" width="12" height="12" rx="2.5" {...F} /> },
  send: { sw: 2.5, d: <path d="M4 12l16-8-6 16-3-7z" /> },
  camera: {
    sw: 2,
    d: (
      <>
        <path d="M4 8.5h3l1.5-2.5h7L17 8.5h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z" />
        <circle cx="12" cy="13.5" r="3.5" />
      </>
    ),
  },
  pencil: {
    sw: 2,
    d: (
      <>
        <path d="M4 20l1.2-4.6L16.5 4.1a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" />
        <path d="M14.5 6l3.5 3.5" />
      </>
    ),
  },
  eraser: {
    sw: 2,
    d: (
      <>
        <path d="M8.5 19.5L3.8 14.8a2 2 0 0 1 0-2.8l8-8a2 2 0 0 1 2.8 0l5.4 5.4a2 2 0 0 1 0 2.8l-7.7 7.3z" />
        <path d="M8 9l7 7M8.5 19.5H20" />
      </>
    ),
  },
  undo: {
    sw: 2.5,
    d: (
      <>
        <path d="M9 14L4 9l5-5" />
        <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
      </>
    ),
  },
  redo: {
    sw: 2.5,
    d: (
      <>
        <path d="M15 14l5-5-5-5" />
        <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
      </>
    ),
  },
  offline: {
    sw: 2,
    d: (
      <>
        <path d="M3 3l18 18" />
        <path d="M8.2 6.4A6.5 6.5 0 0 1 18.3 11a4 4 0 0 1 2 6.7" />
        <path d="M16.5 19H7a4.5 4.5 0 0 1-1.3-8.8" />
      </>
    ),
  },
  'cloud-sync': {
    sw: 2,
    d: (
      <>
        <path d="M8 19H7a4.5 4.5 0 0 1-.9-8.9A6.5 6.5 0 0 1 18.3 11a4 4 0 0 1-1.3 8H16" />
        <path d="M12 20v-7M9.5 15.5L12 13l2.5 2.5" />
      </>
    ),
  },
  'cloud-check': {
    sw: 2,
    d: (
      <>
        <path d="M17 19H7a4.5 4.5 0 0 1-.9-8.9A6.5 6.5 0 0 1 18.3 11a4 4 0 0 1-1.3 8z" />
        <path d="M9.5 14.5l2 2 3.5-3.5" />
      </>
    ),
  },
  info: {
    sw: 2.5,
    d: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.5M12 7.6v.2" />
      </>
    ),
  },
  'alert-circle': {
    sw: 2.5,
    d: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5v.5" />
      </>
    ),
  },
  warning: {
    sw: 2,
    d: (
      <>
        <path d="M12 3.5L2.5 20h19L12 3.5z" />
        <path d="M12 10v4.5M12 17.2v.3" />
      </>
    ),
  },
  question: {
    sw: 2,
    d: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.6M12 17v.5" />
      </>
    ),
  },
  'chevron-down': { sw: 2.5, d: <path d="M6 9l6 6 6-6" /> },
  'chevron-up': { sw: 2.5, d: <path d="M6 15l6-6 6 6" /> },
  'chevron-left': { sw: 2.5, d: <path d="M15 6l-6 6 6 6" /> },
  'chevron-right': { sw: 2.5, d: <path d="M9 6l6 6-6 6" /> },
  plus: { sw: 2.5, d: <path d="M12 5v14M5 12h14" /> },
  minus: { sw: 2.5, d: <path d="M5 12h14" /> },
  book: {
    sw: 2,
    d: (
      <>
        <path d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v13.5H7.5A2.5 2.5 0 0 1 5 18V4.5z" />
        <path d="M5 18a2.5 2.5 0 0 1 2.5-2.5H19" />
        <path d="M9 8.5h6M9 11.5h4" />
      </>
    ),
  },
  star: {
    sw: 1.5,
    d: <path d="M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.15L12 16.9l-5.5 2.9 1.05-6.15L3.1 9.3l6.15-.9L12 2.8z" />,
  },
  'zoom-in': {
    sw: 2.25,
    d: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M15.5 15.5l5 5M10.5 7.5v6M7.5 10.5h6" />
      </>
    ),
  },
  backspace: {
    sw: 2,
    d: (
      <>
        <path d="M7.5 5H20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7.5L3 12l4.5-7z" />
        <path d="M11 9.5l5 5M16 9.5l-5 5" />
      </>
    ),
  },
  list: { sw: 2, d: <path d="M9 6h11M9 12h11M9 18h11M4 6h.5M4 12h.5M4 18h.5" /> },
  search: {
    sw: 2,
    d: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4.5 4.5" />
      </>
    ),
  },
  spinner: { sw: 2.5, d: <path d="M12 3a9 9 0 1 1-9 9" /> },
} satisfies Record<string, IconDef>

export type UiIconName = keyof typeof ICONS

export const UI_ICON_NAMES = Object.keys(ICONS) as UiIconName[]

export function UiIcon({
  name,
  size = 24,
  className,
  strokeWidth,
  title,
}: {
  name: UiIconName
  size?: number
  className?: string
  strokeWidth?: number
  /** Isi hanya bila ikon berdiri sendiri tanpa teks di dekatnya. */
  title?: string
}): ReactElement {
  const def: IconDef = ICONS[name]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? def.sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      className={cx('flex-none', name === 'spinner' && 'animate-spin', className)}
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      {def.d}
    </svg>
  )
}
