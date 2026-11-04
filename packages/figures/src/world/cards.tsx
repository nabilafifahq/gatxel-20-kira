import type { ReactElement } from 'react'
import { DANGER, DIVIDER, ENGLISH_50, INK, KNOWLEDGE, KNOWLEDGE_50, MATH, MENTAL, MENTAL_50, MUTED, SCIENCE, SKY, STAR, SUCCESS, WARN, WARN_50, WHITE, YELLOW } from '../palette'
import { Icon, PlanetArt } from '../icons'
import { PLANET_ART_NAMES, type PlanetArtName } from '../icons/planets'
import { ICON_NAMES, type IconName } from '../spec'
import { BossArt } from './bosses'
import { Lumi, Pip } from './story'

/**
 * Gambar kartu album: kotak 64 x 64. Hewan, planet, dan benda memakai ikon yang sudah ada; bendera,
 * tempat terkenal, dan kartu bos digambar di sini dengan gaya yang sama (garis tinta 2,5, palet Brand Kit).
 */

const line = { stroke: INK, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const hStripes = (cols: readonly string[], w: readonly number[] = cols.map(() => 1)): ReactElement => {
  const total = w.reduce((a, b) => a + b, 0)
  let y = 14
  return (
    <g>
      {cols.map((c, i) => {
        const h = (36 * w[i]!) / total
        const el = <rect key={i} x={6} y={y} width={52} height={h} fill={c} />
        y += h
        return el
      })}
    </g>
  )
}
const vStripes = (cols: readonly string[]): ReactElement => (
  <g>
    {cols.map((c, i) => (
      <rect key={i} x={6 + (i * 52) / cols.length} y={14} width={52 / cols.length} height={36} fill={c} />
    ))}
  </g>
)

/** Warna bendera dari palet: merah DANGER, putih WHITE, biru SKY, hijau SUCCESS, kuning YELLOW. */
function Flag({ id }: { id: string }): ReactElement {
  const frame = <rect x={6} y={14} width={52} height={36} rx="3" fill="none" {...line} />
  const face: Record<string, ReactElement> = {
    id: hStripes([DANGER, WHITE]),
    pl: hStripes([WHITE, DANGER]),
    nl: hStripes([DANGER, WHITE, SKY]),
    ua: hStripes([SKY, YELLOW]),
    th: hStripes([DANGER, WHITE, SKY, WHITE, DANGER], [1, 1, 2, 1, 1]),
    jp: (
      <g>
        <rect x={6} y={14} width={52} height={36} rx="3" fill={WHITE} />
        <circle cx={32} cy={32} r="10" fill={DANGER} />
      </g>
    ),
    fr: vStripes([SKY, WHITE, DANGER]),
    it: vStripes([SUCCESS, WHITE, DANGER]),
    ng: vStripes([SUCCESS, WHITE, SUCCESS]),
    vn: (
      <g>
        <rect x={6} y={14} width={52} height={36} fill={DANGER} />
        <path d="M32 21l2.900 8.100h8.600l-6.900 5.100 2.600 8.300 -7.200 -5 -7.200 5 2.600 -8.300 -6.900 -5.100h8.600z" fill={YELLOW} />
      </g>
    ),
    se: (
      <g>
        <rect x={6} y={14} width={52} height={36} fill={SKY} />
        <rect x={22} y={14} width={8} height={36} fill={YELLOW} />
        <rect x={6} y={28} width={52} height={8} fill={YELLOW} />
      </g>
    ),
    ch: (
      <g>
        <rect x={14} y={12} width={36} height={40} fill={DANGER} />
        <rect x={28} y={20} width={8} height={24} fill={WHITE} />
        <rect x={20} y={28} width={24} height={8} fill={WHITE} />
      </g>
    ),
  }
  if (id === 'ch')
    return (
      <g>
        {face.ch}
        <rect x={14} y={12} width={36} height={40} rx="3" fill="none" {...line} />
      </g>
    )
  return (
    <g>
      {face[id] ?? face.id}
      {frame}
    </g>
  )
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
    case 'wall':
      return (
        <g {...line}>
          <path d="M4 50l14 -18l14 8l14 -16l14 12v14z" fill={SUCCESS} />
          <path d="M4 44l14 -12l14 8l14 -12l14 8" fill="none" strokeWidth="6" />
          <path d="M4 44l14 -12l14 8l14 -12l14 8" fill="none" strokeWidth="3" stroke={WHITE} />
          <rect x="14" y="24" width="8" height="10" fill={WHITE} strokeWidth="2" />
          <rect x="42" y="20" width="8" height="10" fill={WHITE} strokeWidth="2" />
        </g>
      )
    case 'bigben':
      return (
        <g {...line}>
          <path d="M24 56V20h16v36z" fill={WARN_50} />
          <path d="M24 20l8 -14l8 14z" fill={MENTAL} />
          <circle cx="32" cy="29" r="6.500" fill={WHITE} strokeWidth="2" />
          <path d="M32 29v-4M32 29l3 2" strokeWidth="1.600" fill="none" />
          <path d="M28 42h8M28 48h8" strokeWidth="1.600" />
          <path d="M16 56h32" />
        </g>
      )
    case 'colosseum':
      return (
        <g {...line}>
          <path d="M6 50V24q26 -14 52 0v26z" fill={WARN_50} />
          <path d="M6 34q26 -10 52 0" fill="none" strokeWidth="1.800" />
          <path d="M14 50v-8a3 3 0 0 1 6 0v8M26 50v-8a3 3 0 0 1 6 0v8M38 50v-8a3 3 0 0 1 6 0v8M49 50v-8a2.500 2.500 0 0 1 5 0v8" fill={MATH} strokeWidth="1.800" />
          <path d="M16 24v5M26 22v5M38 22v5M48 24v5" strokeWidth="1.800" />
        </g>
      )
    case 'taj':
      return (
        <g {...line}>
          <rect x="16" y="32" width="32" height="20" fill={WHITE} />
          <path d="M22 32q0 -14 10 -20q10 6 10 20z" fill={WHITE} />
          <path d="M32 12v-6" />
          <path d="M28 52V42a4 4 0 0 1 8 0v10" fill={MATH} strokeWidth="1.800" />
          <path d="M8 52V24M56 52V24" strokeWidth="3.500" />
          <circle cx="8" cy="22" r="3" fill={WHITE} strokeWidth="1.800" />
          <circle cx="56" cy="22" r="3" fill={WHITE} strokeWidth="1.800" />
          <path d="M4 52h56" />
        </g>
      )
    case 'lighthouse':
      return (
        <g {...line}>
          <path d="M23 54l5 -36h8l5 36z" fill={WHITE} />
          <path d="M25 42h14l1 8h-16zM27 26h10l1 8h-12z" fill={DANGER} strokeWidth="1.800" />
          <rect x="26" y="10" width="12" height="8" rx="2" fill={STAR} />
          <path d="M25 10l7 -6l7 6z" fill={MENTAL} />
          <path d="M40 14l18 -6v12z" fill={STAR} fillOpacity="0.6" stroke="none" />
          <path d="M6 56q26 -6 52 0" fill="none" />
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

/** Satu gambar kartu menurut kode `art` dari katalog (@kira/core). */
export function CardArt({ art, size = 64, title, className }: { art: string; size?: number; title?: string; className?: string }): ReactElement {
  const [kind, id = ''] = art.split(':')
  if (kind === 'icon' && (ICON_NAMES as readonly string[]).includes(id)) return <Icon name={id as IconName} size={size} {...(title ? { title } : {})} {...(className ? { className } : {})} />
  if (kind === 'planet' && (PLANET_ART_NAMES as readonly string[]).includes(id)) return <PlanetArt name={id as PlanetArtName} size={size} {...(title ? { title } : {})} {...(className ? { className } : {})} />
  if (kind === 'boss') return <BossArt id={id} size={size} {...(title ? { title } : {})} {...(className ? { className } : {})} />
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      {kind === 'flag' ? <Flag id={id} /> : kind === 'land' ? <Land id={id} /> : id === 'pip' ? <Pip x={32} y={52} s={2} /> : <Lumi x={32} y={34} s={1.700} glow={1.300} />}
    </svg>
  )
}

