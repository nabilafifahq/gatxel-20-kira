import type { ReactElement, ReactNode } from 'react'
import { DANGER, DIVIDER, GRAPE, INK, LAVENDER, LILAC, SKY, SUCCESS, WHITE, YELLOW } from '../palette'
import { RobotArt } from './cards'

/**
 * Lawan Tantangan Bos. Semua digambar di sini dengan garis tinta dan palet Brand Kit. Gerak kecil memakai kelas kw-*
 * yang hanya berjalan di dalam .kw-animate dan otomatis berhenti saat prefers-reduced-motion.
 */

const line = { stroke: INK, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const BOSS_ART_IDS = ['robot', 'clickerclaw', 'mumblewump', 'mossback', 'pizzasaur', 'flapdoodle', 'rainbow', 'ticktoad', 'inkyblot', 'voltafin', 'hexapuff', 'bookworm', 'comet', 'aurora'] as const
export type BossArtId = (typeof BOSS_ART_IDS)[number]

/** Sepasang mata. Saat kena, mata menjadi silang kecil. */
function Eyes({ x1, x2, y, r = 6, hurt }: { x1: number; x2: number; y: number; r?: number; hurt: boolean }): ReactElement {
  return (
    <g>
      <circle cx={x1} cy={y} r={r} fill={WHITE} {...line} strokeWidth="2" />
      <circle cx={x2} cy={y} r={r} fill={WHITE} {...line} strokeWidth="2" />
      {hurt ? (
        <path d={`M${x1 - r / 2} ${y - r / 2}l${r} ${r}M${x1 + r / 2} ${y - r / 2}l${-r} ${r}M${x2 - r / 2} ${y - r / 2}l${r} ${r}M${x2 + r / 2} ${y - r / 2}l${-r} ${r}`} {...line} strokeWidth="2" fill="none" />
      ) : (
        <g className="kw-eyes">
          <circle cx={x1 + 1} cy={y + 1} r={r * 0.45} fill={INK} />
          <circle cx={x2 + 1} cy={y + 1} r={r * 0.45} fill={INK} />
        </g>
      )}
    </g>
  )
}

function Smile({ x, y, w = 10, hurt }: { x: number; y: number; w?: number; hurt: boolean }): ReactElement {
  return <path d={hurt ? `M${x - w / 2} ${y + 2}q${w / 2} ${-5} ${w} 0` : `M${x - w / 2} ${y}q${w / 2} 5 ${w} 0`} fill="none" {...line} strokeWidth="2" />
}

function Letter({ x, y, ch, className }: { x: number; y: number; ch: string; className?: string }): ReactElement {
  return (
    <text x={x} y={y} textAnchor="middle" fontSize="11" fontWeight="700" fill={INK} fontFamily="system-ui, sans-serif" {...(className ? { className } : {})}>
      {ch}
    </text>
  )
}

function Clickerclaw({ hurt }: { hurt: boolean }): ReactNode {
  return (
    <g className="kw-sway" {...line}>
      <path d="M26 66l-12 8M24 60l-14 2M70 66l12 8M72 60l14 2" fill="none" />
      <path d="M26 54q-14 -2 -18 -14M70 54q14 -2 18 -14" fill="none" />
      <path d="M8 40q-6 -9 2 -14q2 5 6 4q2 -4 6 -1q2 8 -8 12z" fill={DANGER} />
      <path d="M88 40q6 -9 -2 -14q-2 5 -6 4q-2 -4 -6 -1q-2 8 8 12z" fill={DANGER} />
      <path d="M40 40v-14M56 40v-14" fill="none" />
      <ellipse cx="48" cy="60" rx="26" ry="20" fill={DANGER} />
      <Eyes x1={40} x2={56} y={24} r={6.5} hurt={hurt} />
      <rect x="30" y="49" width="36" height="24" rx="3" fill={WHITE} strokeWidth="2" />
      <path d="M31 57h34M31 65h34" strokeWidth="1.500" fill="none" />
      <g className="kw-twinkle" strokeWidth="1.500">
        <circle cx="38" cy="57" r="3" fill={YELLOW} />
        <circle cx="46" cy="57" r="3" fill={SKY} />
        <circle cx="42" cy="65" r="3" fill={SKY} />
        <circle cx="56" cy="65" r="3" fill={YELLOW} />
      </g>
    </g>
  )
}

function Mumblewump({ hurt }: { hurt: boolean }): ReactNode {
  const bumps = Array.from({ length: 12 }, (_, i) => i)
  return (
    <g>
      <g className="kw-egg">
        <g {...line}>
          {bumps.map((i) => (
            <circle key={i} cx={48 + 27 * Math.cos((i * Math.PI) / 6)} cy={56 + 27 * Math.sin((i * Math.PI) / 6)} r="9" fill={LILAC} />
          ))}
        </g>
        <circle cx="48" cy="56" r="27" fill={LILAC} />
        <Eyes x1={38} x2={58} y={50} r={8} hurt={hurt} />
        <path d={hurt ? 'M38 72q5 -6 10 -2t10 -2' : 'M38 68q5 6 10 1t10 3'} fill="none" {...line} strokeWidth="2" />
      </g>
      <g className="kw-bob">
        <Letter x={16} y={20} ch="q" />
        <Letter x={48} y={14} ch="z" />
        <Letter x={80} y={22} ch="b" />
      </g>
    </g>
  )
}

function Mossback({ hurt }: { hurt: boolean }): ReactNode {
  return (
    <g {...line}>
      <path d="M22 86q6 -6 6 -14V38h40v34q0 8 6 14z" fill={LAVENDER} />
      <path d="M28 40q-6 -12 4 -14q2 -10 12 -6q8 -8 16 0q10 -4 12 6q8 4 4 14q-24 8 -48 0z" fill={SUCCESS} />
      <g className="kw-sway">
        <path d="M70 22q10 -10 18 -6q-2 12 -14 12z" fill={SUCCESS} />
      </g>
      <Eyes x1={40} x2={58} y={54} r={6} hurt={hurt} />
      {hurt ? null : <path d="M34 48h12M52 48h12" strokeWidth="3" fill="none" />}
      <Smile x={49} y={68} w={12} hurt={hurt} />
      <path d="M32 78q4 -2 6 0M60 76q4 -2 6 0" fill="none" strokeWidth="1.800" />
      <path d="M14 86q0 -12 8 -12t8 12z" fill={WHITE} />
      <path d="M14 76q8 -8 16 0z" fill={DANGER} />
    </g>
  )
}

function Pizzasaur({ hurt }: { hurt: boolean }): ReactNode {
  return (
    <g className="kw-egg" {...line}>
      <g className="kw-tail">
        <path d="M24 70q-16 2 -18 -10q10 2 22 -6z" fill={SUCCESS} />
      </g>
      <path d="M30 44L38 20L50 42z" fill={YELLOW} />
      <path d="M46 40L58 12L68 38z" fill={YELLOW} />
      <circle cx="42" cy="34" r="2.500" fill={DANGER} strokeWidth="1.500" />
      <circle cx="58" cy="28" r="2.800" fill={DANGER} strokeWidth="1.500" />
      <path d="M24 74q0 -34 30 -34q26 0 26 20q0 16 -16 18v8h-10v-6h-10v6h-10v-8q-10 0 -10 -4z" fill={SUCCESS} />
      <Eyes x1={58} x2={72} y={54} r={6} hurt={hurt} />
      <path d={hurt ? 'M58 70q7 -6 14 0' : 'M56 66q8 8 18 0'} fill={hurt ? 'none' : WHITE} strokeWidth="2" />
      <path d="M32 62q6 -6 12 0" fill="none" strokeWidth="1.800" />
    </g>
  )
}

function Flapdoodle({ hurt }: { hurt: boolean }): ReactNode {
  return (
    <g>
      <g className="kw-bob" {...line}>
        <g className="kw-wing">
          <path d="M30 46Q10 26 2 44q6 2 6 10q6 -2 8 6q6 -4 10 2z" fill={LILAC} />
        </g>
        <g className="kw-wing">
          <path d="M66 46Q86 26 94 44q-6 2 -6 10q-6 -2 -8 6q-6 -4 -10 2z" fill={LILAC} />
        </g>
        <path d="M34 28L30 12L44 22zM62 28L66 12L52 22z" fill={GRAPE} />
        <ellipse cx="48" cy="46" rx="21" ry="24" fill={GRAPE} />
        <Eyes x1={40} x2={56} y={38} r={7} hurt={hurt} />
        <path d={hurt ? 'M42 56q6 -5 12 0' : 'M42 52q6 6 12 0'} fill="none" stroke={WHITE} strokeWidth="2.200" />
        <path d="M44 53l2 4l2 -3M52 53l-2 4l-2 -3" fill={WHITE} stroke={WHITE} strokeWidth="1" />
      </g>
      <g className="kw-bob">
        <Letter x={20} y={82} ch="E" />
        <Letter x={70} y={86} ch="B" />
      </g>
    </g>
  )
}

function RainbowSnail({ hurt }: { hurt: boolean }): ReactNode {
  return (
    <g className="kw-drift" {...line}>
      <path d="M10 84q0 -10 16 -10h34q24 0 26 -22q0 -14 -10 -14t-10 10v12H34q-24 0 -24 24z" fill={LAVENDER} />
      <path d="M72 38l-4 -16M82 38l4 -16" fill="none" />
      <circle cx="68" cy="20" r="3.500" fill={YELLOW} />
      <circle cx="87" cy="20" r="3.500" fill={YELLOW} />
      <circle cx="44" cy="52" r="28" fill={DANGER} />
      <circle cx="44" cy="52" r="22.500" fill={YELLOW} strokeWidth="2" />
      <circle cx="44" cy="52" r="17" fill={SUCCESS} strokeWidth="2" />
      <circle cx="44" cy="52" r="11.500" fill={SKY} strokeWidth="2" />
      <circle cx="44" cy="52" r="6" fill={LILAC} strokeWidth="2" />
      <Eyes x1={70} x2={84} y={46} r={5} hurt={hurt} />
      <Smile x={77} y={56} w={9} hurt={hurt} />
    </g>
  )
}

function TickToad({ hurt }: { hurt: boolean }): ReactNode {
  return (
    <g {...line}>
      <path d="M14 86q-8 0 -4 -8q4 -6 12 -4M82 86q8 0 4 -8q-4 -6 -12 -4" fill={SUCCESS} />
      <path d="M14 66q0 -34 34 -34t34 34q0 20 -34 20t-34 -20z" fill={SUCCESS} />
      <circle cx="30" cy="30" r="11" fill={SUCCESS} />
      <circle cx="66" cy="30" r="11" fill={SUCCESS} />
      <Eyes x1={30} x2={66} y={28} r={7} hurt={hurt} />
      <Smile x={48} y={44} w={22} hurt={hurt} />
      <circle cx="48" cy="66" r="16" fill={WHITE} />
      <path d="M48 53v3M48 76v3M35 66h3M58 66h3" strokeWidth="2" fill="none" />
      <path d="M48 66l6 4" fill="none" />
      <g transform="translate(48 66)">
        <g className="kw-spin">
          <path d="M0 0v-11" fill="none" stroke={DANGER} />
        </g>
      </g>
      <circle cx="48" cy="66" r="2" fill={INK} />
    </g>
  )
}

function InkyBlot({ hurt }: { hurt: boolean }): ReactNode {
  return (
    <g {...line}>
      <g className="kw-wave" fill="none" strokeWidth="6" stroke={INK}>
        <path d="M30 60q-14 10 -10 26M42 64q-6 12 -2 24M54 64q6 12 2 24M66 60q14 10 10 26" />
      </g>
      <g className="kw-wave" fill="none" strokeWidth="2.500" stroke={SKY}>
        <path d="M30 60q-14 10 -10 26M42 64q-6 12 -2 24M54 64q6 12 2 24M66 60q14 10 10 26" />
      </g>
      <path d="M22 62Q18 18 48 8Q78 18 74 62q-26 10 -52 0z" fill={SKY} />
      <Eyes x1={37} x2={59} y={40} r={8} hurt={hurt} />
      <Smile x={48} y={54} w={12} hurt={hurt} />
      <g className="kw-bob" fill={INK} stroke="none">
        <circle cx="10" cy="28" r="3.500" />
        <path d="M10 28q2 7 -4 9q3 -3 1 -7z" />
        <circle cx="86" cy="24" r="3.500" />
      </g>
    </g>
  )
}

function Voltafin({ hurt }: { hurt: boolean }): ReactNode {
  const body = 'M14 78q20 10 30 -6t26 -14q10 -2 10 -14'
  return (
    <g>
      <g className="kw-wave">
        <path d={body} fill="none" stroke={INK} strokeWidth="19" strokeLinecap="round" />
        <path d={body} fill="none" stroke={YELLOW} strokeWidth="14" strokeLinecap="round" />
      </g>
      <g {...line}>
        <circle cx="74" cy="34" r="18" fill={YELLOW} />
        <path d="M60 26L48 16L64 18z" fill={SKY} />
        <Eyes x1={68} x2={82} y={32} r={6} hurt={hurt} />
        <Smile x={75} y={43} w={10} hurt={hurt} />
      </g>
      <g className="kw-twinkle" {...line} fill={SKY} strokeWidth="1.800">
        <path d="M28 22l-8 14h7l-5 12l13 -16h-7l5 -10z" />
        <path d="M48 44l-4 8h4l-3 7l8 -9h-4l3 -6z" />
      </g>
    </g>
  )
}

function Hexapuff({ hurt }: { hurt: boolean }): ReactNode {
  return (
    <g className="kw-pet" {...line}>
      <path d="M48 6v8M86 26l-7 4M86 70l-7 -4M48 90v-8M10 70l7 -4M10 26l7 4" strokeWidth="3" fill="none" />
      <path d="M48 12L80 30V66L48 84L16 66V30z" fill={YELLOW} />
      <path d="M16 44L4 36v24l12 -8z" fill={SKY} />
      <Eyes x1={37} x2={59} y={42} r={8} hurt={hurt} />
      <circle cx="48" cy="62" r="5" fill={hurt ? INK : WHITE} strokeWidth="2" />
      <path d="M26 72l4 2M66 72l-4 2M40 78h4" strokeWidth="1.800" fill="none" />
    </g>
  )
}

function Bookworm({ hurt }: { hurt: boolean }): ReactNode {
  return (
    <g {...line}>
      <path d="M10 88q20 -10 38 0q18 -10 38 0v-8q-20 -10 -38 0q-18 -10 -38 0z" fill={WHITE} />
      <g className="kw-sway">
        <circle cx="48" cy="76" r="11" fill={SUCCESS} />
        <circle cx="44" cy="64" r="11" fill={YELLOW} />
        <circle cx="50" cy="52" r="11" fill={SUCCESS} />
        <circle cx="48" cy="36" r="15" fill={YELLOW} />
        <Eyes x1={42} x2={56} y={36} r={5} hurt={hurt} />
        <circle cx="56" cy="36" r="7.500" fill="none" strokeWidth="2" />
        <path d="M63 40l4 10" fill="none" strokeWidth="1.800" />
        <Smile x={48} y={44} w={9} hurt={hurt} />
        {hurt ? null : (
          <g>
            <path d="M34 24h28" />
            <path d="M38 24l1 -16h18l1 16z" fill={GRAPE} />
            <path d="M39 18h18" stroke={DANGER} strokeWidth="3" />
          </g>
        )}
      </g>
    </g>
  )
}

function Comet({ hurt }: { hurt: boolean }): ReactNode {
  return (
    <g>
      <g className="kw-twinkle" {...line}>
        <path d="M38 64Q18 76 4 92q6 -18 18 -30Q10 62 2 56q16 -2 32 -6z" fill={YELLOW} />
      </g>
      <g className="kw-bob" {...line}>
        <circle cx="58" cy="50" r="24" fill={SKY} />
        <path d="M42 36q4 2 8 0M60 62q6 2 10 -2" fill="none" strokeWidth="1.800" />
        <path d="M36 32q22 -18 44 0q-22 8 -44 0z" fill={GRAPE} />
        <path d="M58 26v-14q10 0 14 6l-14 4" fill={DANGER} />
        <Eyes x1={50} x2={68} y={48} r={6} hurt={hurt} />
        <Smile x={59} y={60} w={11} hurt={hurt} />
      </g>
    </g>
  )
}

function Aurora({ hurt }: { hurt: boolean }): ReactNode {
  return (
    <g>
      <g className="kw-wave" {...line}>
        <path d="M28 88Q10 66 26 50T30 20Q54 12 66 22Q60 40 72 52T72 88z" fill={SUCCESS} />
        <path d="M38 88Q22 68 36 52T40 24Q52 20 58 26Q54 42 62 54T62 88z" fill={LILAC} strokeWidth="2" />
        <path d="M46 88Q36 70 46 54T48 30Q52 28 53 32Q50 44 54 56T54 88z" fill={SKY} strokeWidth="1.800" />
      </g>
      <g {...line}>
        <circle cx="48" cy="40" r="14" fill={WHITE} />
        <Eyes x1={42} x2={54} y={38} r={4.500} hurt={hurt} />
        <Smile x={48} y={46} w={8} hurt={hurt} />
      </g>
      <g className="kw-twinkle" fill={YELLOW} {...line} strokeWidth="1.500">
        <path d="M14 18l1.600 3.400 3.400 1.600 -3.400 1.600 -1.600 3.400 -1.600 -3.400 -3.400 -1.600 3.400 -1.600z" />
        <path d="M82 28l1.400 3 3 1.400 -3 1.400 -1.400 3 -1.400 -3 -3 -1.400 3 -1.400z" />
        <path d="M78 66l1.200 2.600 2.600 1.200 -2.600 1.200 -1.200 2.600 -1.200 -2.600 -2.600 -1.200 2.600 -1.200z" />
      </g>
    </g>
  )
}

/** Satu lawan menurut id dari katalog (@kira/core). `energy` 0 sampai 1 hanya dipakai inti dada Puzzle Robot. */
export function BossArt({ id, size = 128, energy = 1, hurt = false, title, className }: { id: string; size?: number; energy?: number; hurt?: boolean; title?: string; className?: string }): ReactElement {
  if (id === 'robot') return <RobotArt size={size} energy={energy} hurt={hurt} {...(title ? { title } : {})} {...(className ? { className } : {})} />
  const body: Record<string, ReactNode> = {
    clickerclaw: <Clickerclaw hurt={hurt} />,
    mumblewump: <Mumblewump hurt={hurt} />,
    mossback: <Mossback hurt={hurt} />,
    pizzasaur: <Pizzasaur hurt={hurt} />,
    flapdoodle: <Flapdoodle hurt={hurt} />,
    rainbow: <RainbowSnail hurt={hurt} />,
    ticktoad: <TickToad hurt={hurt} />,
    inkyblot: <InkyBlot hurt={hurt} />,
    voltafin: <Voltafin hurt={hurt} />,
    hexapuff: <Hexapuff hurt={hurt} />,
    bookworm: <Bookworm hurt={hurt} />,
    comet: <Comet hurt={hurt} />,
    aurora: <Aurora hurt={hurt} />,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      <ellipse cx="48" cy="91" rx="28" ry="3.500" fill={DIVIDER} />
      {body[id] ?? <Mumblewump hurt={hurt} />}
    </svg>
  )
}
