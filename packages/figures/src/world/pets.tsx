import type { ReactElement, ReactNode } from 'react'
import { DIVIDER, ENGLISH, ENGLISH_50, INK, KNOWLEDGE, KNOWLEDGE_50, MATH, MATH_50, MENTAL, MENTAL_50, MUTED, SCIENCE, SCIENCE_50, STAR, WARN, WARN_50, WHITE } from '../palette'

/**
 * Enam teman Kira dan telurnya. Satu gaya: bentuk bulat, garis tinta 2,5, warna dari palet Brand Kit.
 * Kotak 96 x 96. Kelas `kw-*` dipakai CSS layar untuk gerak lembut (hanya transform dan opacity).
 */

export const PET_KIND_NAMES = ['flamekit', 'moonbun', 'leafling', 'sunbird', 'cloudpuff', 'wavedrake'] as const
export type PetArtKind = (typeof PET_KIND_NAMES)[number]

const SW = 2.5
const line = { stroke: INK, strokeWidth: SW, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

type Look = { body: string; belly: string; accent: string }
const LOOK: Record<PetArtKind, Look> = {
  flamekit: { body: WARN, belly: WARN_50, accent: STAR },
  moonbun: { body: MENTAL, belly: MENTAL_50, accent: ENGLISH_50 },
  leafling: { body: SCIENCE, belly: SCIENCE_50, accent: STAR },
  sunbird: { body: STAR, belly: WARN_50, accent: WARN },
  cloudpuff: { body: MATH, belly: MATH_50, accent: WHITE },
  wavedrake: { body: KNOWLEDGE, belly: KNOWLEDGE_50, accent: MATH_50 },
}

const hl = { ...line, strokeWidth: 1.6 } as const

function Eyes({ cx, cy, gap, r, happy }: { cx: number; cy: number; gap: number; r: number; happy?: boolean }): ReactElement {
  if (happy) {
    return (
      <g fill="none" {...line} className="kw-eyes">
        <path d={`M${cx - gap - r} ${cy + 1}q${r} ${-r * 1.6} ${r * 2} 0`} />
        <path d={`M${cx + gap - r} ${cy + 1}q${r} ${-r * 1.6} ${r * 2} 0`} />
      </g>
    )
  }
  return (
    <g className="kw-eyes">
      <circle cx={cx - gap} cy={cy} r={r} fill={WHITE} {...line} strokeWidth={2} />
      <circle cx={cx + gap} cy={cy} r={r} fill={WHITE} {...line} strokeWidth={2} />
      <circle cx={cx - gap + r * 0.2} cy={cy + r * 0.1} r={r * 0.55} fill={INK} />
      <circle cx={cx + gap + r * 0.2} cy={cy + r * 0.1} r={r * 0.55} fill={INK} />
      <circle cx={cx - gap + r * 0.45} cy={cy - r * 0.25} r={r * 0.2} fill={WHITE} />
      <circle cx={cx + gap + r * 0.45} cy={cy - r * 0.25} r={r * 0.2} fill={WHITE} />
    </g>
  )
}

function Smile({ cx, cy, w }: { cx: number; cy: number; w: number }): ReactElement {
  return <path d={`M${cx - w} ${cy}q${w} ${w * 1.1} ${w * 2} 0`} fill="none" {...line} strokeWidth={2} />
}

function Cheeks({ cx, cy, gap }: { cx: number; cy: number; gap: number }): ReactElement {
  return (
    <g fill={ENGLISH_50} opacity={0.9}>
      <ellipse cx={cx - gap} cy={cy} rx="4" ry="2.6" />
      <ellipse cx={cx + gap} cy={cy} rx="4" ry="2.6" />
    </g>
  )
}

function Sparkle({ x, y, s = 1, className }: { x: number; y: number; s?: number; className?: string }): ReactElement {
  return <path className={className} d={`M${x} ${y - 5 * s}l${1.5 * s} ${3.5 * s} ${3.5 * s} ${1.5 * s} ${-3.5 * s} ${1.5 * s} ${-1.5 * s} ${3.5 * s} ${-1.5 * s} ${-3.5 * s} ${-3.5 * s} ${-1.5 * s} ${3.5 * s} ${-1.5 * s}z`} fill={STAR} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
}

type Dim = { rx: number; ry: number; cy: number; top: number }
function dims(stage: 1 | 2 | 3): Dim {
  const rx = stage === 1 ? 24 : stage === 2 ? 28 : 31
  const ry = stage === 1 ? 22 : stage === 2 ? 26 : 29
  const bottom = 82
  return { rx, ry, cy: bottom - ry, top: bottom - ry * 2 }
}

function Ears({ kind, d }: { kind: PetArtKind; d: Dim }): ReactElement | null {
  const L = LOOK[kind]
  const { rx, top } = d
  const lx = 48 - rx * 0.62
  const rxp = 48 + rx * 0.62
  switch (kind) {
    case 'flamekit':
      return (
        <g {...line}>
          <path d={`M${lx - 7} ${top + 9}L${lx - 3} ${top - 12}L${lx + 10} ${top + 2}z`} fill={L.body} />
          <path d={`M${rxp + 7} ${top + 9}L${rxp + 3} ${top - 12}L${rxp - 10} ${top + 2}z`} fill={L.body} />
          <path d={`M${lx - 2} ${top + 2}L${lx - 1} ${top - 5}L${lx + 4} ${top}z`} fill={L.belly} strokeWidth={1.5} />
          <path d={`M${rxp + 2} ${top + 2}L${rxp + 1} ${top - 5}L${rxp - 4} ${top}z`} fill={L.belly} strokeWidth={1.5} />
        </g>
      )
    case 'moonbun':
      return (
        <g {...line}>
          <ellipse cx={lx} cy={top - 8} rx="6" ry="15" fill={L.body} transform={`rotate(-8 ${lx} ${top - 8})`} />
          <ellipse cx={rxp} cy={top - 8} rx="6" ry="15" fill={L.body} transform={`rotate(8 ${rxp} ${top - 8})`} />
          <ellipse cx={lx} cy={top - 7} rx="2.6" ry="9" fill={L.belly} stroke="none" transform={`rotate(-8 ${lx} ${top - 7})`} />
          <ellipse cx={rxp} cy={top - 7} rx="2.6" ry="9" fill={L.belly} stroke="none" transform={`rotate(8 ${rxp} ${top - 7})`} />
        </g>
      )
    case 'leafling':
      return (
        <g {...line}>
          <circle cx={lx - 1} cy={top + 6} r="6" fill={L.body} />
          <circle cx={rxp + 1} cy={top + 6} r="6" fill={L.body} />
          <path d={`M48 ${top + 1}q-2 -12 8 -16q4 10 -8 16z`} fill={SCIENCE_50} className="kw-sway" />
        </g>
      )
    case 'wavedrake':
      return (
        <g {...line}>
          <path d={`M${lx + 2} ${top + 5}l-3 -13l9 8z`} fill={L.accent} />
          <path d={`M${rxp - 2} ${top + 5}l3 -13l-9 8z`} fill={L.accent} />
        </g>
      )
    case 'sunbird':
      return (
        <g {...line} className="kw-sway">
          <path d={`M44 ${top + 2}q-3 -9 2 -13`} fill="none" />
          <path d={`M48 ${top + 1}q0 -11 5 -14`} fill="none" />
          <path d={`M52 ${top + 2}q3 -8 9 -9`} fill="none" />
        </g>
      )
    default:
      return null
  }
}

function Tail({ kind, d }: { kind: PetArtKind; d: Dim }): ReactElement | null {
  const L = LOOK[kind]
  const x = 48 + d.rx - 2
  const y = d.cy + d.ry * 0.45
  switch (kind) {
    case 'flamekit':
      return <path className="kw-tail" d={`M${x} ${y}q16 2 14 -14q-8 4 -10 8q4 -12 -6 -16`} fill={STAR} {...line} />
    case 'moonbun':
      return <circle className="kw-tail" cx={x + 3} cy={y} r="6" fill={WHITE} {...line} />
    case 'leafling':
      return <path className="kw-tail" d={`M${x} ${y}q14 4 16 -8q-6 -2 -10 2q6 -10 -2 -14`} fill={L.body} {...line} />
    case 'sunbird':
      return (
        <g className="kw-tail" {...line}>
          <path d={`M${x} ${y - 4}l15 -8l-3 11z`} fill={L.accent} />
          <path d={`M${x} ${y}l16 0l-6 8z`} fill={L.body} />
        </g>
      )
    case 'wavedrake':
      return <path className="kw-tail" d={`M${x} ${y}q16 4 18 -10l-8 2l2 -8q-8 6 -12 10z`} fill={L.accent} {...line} />
    default:
      return null
  }
}

function Body({ kind, d, happy }: { kind: PetArtKind; d: Dim; happy?: boolean }): ReactElement {
  const L = LOOK[kind]
  const { rx, ry, cy } = d
  const eyeY = cy - ry * 0.12
  const mouthY = cy + ry * 0.22
  return (
    <g className="kw-body">
      {kind === 'cloudpuff' ? (
        <g {...line} fill={L.body}>
          <circle cx={48 - rx * 0.55} cy={cy + ry * 0.2} r={ry * 0.62} />
          <circle cx={48 + rx * 0.55} cy={cy + ry * 0.2} r={ry * 0.62} />
          <circle cx={48 - rx * 0.28} cy={cy - ry * 0.3} r={ry * 0.66} />
          <circle cx={48 + rx * 0.3} cy={cy - ry * 0.25} r={ry * 0.62} />
          <ellipse cx="48" cy={cy + ry * 0.35} rx={rx * 0.9} ry={ry * 0.62} stroke="none" />
          <ellipse cx="48" cy={cy + ry * 0.18} rx={rx * 0.62} ry={ry * 0.5} fill={L.belly} stroke="none" />
        </g>
      ) : (
        <g>
          <ellipse cx="48" cy={cy} rx={rx} ry={ry} fill={L.body} {...line} />
          <ellipse cx="48" cy={cy + ry * 0.3} rx={rx * 0.62} ry={ry * 0.52} fill={L.belly} />
          {kind === 'wavedrake' ? (
            <g {...line} fill={L.accent}>
              <path d={`M${48 - rx} ${cy + 2}q-9 2 -8 10q8 0 10 -6z`} />
              <path d={`M${48 + rx} ${cy + 2}q9 2 8 10q-8 0 -10 -6z`} />
            </g>
          ) : null}
          {kind === 'sunbird' ? (
            <g {...line} fill={WARN_50}>
              <ellipse cx={48 - rx - 1} cy={cy + 4} rx="6" ry="11" transform={`rotate(14 ${48 - rx} ${cy + 4})`} className="kw-wing" />
              <ellipse cx={48 + rx + 1} cy={cy + 4} rx="6" ry="11" transform={`rotate(-14 ${48 + rx} ${cy + 4})`} className="kw-wing" />
            </g>
          ) : null}
        </g>
      )}
      <Eyes cx={48} cy={eyeY} gap={rx * 0.38} r={rx * 0.17} happy={happy} />
      {kind === 'sunbird' ? <path d={`M44.5 ${mouthY - 3}l3.500 -3l3.500 3l-3.500 4z`} fill={WARN} {...line} strokeWidth={2} /> : <Smile cx={48} cy={mouthY} w={4} />}
      <Cheeks cx={48} cy={mouthY - 1} gap={rx * 0.62} />
      {kind === 'leafling' ? (
        <g {...line} fill={STAR} strokeWidth={2}>
          <path d={`M${48 - 8} ${d.top + 6}l3 -6l3 6z`} />
          <path d={`M48 ${d.top + 4}l3 -7l3 7z`} />
        </g>
      ) : null}
      {kind === 'cloudpuff' ? <path d={`M48 ${d.top - 7}q5 7 0 11q-5 -4 0 -11z`} fill={MATH_50} {...line} strokeWidth={2} /> : null}
    </g>
  )
}

function Feet({ d }: { d: Dim }): ReactElement {
  return (
    <g fill={WHITE} {...line} strokeWidth={2}>
      <ellipse cx={48 - d.rx * 0.45} cy="82" rx="7" ry="3.6" />
      <ellipse cx={48 + d.rx * 0.45} cy="82" rx="7" ry="3.6" />
    </g>
  )
}

function Costume({ id, d }: { id: string | null; d: Dim }): ReactElement | null {
  if (!id) return null
  const { rx, top, cy } = d
  if (id === 'pet-bow') {
    const x = 48 + rx * 0.55
    const y = top + 5
    return (
      <g {...line} fill={ENGLISH}>
        <path d={`M${x} ${y}l-9 -6v12z`} />
        <path d={`M${x} ${y}l9 -6v12z`} />
        <circle cx={x} cy={y} r="3" fill={ENGLISH_50} />
      </g>
    )
  }
  if (id === 'pet-glasses') {
    const eyeY = cy - d.ry * 0.12
    const gap = rx * 0.38
    const r = rx * 0.25
    return (
      <g fill={WHITE} fillOpacity={0.25} {...line} strokeWidth={2.2}>
        <circle cx={48 - gap} cy={eyeY} r={r} />
        <circle cx={48 + gap} cy={eyeY} r={r} />
        <path d={`M${48 - gap + r} ${eyeY}h${gap * 2 - r * 2}`} fill="none" />
      </g>
    )
  }
  if (id === 'pet-crown') {
    return (
      <g {...line} fill={STAR}>
        <path d={`M36 ${top + 4}l2 -13l7 6l3 -9l3 9l7 -6l2 13z`} />
      </g>
    )
  }
  return null
}

function Scarf({ d }: { d: Dim }): ReactElement {
  const y = d.cy + d.ry * 0.62
  return (
    <g {...line} fill={ENGLISH} strokeWidth={2.2}>
      <path d={`M${48 - d.rx * 0.6} ${y}q${d.rx * 0.6} 8 ${d.rx * 1.2} 0l-1 6q-${d.rx * 0.6} 6 ${-d.rx * 1.2 + 2} 0z`} />
      <path d={`M${48 + d.rx * 0.2} ${y + 6}l4 10l6 -3l-3 -9z`} />
    </g>
  )
}

export function PetArt({ kind, stage = 1, costume = null, size = 96, title, className, happy, glow = true }: { kind: PetArtKind; stage?: 1 | 2 | 3; costume?: string | null; size?: number; title?: string; className?: string; happy?: boolean; glow?: boolean }): ReactElement {
  const d = dims(stage)
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      <ellipse cx="48" cy="85" rx={d.rx * 0.9} ry="3.500" fill={DIVIDER} />
      {stage === 3 && glow ? (
        <g>
          <Sparkle x={14} y={30} s={1} className="kw-twinkle" />
          <Sparkle x={82} y={24} s={1.2} className="kw-twinkle kw-late" />
          <Sparkle x={84} y={60} s={0.8} className="kw-twinkle" />
        </g>
      ) : null}
      <g className="kw-pet">
        <Tail kind={kind} d={d} />
        <Ears kind={kind} d={d} />
        <Feet d={d} />
        <Body kind={kind} d={d} happy={happy} />
        {stage >= 2 ? <Scarf d={d} /> : null}
        {stage === 3 ? <path d={`M48 ${d.top + 11}l2 4.500 4.800 0.600 -3.500 3.300 0.900 4.800 -4.200 -2.400 -4.200 2.400 0.900 -4.800 -3.500 -3.300 4.800 -0.600z`} fill={STAR} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" /> : null}
        <Costume id={costume} d={d} />
      </g>
    </svg>
  )
}

/** Telur. `cracked` menambah retakan dan kilau, dipakai saat siap menetas. */
export function EggArt({ cracked = false, size = 96, title, className }: { cracked?: boolean; size?: number; title?: string; className?: string }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      <ellipse cx="48" cy="85" rx="22" ry="3.500" fill={DIVIDER} />
      <g className="kw-egg">
        <path d="M48 10C32 10 22 36 22 56c0 16 11 26 26 26s26-10 26-26C74 36 64 10 48 10z" fill={WARN_50} {...line} />
        <path d="M24 50q8 -8 16 0t16 0t16 0" fill="none" stroke={ENGLISH} strokeWidth={4} strokeLinecap="round" />
        <circle cx="38" cy="66" r="4" fill={MATH_50} stroke={INK} strokeWidth={1.8} />
        <circle cx="58" cy="30" r="3" fill={MENTAL_50} stroke={INK} strokeWidth={1.8} />
        <circle cx="56" cy="68" r="2.500" fill={SCIENCE_50} stroke={INK} strokeWidth={1.8} />
        {cracked ? <path d="M36 28l6 7l-5 5l7 6l-4 5" fill="none" {...line} strokeWidth={2.2} /> : null}
      </g>
      {cracked ? (
        <g>
          <Sparkle x={18} y={26} className="kw-twinkle" />
          <Sparkle x={80} y={34} s={1.2} className="kw-twinkle kw-late" />
        </g>
      ) : null}
    </svg>
  )
}

/** Rumah teman: latar kotak 160 x 96 yang bisa diberi teman di tengahnya. */
export const PET_HOME_IDS = ['home-meadow', 'home-treehouse', 'home-cave', 'home-pond', 'home-castle'] as const
export type PetHomeArtId = (typeof PET_HOME_IDS)[number]

function homeLayers(id: PetHomeArtId): ReactNode {
  switch (id) {
    case 'home-treehouse':
      return (
        <>
          <rect x="0" y="0" width="160" height="96" fill={MATH_50} />
          <rect x="0" y="76" width="160" height="20" fill={SCIENCE} />
          <path d="M118 80V30" {...hl} strokeWidth={9} />
          <circle cx="118" cy="26" r="28" fill={SCIENCE} {...hl} />
          <rect x="102" y="38" width="32" height="22" rx="2" fill={WARN_50} {...hl} />
          <path d="M98 38l20-14l20 14z" fill={ENGLISH} {...hl} />
          <rect x="112" y="46" width="8" height="14" fill={WHITE} {...hl} strokeWidth={2} />
          <path d="M120 60l-8 20" {...hl} strokeWidth={2} />
        </>
      )
    case 'home-cave':
      return (
        <>
          <rect x="0" y="0" width="160" height="96" fill={KNOWLEDGE_50} />
          <path d="M0 96V30q40 -26 80 -20t80 20v66z" fill={MUTED} {...hl} />
          <path d="M20 96V60q60 -34 120 0v36z" fill={KNOWLEDGE} {...hl} />
          <path d="M30 40l8 -14l8 14zM110 36l7 -12l7 12z" fill={MATH_50} {...hl} strokeWidth={2} />
          <path d="M126 70l5 -9l5 9zM26 78l4 -7l4 7z" fill={MENTAL_50} {...hl} strokeWidth={2} />
        </>
      )
    case 'home-pond':
      return (
        <>
          <rect x="0" y="0" width="160" height="96" fill={SCIENCE_50} />
          <ellipse cx="80" cy="76" rx="68" ry="16" fill={MATH_50} {...hl} />
          <ellipse cx="50" cy="74" rx="12" ry="4" fill={SCIENCE} {...hl} strokeWidth={2} />
          <ellipse cx="116" cy="80" rx="10" ry="3.500" fill={SCIENCE} {...hl} strokeWidth={2} />
          <circle cx="116" cy="76" r="3.500" fill={ENGLISH_50} {...hl} strokeWidth={1.8} />
          <path d="M14 70v-26M20 72v-18M146 70v-30M140 72v-14" {...hl} />
        </>
      )
    case 'home-castle':
      return (
        <>
          <rect x="0" y="0" width="160" height="96" fill={MATH_50} />
          <ellipse cx="30" cy="22" rx="22" ry="8" fill={WHITE} {...hl} strokeWidth={2} />
          <ellipse cx="132" cy="30" rx="20" ry="7" fill={WHITE} {...hl} strokeWidth={2} />
          <ellipse cx="80" cy="88" rx="78" ry="14" fill={WHITE} {...hl} />
          <rect x="56" y="36" width="48" height="46" fill={KNOWLEDGE_50} {...hl} />
          <rect x="44" y="26" width="16" height="56" fill={WHITE} {...hl} />
          <rect x="100" y="26" width="16" height="56" fill={WHITE} {...hl} />
          <path d="M42 26l10 -14l10 14zM98 26l10 -14l10 14z" fill={MENTAL} {...hl} />
          <path d="M72 82v-14a8 8 0 0 1 16 0v14z" fill={KNOWLEDGE} {...hl} strokeWidth={2} />
        </>
      )
    default:
      return (
        <>
          <rect x="0" y="0" width="160" height="96" fill={MATH_50} />
          <circle cx="132" cy="22" r="11" fill={STAR} {...hl} />
          <ellipse cx="38" cy="26" rx="20" ry="7" fill={WHITE} {...hl} strokeWidth={2} />
          <path d="M0 74q40 -22 80 -6t80 -12v40H0z" fill={SCIENCE} {...hl} />
          <g {...hl} strokeWidth={2}>
            <path d="M24 84v-8M20 80h8" />
            <circle cx="24" cy="74" r="3" fill={ENGLISH_50} />
            <circle cx="128" cy="82" r="3" fill={STAR} />
            <path d="M128 85v6" />
          </g>
        </>
      )
  }
}

export function PetHomeArt({ id, width = 160, className, title }: { id: string; width?: number; className?: string; title?: string }): ReactElement {
  const known = (PET_HOME_IDS as readonly string[]).includes(id) ? (id as PetHomeArtId) : 'home-meadow'
  return (
    <svg width={width} height={(width * 96) / 160} viewBox="0 0 160 96" className={className} preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      <defs>
        <clipPath id={`kw-home-${known}`}>
          <rect width="160" height="96" rx="10" />
        </clipPath>
      </defs>
      <g clipPath={`url(#kw-home-${known})`}>{homeLayers(known)}</g>
    </svg>
  )
}

/** Pratinjau kostum teman: teman kecil berkostum. */
export function PetCostumeThumb({ id, size = 64 }: { id: string; size?: number }): ReactElement {
  return <PetArt kind="cloudpuff" stage={2} costume={id} size={size} glow={false} />
}

