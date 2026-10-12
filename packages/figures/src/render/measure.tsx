import type { ReactNode } from 'react'
import { IconGlyph } from '../icons'
import type { IconName } from '../spec'
import {
  BG, ENGLISH, ENGLISH_50, INK, MATH_50, MUTED, REVIEW, SCIENCE, SCIENCE_50, STAR, WARN, WARN_50, WHITE,
} from '../palette'
import { clamp, int, PAD, polyPath, r2, SW, SW1, SW2, Txt, type Drawn, type Spec } from './kit'

/** Benda di atas penggaris, dari xa ke xb dengan alas di yb. Ujung benda tepat di xa dan xb. */
function RulerObject({ icon, xa, xb, yb }: { icon: IconName | undefined; xa: number; xb: number; yb: number }): ReactNode {
  const L = xb - xa
  const st = { stroke: INK, strokeWidth: SW2 }
  switch (icon) {
    case 'pencil': {
      const h = 26
      const c = Math.min(34, L * 0.2)
      const e = Math.min(16, L * 0.1)
      const f = Math.min(9, L * 0.06)
      const yt = yb - h
      const ym = yb - h / 2
      const g = c * 0.36
      return (
        <g>
          <path d={`M${r2(xa + e)} ${r2(yt)}H${r2(xa + 5)}Q${r2(xa)} ${r2(yt)} ${r2(xa)} ${r2(yt + 5)}V${r2(yb - 5)}Q${r2(xa)} ${r2(yb)} ${r2(xa + 5)} ${r2(yb)}H${r2(xa + e)}Z`} fill={ENGLISH_50} {...st} />
          <rect x={r2(xa + e)} y={r2(yt)} width={r2(f)} height={h} fill={REVIEW} {...st} />
          <rect x={r2(xa + e + f)} y={r2(yt)} width={r2(L - e - f - c)} height={h} fill={STAR} {...st} />
          <line x1={r2(xa + e + f)} y1={r2(ym)} x2={r2(xb - c)} y2={r2(ym)} stroke={WARN} strokeWidth={SW1} />
          <path d={polyPath([[xb - c, yt], [xb, ym], [xb - c, yb]])} fill={WARN_50} {...st} />
          <path d={polyPath([[xb - g, ym - (h / 2) * (g / c)], [xb, ym], [xb - g, ym + (h / 2) * (g / c)]])} fill={INK} stroke={INK} strokeWidth={1} />
        </g>
      )
    }
    case 'crayon': {
      const h = 26
      const c = Math.min(26, L * 0.18)
      const yt = yb - h
      const ym = yb - h / 2
      return (
        <g>
          <path d={polyPath([[xb - c, yt + 3], [xb, ym - 4], [xb, ym + 4], [xb - c, yb - 3]])} fill={ENGLISH} {...st} />
          <rect x={r2(xa)} y={r2(yt)} width={r2(L - c)} height={h} rx={4} fill={ENGLISH} {...st} />
          <rect x={r2(xa + (L - c) * 0.25)} y={r2(yt + 4)} width={r2((L - c) * 0.5)} height={h - 8} rx={3} fill={ENGLISH_50} />
        </g>
      )
    }
    case 'nail': {
      const h = 24
      const p = Math.min(18, L * 0.18)
      const t = 8
      return (
        <g>
          <path d={polyPath([[xa + 7, yb - h / 2 - t / 2], [xb - p, yb - h / 2 - t / 2], [xb, yb - h / 2], [xb - p, yb - h / 2 + t / 2], [xa + 7, yb - h / 2 + t / 2]])} fill={REVIEW} {...st} />
          <rect x={r2(xa)} y={r2(yb - h)} width={7} height={h} rx={2} fill={REVIEW} {...st} />
        </g>
      )
    }
    case 'key': {
      const d = Math.min(34, L * 0.38)
      const t = 9
      const ym = yb - d / 2
      const tx = xb - Math.min(26, L * 0.25)
      return (
        <g>
          <path d={`M${r2(xa + d - 3)} ${r2(ym - t / 2)}H${r2(xb)}V${r2(ym + t / 2)}H${r2(xb - 3)}V${r2(ym + t / 2 + 8)}H${r2(xb - 9)}V${r2(ym + t / 2)}H${r2(tx + 6)}V${r2(ym + t / 2 + 10)}H${r2(tx)}V${r2(ym + t / 2)}H${r2(xa + d - 3)}Z`} fill={STAR} {...st} />
          <circle cx={r2(xa + d / 2)} cy={r2(ym)} r={r2(d / 2)} fill={STAR} {...st} />
          <circle cx={r2(xa + d / 2)} cy={r2(ym)} r={r2(d / 5)} fill={WHITE} {...st} />
        </g>
      )
    }
    case 'leaf': {
      const stalk = Math.min(18, L * 0.14)
      const h = clamp(L * 0.34, 18, 56)
      const ym = yb - h / 2
      const x1 = xa + stalk
      return (
        <g>
          <line x1={r2(xa)} y1={r2(ym)} x2={r2(x1)} y2={r2(ym)} stroke={INK} strokeWidth={SW} />
          <path d={`M${r2(x1)} ${r2(ym)}Q${r2(x1 + (xb - x1) * 0.45)} ${r2(ym - h * 0.95)} ${r2(xb)} ${r2(ym)}Q${r2(x1 + (xb - x1) * 0.45)} ${r2(ym + h * 0.95)} ${r2(x1)} ${r2(ym)}Z`} fill={SCIENCE_50} {...st} />
          <line x1={r2(x1)} y1={r2(ym)} x2={r2(xb - 4)} y2={r2(ym)} stroke={SCIENCE} strokeWidth={SW1} />
        </g>
      )
    }
    case 'worm': {
      const h = 18
      const segs: string[] = []
      for (let x = xa + 18; x < xb - 18; x += 22) segs.push(`M${r2(x)} ${r2(yb - h + 4)}Q${r2(x + 4)} ${r2(yb - h / 2)} ${r2(x)} ${r2(yb - 4)}`)
      return (
        <g>
          <rect x={r2(xa)} y={r2(yb - h)} width={r2(L)} height={h} rx={h / 2} fill={ENGLISH_50} {...st} />
          <path d={segs.join('')} stroke={ENGLISH} strokeWidth={1.5} fill="none" />
          <circle cx={r2(xb - 7)} cy={r2(yb - h / 2 - 2)} r={1.8} fill={INK} />
        </g>
      )
    }
    case 'caterpillar': {
      const d = Math.min(26, L)
      const n = Math.max(2, Math.floor((L - d) / (d * 0.72)) + 1)
      const sp = n > 1 ? (L - d) / (n - 1) : 0
      return (
        <g>
          {Array.from({ length: n }, (_, i) => (
            <circle key={i} cx={r2(xa + d / 2 + i * sp)} cy={r2(yb - d / 2)} r={r2(d / 2)} fill={i === n - 1 ? SCIENCE_50 : SCIENCE_50} {...st} />
          ))}
          <circle cx={r2(xb - d / 2 + 4)} cy={r2(yb - d / 2 - 3)} r={2} fill={INK} />
        </g>
      )
    }
    case 'paperclip': {
      const h = 20
      const ym = yb - h / 2
      return (
        <path
          d={`M${r2(xa + L * 0.72)} ${r2(ym + 4)}H${r2(xa + h * 0.45)}A4 4 0 0 1 ${r2(xa + h * 0.45)} ${r2(ym - 4)}H${r2(xb - h / 2)}A${h / 2} ${h / 2} 0 0 1 ${r2(xb - h / 2)} ${r2(yb)}H${r2(xa + h / 2)}A${h / 2} ${h / 2} 0 0 1 ${r2(xa + h / 2)} ${r2(yb - h)}H${r2(xa + L * 0.8)}`}
          fill="none"
          stroke={INK}
          strokeWidth={SW}
        />
      )
    }
    case 'spoon':
    case 'wooden-spoon': {
      const bowl = Math.min(56, L * 0.34)
      const bh = 28
      const ym = yb - bh / 2
      const fill = icon === 'spoon' ? REVIEW : WARN_50
      return (
        <g>
          <rect x={r2(xa)} y={r2(ym - 5)} width={r2(L - bowl + 4)} height={10} rx={5} fill={fill} {...st} />
          <ellipse cx={r2(xb - bowl / 2)} cy={r2(ym)} rx={r2(bowl / 2)} ry={bh / 2} fill={fill} {...st} />
        </g>
      )
    }
    case 'feather': {
      const h = clamp(L * 0.26, 16, 40)
      const ym = yb - h / 2
      const x1 = xa + Math.min(16, L * 0.12)
      const vanes: string[] = []
      for (let x = x1 + 10; x < xb - 10; x += 10) vanes.push(`M${r2(x)} ${r2(ym)}L${r2(x + 7)} ${r2(ym - h * 0.32)}M${r2(x)} ${r2(ym)}L${r2(x + 7)} ${r2(ym + h * 0.32)}`)
      return (
        <g>
          <path d={`M${r2(x1)} ${r2(ym)}Q${r2(x1 + (xb - x1) * 0.4)} ${r2(ym - h)} ${r2(xb)} ${r2(ym)}Q${r2(x1 + (xb - x1) * 0.4)} ${r2(ym + h)} ${r2(x1)} ${r2(ym)}Z`} fill={WHITE} {...st} />
          <path d={vanes.join('')} stroke={REVIEW} strokeWidth={1.25} fill="none" />
          <line x1={r2(xa)} y1={r2(ym)} x2={r2(xb - 2)} y2={r2(ym)} stroke={INK} strokeWidth={SW2} />
        </g>
      )
    }
    case 'toothbrush': {
      const head = Math.min(44, L * 0.3)
      const bristles: string[] = []
      for (let x = xb - head + 5; x < xb - 2; x += 5) bristles.push(`M${r2(x)} ${r2(yb - 12)}V${r2(yb - 28)}`)
      return (
        <g>
          <path d={bristles.join('')} stroke={INK} strokeWidth={1.5} fill="none" />
          <rect x={r2(xa)} y={r2(yb - 12)} width={r2(L)} height={12} rx={6} fill={MATH_50} {...st} />
        </g>
      )
    }
    case 'eraser':
    case 'book':
    case 'brick': {
      const h = 30
      const fill = icon === 'eraser' ? ENGLISH_50 : icon === 'book' ? MATH_50 : WARN_50
      return (
        <g>
          <rect x={r2(xa)} y={r2(yb - h)} width={r2(L)} height={h} rx={icon === 'eraser' ? 6 : 3} fill={fill} {...st} />
          <line x1={r2(xa + L * 0.3)} y1={r2(yb - h)} x2={r2(xa + L * 0.3)} y2={r2(yb)} stroke={INK} strokeWidth={SW1} />
        </g>
      )
    }
    case undefined: {
      // pita sederhana
      return <rect x={r2(xa)} y={r2(yb - 24)} width={r2(L)} height={24} rx={5} fill={ENGLISH_50} stroke={INK} strokeWidth={SW2} />
    }
    default: {
      // benda lain: pita sepanjang benda dengan ikon di tengahnya
      const h = 40
      const size = 34
      const fits = L >= size + 10
      return (
        <g>
          <rect x={r2(xa)} y={r2(yb - (fits ? h : 20))} width={r2(L)} height={fits ? h : 20} rx={8} fill={BG} stroke={INK} strokeWidth={SW2} />
          <IconGlyph name={icon} x={r2(xa + L / 2 - size / 2)} y={r2(fits ? yb - h / 2 - size / 2 : yb - 20 - size - 2)} size={size} />
        </g>
      )
    }
  }
}

function rulerObjectHeight(icon: IconName | undefined, L: number): number {
  switch (icon) {
    case 'pencil': case 'crayon': return 26
    case 'nail': return 24
    case 'key': return Math.min(34, L * 0.38)
    case 'leaf': return clamp(L * 0.34, 18, 56) * 0.75 + 4
    case 'worm': return 18
    case 'caterpillar': return 26
    case 'paperclip': return 20
    case 'spoon': case 'wooden-spoon': return 28
    case 'feather': return clamp(L * 0.26, 16, 40) * 0.75 + 4
    case 'toothbrush': return 28
    case 'eraser': case 'book': case 'brick': return 30
    case undefined: return 24
    default: return L >= 44 ? 40 : 56
  }
}

export function drawRuler(s: Spec<'ruler'>): Drawn {
  const lengthCm = int(s.lengthCm, 5, 30)
  const ppc = clamp(Math.round(560 / lengthCm), 20, 40)
  const objCm = clamp(Number.isFinite(s.objectCm) ? s.objectCm : 1, 0.5, 30)
  const startCm = clamp(Number.isFinite(s.objectStartCm) ? s.objectStartCm : 0, 0, lengthCm - 0.5)
  const x0 = PAD + 18
  const xOf = (cm: number): number => x0 + cm * ppc
  // benda yang lebih panjang dari penggaris tetap terlihat menonjol, paling jauh 2 cm
  const endCm = Math.min(startCm + objCm, lengthCm + 2)
  const xa = xOf(startCm)
  const xb = xOf(Math.max(endCm, startCm + 0.5))
  const objH = rulerObjectHeight(s.object, xb - xa)
  const gap = 16
  const rulerTop = PAD + objH + gap
  const bodyH = 66
  const right = Math.max(xOf(lengthCm) + 18, xb + 4)
  const ticks: string[] = []
  const mid: string[] = []
  const big: string[] = []
  for (let i = 0; i <= lengthCm * 10; i++) {
    const x = r2(x0 + (i * ppc) / 10)
    if (i % 10 === 0) big.push(`M${x} ${rulerTop}v22`)
    else if (i % 5 === 0) mid.push(`M${x} ${rulerTop}v15`)
    else ticks.push(`M${x} ${rulerTop}v9`)
  }
  const labelSize = ppc >= 34 ? 18 : ppc >= 28 ? 16 : 14
  return {
    w: Math.ceil(right + PAD),
    h: Math.ceil(rulerTop + bodyH + PAD),
    el: (
      <g>
        <rect x={x0 - 18} y={rulerTop} width={r2(lengthCm * ppc + 36)} height={bodyH} rx={6} fill={WARN_50} stroke={INK} strokeWidth={SW} />
        <path d={ticks.join('')} stroke={INK} strokeWidth={ppc < 25 ? 0.9 : 1} strokeLinecap="butt" />
        <path d={mid.join('')} stroke={INK} strokeWidth={SW1} strokeLinecap="butt" />
        <path d={big.join('')} stroke={INK} strokeWidth={SW2} strokeLinecap="butt" />
        {Array.from({ length: lengthCm + 1 }, (_, i) => (
          <Txt key={i} x={xOf(i)} y={rulerTop + 36} size={labelSize}>{i}</Txt>
        ))}
        <Txt x={x0 - 8} y={rulerTop + 54} size={14} anchor="start" fill={MUTED}>cm</Txt>
        <path d={`M${r2(xa)} ${r2(rulerTop - gap + 2)}V${rulerTop}M${r2(xb)} ${r2(rulerTop - gap + 2)}V${rulerTop}`} stroke={MUTED} strokeWidth={SW1} strokeDasharray="3 3" strokeLinecap="butt" />
        <RulerObject icon={s.object} xa={xa} xb={xb} yb={rulerTop - gap} />
      </g>
    ),
  }
}
