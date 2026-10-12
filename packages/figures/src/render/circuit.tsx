import type { ReactNode } from 'react'
import { DIVIDER, INK, MATH_50, REVIEW, STAR, WARN_50, WHITE } from '../palette'
import { PAD, r2, SW, SW2, Txt, type Drawn, type Spec } from './kit'

type Part = Spec<'circuit'>['parts'][number]

/** Lebar komponen dari terminal ke terminal (kabel tersambung di x = +-span/2, y = 0). */
function span(part: Part, symbols: boolean): number {
  if (symbols) {
    switch (part) {
      case 'battery': return 40
      case 'bulb': case 'bulb-lit': return 30
      case 'switch-open': case 'switch-closed': return 40
      case 'buzzer': return 32
      case 'motor': return 30
      default: return 36
    }
  }
  switch (part) {
    case 'battery': return 70
    case 'bulb': case 'bulb-lit': return 34
    case 'switch-open': case 'switch-closed': return 60
    case 'buzzer': return 44
    case 'motor': return 48
    default: return 40
  }
}

/** Seberapa jauh komponen menonjol ke atas dan ke bawah dari garis kabel. */
function extent(part: Part, symbols: boolean): { up: number; down: number } {
  if (symbols) {
    if (part === 'bulb-lit') return { up: 26, down: 26 }
    if (part === 'switch-open') return { up: 24, down: 6 }
    if (part === 'battery') return { up: 18, down: 18 }
    return { up: 18, down: 16 }
  }
  switch (part) {
    case 'battery': return { up: 16, down: 16 }
    case 'bulb': return { up: 58, down: 10 }
    case 'bulb-lit': return { up: 70, down: 10 }
    case 'switch-open': return { up: 36, down: 12 }
    case 'switch-closed': return { up: 10, down: 12 }
    case 'buzzer': return { up: 40, down: 4 }
    case 'motor': return { up: 50, down: 16 }
    default: return { up: 8, down: 8 }
  }
}

const rays = (cx: number, cy: number, r1: number, r2_: number): string =>
  Array.from({ length: 8 }, (_, k) => {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8
    if (Math.sin(a) > 0.6) return ''
    return `M${r2(cx + Math.cos(a) * r1)} ${r2(cy + Math.sin(a) * r1)}L${r2(cx + Math.cos(a) * r2_)} ${r2(cy + Math.sin(a) * r2_)}`
  }).join('')

/** Sinar lampu menyala pada simbol: tanpa sinar mendatar supaya tidak tertukar dengan kabel. */
const symbolRays = [45, 90, 135, 225, 270, 315]
  .map((deg) => {
    const a = (deg * Math.PI) / 180
    return `M${r2(Math.cos(a) * 20)} ${r2(Math.sin(a) * 20)}L${r2(Math.cos(a) * 27)} ${r2(Math.sin(a) * 27)}`
  })
  .join('')

/** Komponen bergambar, berpusat di (0, 0) pada garis kabel. */
function Pictorial({ part }: { part: Part }): ReactNode {
  const st = { stroke: INK, strokeWidth: SW2 }
  switch (part) {
    case 'battery':
      return (
        <g>
          <rect x={-35} y={-15} width={62} height={30} rx={5} fill={WHITE} {...st} />
          <path d="M-35 -10Q-35 -15 -30 -15H-12V15H-30Q-35 15 -35 10Z" fill={INK} />
          <rect x={27} y={-7} width={8} height={14} rx={2} fill={REVIEW} {...st} />
          <Txt x={-24} y={0} size={16} weight={800} fill={WHITE}>{'−'}</Txt>
          <Txt x={14} y={0} size={16} weight={800}>+</Txt>
        </g>
      )
    case 'bulb':
    case 'bulb-lit': {
      const lit = part === 'bulb-lit'
      return (
        <g>
          {lit && <path d={rays(0, -36, 25, 34)} stroke={INK} strokeWidth={SW2} />}
          <path d="M-9 -16C-9 -22 -19 -26 -19 -38A19 19 0 1 1 19 -38C19 -26 9 -22 9 -16Z" fill={lit ? STAR : WHITE} {...st} />
          <path d="M-5 -16L-5 -32L-2 -36L0 -32L2 -36L5 -32L5 -16" fill="none" stroke={INK} strokeWidth={1.5} />
          <rect x={-17} y={-17} width={34} height={14} rx={3} fill={REVIEW} {...st} />
          <rect x={-17} y={-3} width={34} height={11} rx={3} fill={DIVIDER} {...st} />
        </g>
      )
    }
    case 'switch-open':
    case 'switch-closed': {
      const open = part === 'switch-open'
      const ang = open ? (-32 * Math.PI) / 180 : 0
      const lx = -24 + Math.cos(ang) * 50
      const ly = Math.sin(ang) * 50
      return (
        <g>
          <rect x={-32} y={-5} width={64} height={15} rx={4} fill={WARN_50} {...st} />
          <line x1={-24} y1={0} x2={r2(lx)} y2={r2(ly)} stroke={INK} strokeWidth={5} />
          <circle cx={-24} cy={0} r={5} fill={REVIEW} {...st} />
          <circle cx={24} cy={0} r={5} fill={REVIEW} {...st} />
        </g>
      )
    }
    case 'buzzer':
      return (
        <g>
          <path d="M-22 0H-16V-6M22 0H16V-6" fill="none" stroke={INK} strokeWidth={SW2} />
          <rect x={-22} y={-38} width={44} height={32} rx={8} fill={DIVIDER} {...st} />
          <circle cx={0} cy={-22} r={9} fill={WHITE} {...st} />
          <circle cx={0} cy={-22} r={3} fill={INK} />
        </g>
      )
    case 'motor':
      return (
        <g>
          <line x1={0} y1={-16} x2={0} y2={-38} stroke={INK} strokeWidth={3} />
          <ellipse cx={-12} cy={-42} rx={12} ry={5} fill={MATH_50} {...st} />
          <ellipse cx={12} cy={-42} rx={12} ry={5} fill={MATH_50} {...st} />
          <rect x={-24} y={-16} width={48} height={32} rx={10} fill={REVIEW} {...st} />
          <circle cx={0} cy={-42} r={3} fill={INK} />
        </g>
      )
    default:
      return (
        <g>
          <circle cx={-20} cy={0} r={4} fill={WHITE} {...st} />
          <circle cx={20} cy={0} r={4} fill={WHITE} {...st} />
        </g>
      )
  }
}

/** Simbol rangkaian standar, berpusat di (0, 0). */
function Symbol({ part }: { part: Part }): ReactNode {
  const st = { stroke: INK, strokeWidth: SW2, fill: 'none' }
  switch (part) {
    case 'battery':
      return (
        <g>
          <path d="M-20 -18V18M-4 -18V18" stroke={INK} strokeWidth={SW} strokeLinecap="butt" />
          <path d="M-12 -9V9M4 -9V9" stroke={INK} strokeWidth={6} strokeLinecap="butt" />
          <path d="M-12 0H-4M4 0H20" {...st} />
        </g>
      )
    case 'bulb':
    case 'bulb-lit':
      return (
        <g>
          {part === 'bulb-lit' && <path d={symbolRays} stroke={INK} strokeWidth={SW2} />}
          <circle cx={0} cy={0} r={15} fill={part === 'bulb-lit' ? STAR : WHITE} stroke={INK} strokeWidth={SW2} />
          <path d="M-10.6 -10.6L10.6 10.6M10.6 -10.6L-10.6 10.6" {...st} />
        </g>
      )
    case 'switch-open':
    case 'switch-closed': {
      // tuas berporos di kontak kiri; tertutup berarti tuas bersandar di atas kontak kanan
      const open = part === 'switch-open'
      const end = open ? { x: -16 + Math.cos(-Math.PI / 6) * 34, y: Math.sin(-Math.PI / 6) * 34 } : { x: 17, y: -4.5 }
      return (
        <g>
          <path d="M-20 0H-16M16 0H20" {...st} />
          <circle cx={-16} cy={0} r={4} fill={WHITE} stroke={INK} strokeWidth={SW2} />
          <circle cx={16} cy={0} r={4} fill={WHITE} stroke={INK} strokeWidth={SW2} />
          <line x1={-16} y1={0} x2={r2(end.x)} y2={r2(end.y)} stroke={INK} strokeWidth={SW} />
        </g>
      )
    }
    case 'buzzer':
      return (
        <g>
          <path d="M-16 0H-8V-6M8 -6V0H16" {...st} />
          <path d="M-14 -6A14 14 0 0 1 14 -6Z" fill={WHITE} stroke={INK} strokeWidth={SW2} />
        </g>
      )
    case 'motor':
      return (
        <g>
          <circle cx={0} cy={0} r={15} fill={WHITE} stroke={INK} strokeWidth={SW2} />
          <Txt x={0} y={0} size={16} weight={800}>M</Txt>
        </g>
      )
    default:
      return (
        <g>
          <circle cx={-18} cy={0} r={3.5} fill={WHITE} stroke={INK} strokeWidth={SW2} />
          <circle cx={18} cy={0} r={3.5} fill={WHITE} stroke={INK} strokeWidth={SW2} />
        </g>
      )
  }
}

export function drawCircuit(s: Spec<'circuit'>): Drawn {
  const parts = (s.parts ?? []).slice(0, 6)
  const symbols = s.symbols ?? false
  const topCount = Math.ceil(parts.length / 2)
  const top = parts.slice(0, topCount)
  const bottom = parts.slice(topCount).reverse()
  const slot = symbols ? 92 : 112
  const margin = 46
  const W = Math.max(top.length, bottom.length, 2) * slot + margin * 2
  const upTop = Math.max(0, ...top.map((p) => extent(p, symbols).up))
  const downTop = Math.max(0, ...top.map((p) => extent(p, symbols).down))
  const upBottom = Math.max(0, ...bottom.map((p) => extent(p, symbols).up))
  const downBottom = Math.max(0, ...bottom.map((p) => extent(p, symbols).down))
  const H = Math.max(symbols ? 110 : 130, downTop + upBottom + 40)
  const x0 = PAD + 4
  const y0 = PAD + upTop + 4
  const x1 = x0 + W
  const y1 = y0 + H
  const rad = 14
  const place = (list: Part[]): { part: Part; cx: number; a: number; b: number }[] => {
    const step = (W - margin * 2) / Math.max(1, list.length)
    return list.map((part, i) => {
      const cx = x0 + margin + step * (i + 0.5)
      const half = span(part, symbols) / 2
      return { part, cx, a: cx - half, b: cx + half }
    })
  }
  const topPlaced = place(top)
  const bottomPlaced = place(bottom)
  // kabel: keliling persegi panjang, terputus di setiap komponen
  let d = `M${x0} ${y0 + rad}Q${x0} ${y0} ${x0 + rad} ${y0}`
  for (const p of topPlaced) d += `H${r2(p.a)}M${r2(p.b)} ${y0}`
  d += `H${x1 - rad}Q${x1} ${y0} ${x1} ${y0 + rad}V${y1 - rad}Q${x1} ${y1} ${x1 - rad} ${y1}`
  for (const p of [...bottomPlaced].reverse()) d += `H${r2(p.b)}M${r2(p.a)} ${y1}`
  d += `H${x0 + rad}Q${x0} ${y1} ${x0} ${y1 - rad}Z`
  const Comp = symbols ? Symbol : Pictorial
  return {
    w: Math.ceil(x1 + PAD + 4),
    h: Math.ceil(y1 + downBottom + PAD + 4),
    el: (
      <g>
        <path d={d.replace(/Z$/, `V${y0 + rad}`)} fill="none" stroke={INK} strokeWidth={SW} />
        {topPlaced.map((p, i) => (
          <g key={`t${i}`} transform={`translate(${r2(p.cx)} ${y0})`}><Comp part={p.part} /></g>
        ))}
        {bottomPlaced.map((p, i) => (
          <g key={`b${i}`} transform={`translate(${r2(p.cx)} ${y1})`}><Comp part={p.part} /></g>
        ))}
      </g>
    ),
  }
}
