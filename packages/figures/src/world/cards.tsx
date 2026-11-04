import type { ReactElement } from 'react'
import { DANGER, DIVIDER, ENGLISH_50, INK, KNOWLEDGE, KNOWLEDGE_50, MATH, MATH_50, MENTAL, MENTAL_50, MUTED, SCIENCE, STAR, WARN, WARN_50, WHITE } from '../palette'
import { Icon, PlanetArt } from '../icons'
import { PLANET_ART_NAMES, type PlanetArtName } from '../icons/planets'
import { ICON_NAMES, type IconName } from '../spec'

/**
 * Gambar kartu album: kotak 64 x 64. Hewan, planet, dan benda memakai ikon yang sudah ada; bendera,
 * tempat terkenal, dan kartu bos digambar di sini dengan gaya yang sama (garis tinta 2,5, palet Brand Kit).
 */

const line = { stroke: INK, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function Flag({ id }: { id: string }): ReactElement {
  const w = 52
  const h = 36
  const x = 6
  const y = 14
  const frame = <rect x={x} y={y} width={w} height={h} rx="3" fill="none" {...line} />
  switch (id) {
    case 'id':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h / 2} fill={DANGER} />
          <rect x={x} y={y + h / 2} width={w} height={h / 2} fill={WHITE} />
          {frame}
        </g>
      )
    case 'jp':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx="3" fill={WHITE} />
          <circle cx={x + w / 2} cy={y + h / 2} r="10" fill={DANGER} />
          {frame}
        </g>
      )
    case 'fr':
      return (
        <g>
          <rect x={x} y={y} width={w / 3} height={h} fill={MATH} />
          <rect x={x + w / 3} y={y} width={w / 3} height={h} fill={WHITE} />
          <rect x={x + (2 * w) / 3} y={y} width={w / 3} height={h} fill={DANGER} />
          {frame}
        </g>
      )
    default:
      return (
        <g>
          <rect x={x} y={y} width={w / 3} height={h} fill={SCIENCE} />
          <rect x={x + w / 3} y={y} width={w / 3} height={h} fill={WHITE} />
          <rect x={x + (2 * w) / 3} y={y} width={w / 3} height={h} fill={DANGER} />
          {frame}
        </g>
      )
  }
}

function Land({ id }: { id: string }): ReactElement {
  switch (id) {
    case 'fuji':
      return (
        <g {...line}>
          <circle cx="48" cy="18" r="6" fill={DANGER} stroke="none" />
          <path d="M6 54L26 20h12L58 54z" fill={KNOWLEDGE} />
          <path d="M26 20h12l3.500 7l-4 -2.500l-3 3l-3 -3l-4 2.500z" fill={WHITE} />
          <path d="M6 54h52" />
        </g>
      )
    case 'pyramid':
      return (
        <g {...line}>
          <circle cx="50" cy="16" r="6" fill={STAR} />
          <path d="M4 52L30 14l30 38z" fill={WARN_50} />
          <path d="M30 14v38" strokeWidth="1.800" />
          <path d="M17 33h26M11 43h38" strokeWidth="1.800" />
        </g>
      )
    case 'eiffel':
      return (
        <g {...line}>
          <path d="M32 6L22 52h20z" fill={MUTED} />
          <path d="M28 24h8M25 38h14" />
          <path d="M22 52c0-8 20-8 20 0" fill={WHITE} strokeWidth="2" />
          <path d="M18 52h28" />
          <path d="M32 6v-3" />
        </g>
      )
    default:
      return (
        <g {...line}>
          <rect x="6" y="42" width="52" height="10" rx="2" fill={WARN_50} />
          <rect x="12" y="32" width="40" height="10" rx="2" fill={WARN_50} />
          <rect x="18" y="22" width="28" height="10" rx="2" fill={WARN_50} />
          <path d="M26 22a6 6 0 0 1 12 0z" fill={ENGLISH_50} />
          <path d="M32 12v4" />
          <path d="M26 22a6 6 0 0 1 12 0" />
        </g>
      )
  }
}

/** Robot teka-teki. `hurt` mengganti mata, `energy` 0 sampai 1 mengisi inti dadanya. */
export function RobotArt({ size = 128, energy = 1, hurt = false, title, className }: { size?: number; energy?: number; hurt?: boolean; title?: string; className?: string }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      <ellipse cx="48" cy="90" rx="24" ry="3.500" fill={DIVIDER} />
      <g className="kw-robot" {...line}>
        <path d="M48 8v8" />
        <circle cx="48" cy="7" r="4" fill={STAR} className="kw-twinkle" />
        <rect x="26" y="16" width="44" height="30" rx="9" fill={MENTAL_50} />
        <circle cx="38" cy="30" r="6" fill={WHITE} strokeWidth="2" />
        <circle cx="58" cy="30" r="6" fill={WHITE} strokeWidth="2" />
        {hurt ? (
          <g strokeWidth="2.200" fill="none">
            <path d="M35 27l6 6M41 27l-6 6M55 27l6 6M61 27l-6 6" />
          </g>
        ) : (
          <g stroke="none" fill={INK}>
            <circle cx="39" cy="31" r="2.800" />
            <circle cx="59" cy="31" r="2.800" />
          </g>
        )}
        <path d="M42 39q6 4 12 0" fill="none" strokeWidth="2" />
        <rect x="24" y="22" width="5" height="12" rx="2.500" fill={MENTAL} />
        <rect x="67" y="22" width="5" height="12" rx="2.500" fill={MENTAL} />
        <rect x="30" y="48" width="36" height="30" rx="8" fill={KNOWLEDGE_50} />
        <rect x="38" y="55" width="20" height="14" rx="4" fill={WHITE} strokeWidth="2" />
        <rect x="40" y="57" width={Math.max(0, 16 * energy)} height="10" rx="2.500" fill={energy > 0.34 ? SCIENCE : WARN} stroke="none" />
        <path d="M30 56l-9 10M66 56l9 10" strokeWidth="5" stroke={INK} />
        <path d="M30 56l-9 10M66 56l9 10" strokeWidth="2" stroke={MENTAL} />
        <rect x="34" y="78" width="10" height="8" rx="3" fill={MENTAL} />
        <rect x="52" y="78" width="10" height="8" rx="3" fill={MENTAL} />
      </g>
    </svg>
  )
}

function Boss({ id }: { id: string }): ReactElement {
  switch (id) {
    case 'robot':
      return (
        <g transform="translate(-1 -3) scale(0.69)">
          <RobotInner />
        </g>
      )
    case 'comet':
      return (
        <g {...line}>
          <path d="M44 18C30 22 18 34 8 52c14-8 26-12 40-16z" fill={WARN_50} />
          <path d="M44 18C34 24 26 32 20 42" fill="none" strokeWidth="1.800" />
          <circle cx="46" cy="30" r="12" fill={STAR} />
          <circle cx="42" cy="26" r="2.500" fill={WARN_50} strokeWidth="1.500" />
        </g>
      )
    case 'aurora':
      return (
        <g {...line}>
          <rect x="4" y="8" width="56" height="48" rx="6" fill={KNOWLEDGE} />
          <path d="M8 50c8-26 14-30 20-12s14 4 20-24c4 10 6 22 8 36z" fill={SCIENCE} strokeWidth="2" />
          <path d="M16 50c6-18 10-22 14-10s10 2 14-16" fill="none" stroke={MATH_50} strokeWidth="3" />
          <path d="M14 18l1.500 3l3 1.500l-3 1.500l-1.500 3l-1.500-3l-3-1.500l3-1.500z" fill={STAR} strokeWidth="1.500" />
        </g>
      )
    default:
      return (
        <g {...line} fill="none">
          <path d="M6 50a26 26 0 0 1 52 0" stroke={DANGER} strokeWidth="5" />
          <path d="M12 50a20 20 0 0 1 40 0" stroke={STAR} strokeWidth="5" />
          <path d="M18 50a14 14 0 0 1 28 0" stroke={SCIENCE} strokeWidth="5" />
          <path d="M24 50a8 8 0 0 1 16 0" stroke={MATH} strokeWidth="5" />
          <ellipse cx="10" cy="52" rx="9" ry="5" fill={WHITE} strokeWidth="2" />
          <ellipse cx="54" cy="52" rx="9" ry="5" fill={WHITE} strokeWidth="2" />
        </g>
      )
  }
}

function RobotInner(): ReactElement {
  return <RobotArt size={96} />
}

/** Satu gambar kartu menurut kode `art` dari katalog (@kira/core). */
export function CardArt({ art, size = 64, title, className }: { art: string; size?: number; title?: string; className?: string }): ReactElement {
  const [kind, id = ''] = art.split(':')
  if (kind === 'icon' && (ICON_NAMES as readonly string[]).includes(id)) return <Icon name={id as IconName} size={size} {...(title ? { title } : {})} {...(className ? { className } : {})} />
  if (kind === 'planet' && (PLANET_ART_NAMES as readonly string[]).includes(id)) return <PlanetArt name={id as PlanetArtName} size={size} {...(title ? { title } : {})} {...(className ? { className } : {})} />
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      {kind === 'flag' ? <Flag id={id} /> : kind === 'land' ? <Land id={id} /> : <Boss id={id} />}
    </svg>
  )
}

