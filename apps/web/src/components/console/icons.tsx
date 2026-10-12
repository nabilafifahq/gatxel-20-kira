import type { ReactElement, ReactNode } from 'react'

/**
 * Ikon garis 24 x 24 untuk konsol, halaman orang tua, dan halaman publik.
 * Path diambil dari papan desain (TutorHariIni, DataTable, Button, KotakHasil).
 * Ikon yang tidak ada di papan digambar dengan gaya yang sama: garis 2px, ujung bulat.
 * Warna mengikuti `currentColor`, jadi atur lewat kelas teks (`text-warn`).
 */

const P: Record<string, ReactNode> = {
  today: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  plan: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  calendarPlus: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M12 13v4M10 15h4" />
    </>
  ),
  inbox: (
    <>
      <path d="M3.5 13.5l2.5-8h12l2.5 8v5a1.5 1.5 0 0 1-1.5 1.5h-14a1.5 1.5 0 0 1-1.5-1.5v-5z" />
      <path d="M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5" />
    </>
  ),
  bank: (
    <>
      <path d="M12 3.5l8.5 4.5-8.5 4.5-8.5-4.5 8.5-4.5z" />
      <path d="M3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />
    </>
  ),
  trophy: (
    <>
      <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0V4z" />
      <path d="M7.5 6h-3v1.5a3 3 0 0 0 3 3M16.5 6h3v1.5a3 3 0 0 1-3 3" />
      <path d="M12 13.5V17M8.5 20.5h7M9.5 17h5v3.5h-5z" />
    </>
  ),
  report: (
    <>
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5v4h4M9 12h6M9 15.5h6" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1-5.1-1.9 5.1-1.9z" />
      <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  import: (
    <>
      <path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5" />
      <path d="M4 15.5v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  upload: (
    <>
      <path d="M12 14.5v-11M7.5 8L12 3.5 16.5 8" />
      <path d="M4 15.5v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  learners: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5" />
      <path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.8c2 .7 3.2 2.5 3.5 5.2" />
    </>
  ),
  plug: (
    <>
      <path d="M9 3.5v4M15 3.5v4" />
      <path d="M6.5 7.5h11v3.5a5.5 5.5 0 0 1-11 0z" />
      <path d="M12 16.5v4" />
    </>
  ),
  ljk: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <circle cx="15" cy="9" r="1.5" />
      <circle cx="9" cy="15" r="1.5" />
      <circle cx="15" cy="15" r="1.5" />
    </>
  ),
  paper: (
    <>
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5v4h4M9 11.5h2M9 15h6M13 11.5h2" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
  sync: (
    <>
      <path d="M20 12a8 8 0 0 0-14-5.3L4 9" />
      <path d="M4 4v5h5" />
      <path d="M4 12a8 8 0 0 0 14 5.3l2-2.3" />
      <path d="M20 20v-5h-5" />
    </>
  ),
  trendDown: (
    <>
      <path d="M4 7l6 6 4-4 6 6" />
      <path d="M20 10v5h-5" />
    </>
  ),
  trendUp: (
    <>
      <path d="M4 17l6-6 4 4 6-6" />
      <path d="M20 14V9h-5" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.8 2.8L16.5 9.5" />
    </>
  ),
  xCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
    </>
  ),
  infoCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.3v.2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5L2.5 20h19L12 3.5z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  move: <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />,
  moon: <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5l5 5" />
    </>
  ),
  filter: <path d="M3.5 5h17l-6.5 8v5.5l-4 2V13z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  history: (
    <>
      <polyline points="2.25 5.25 2.25 9.75 6.75 9.75" />
      <path d="M6.34 18A8.25 8.25 0 1 0 6.17 6.17L2.25 9.75" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3M15 12v2" />
    </>
  ),
  qr: (
    <>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <rect x="8" y="8" width="3" height="3" />
      <rect x="13" y="13" width="3" height="3" />
      <path d="M13 8h3v3M8 13v3h3" />
    </>
  ),
  cloudOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M8.2 6.4A6.5 6.5 0 0 1 18.3 11a4 4 0 0 1 2 6.7" />
      <path d="M16.5 19H7a4.5 4.5 0 0 1-1.3-8.8" />
    </>
  ),
  map: (
    <>
      <path d="M3.5 6.5l5.5-2.5 6 2.5 5.5-2.5v13.5l-5.5 2.5-6-2.5-5.5 2.5V6.5z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6.5h16M9.5 6.5V4h5v2.5" />
      <path d="M6.5 6.5l1 13.5h9l1-13.5M10.5 10.5v6M13.5 10.5v6" />
    </>
  ),
  edit: (
    <>
      <path d="M14.5 5.5l4 4L8.5 19.5H4.5v-4z" />
      <path d="M12.5 7.5l4 4" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5" />
      <path d="M4 17.5v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10 5.7c.6-.1 1.3-.2 2-.2 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.6 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.3-.6 4.6-1.4" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
    </>
  ),
  external: (
    <>
      <path d="M13.5 4h6.5v6.5M20 4l-9 9" />
      <path d="M17.5 13.5v5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5V8a1.5 1.5 0 0 1 1.5-1.5h5" />
    </>
  ),
  tablet: (
    <>
      <rect x="4.5" y="2.5" width="15" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </>
  ),
  fingerprint: (
    <>
      <path d="M6.5 6.5A7.5 7.5 0 0 1 19.5 12v1.5" />
      <path d="M4.5 10.5A7.5 7.5 0 0 0 4.5 13M9 20c1-1.8 1.5-4 1.5-6.5a1.5 1.5 0 0 1 3 0c0 3-.5 5.5-1.5 7.5" />
      <path d="M7.5 17.5c.5-1.3.8-2.6.8-4a3.7 3.7 0 0 1 7.4 0c0 1.2-.1 2.4-.3 3.5M17.8 19.2c.4-.9.7-1.9.9-3" />
    </>
  ),
  userPlus: (
    <>
      <circle cx="9.5" cy="8.5" r="3.5" />
      <path d="M3.5 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5" />
      <path d="M18.5 8v6M15.5 11h6" />
    </>
  ),
  printer: (
    <>
      <path d="M7 8.5V3.5h10v5" />
      <rect x="3.5" y="8.5" width="17" height="8" rx="2" />
      <path d="M7 14h10v6.5H7z" />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5z" />,
  pause: (
    <>
      <path d="M8.5 5.5v13M15.5 5.5v13" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z" />
      <path d="M8.5 12l2.5 2.5 4.5-4.5" />
    </>
  ),
  home: (
    <>
      <path d="M4 11l8-6.5 8 6.5" />
      <path d="M6 9.5v10h12v-10M10 19.5v-5h4v5" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h8" />
      <path d="M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5" />
    </>
  ),
  wand: (
    <>
      <path d="M4 20L15 9M13 7l4 4" />
      <path d="M17 3.5v3M15.5 5h3M20.5 9v2M19.5 10h2" />
    </>
  ),
}

const FILLED = new Set(['play'])

export type ConsoleIconName = keyof typeof P

export function ConsoleIcon({
  name,
  size = 20,
  strokeWidth = 2,
  className,
  label,
}: {
  name: ConsoleIconName
  size?: number
  strokeWidth?: number
  className?: string
  label?: string
}): ReactElement {
  const filled = FILLED.has(name)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `flex-none ${className}` : 'flex-none'}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true, focusable: 'false' })}
    >
      {P[name]}
    </svg>
  )
}

/** Bintang berisi (warna --star dengan garis --fg), untuk bintang skill. */
export function StarGlyph({ size = 18, filled = true, className }: { size?: number; filled?: boolean; className?: string }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className ? `flex-none ${className}` : 'flex-none'}>
      <path
        d="M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.15L12 16.9l-5.5 2.9 1.05-6.15L3.1 9.3l6.15-.9L12 2.8z"
        className={filled ? 'fill-star stroke-fg' : 'fill-surface stroke-border'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Putaran memuat untuk tombol (busur 3/4 lingkaran). Berhenti berputar saat gerak dikurangi. */
export function Spinner({ size = 18, className }: { size?: number; className?: string }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      className={`flex-none animate-spin motion-reduce:animate-none ${className ?? ''}`}
    >
      <path d="M12 3a9 9 0 1 1-9 9" />
    </svg>
  )
}
