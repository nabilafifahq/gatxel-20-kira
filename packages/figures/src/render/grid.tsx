import type { ReactNode } from 'react'
import { INK, MUTED, WHITE } from '../palette'
import { int, isBlank, MissingBox, PAD, r2, strongFill, SW, SW1, Txt, type Drawn, type Spec } from './kit'

export function drawGrid(s: Spec<'grid'>): Drawn {
  const rows = int(s.rows, 1, 12)
  const cols = int(s.cols, 1, 12)
  const m = Math.max(rows, cols)
  const cell = m <= 6 ? 40 : m <= 9 ? 34 : 30
  const units = s.showUnits ?? false
  const ox = PAD + (units ? 26 : 0)
  const oy = PAD + (units ? 26 : 0)
  const gw = cols * cell
  const gh = rows * cell
  const fill = strongFill(s.tone)
  const seen = new Set<string>()
  const shaded: ReactNode[] = []
  for (const pair of s.shaded ?? []) {
    const [r, c] = pair
    if (r === undefined || c === undefined || r < 0 || c < 0 || r >= rows || c >= cols) continue
    const k = `${r}-${c}`
    if (seen.has(k)) continue
    seen.add(k)
    shaded.push(<rect key={k} x={ox + c * cell} y={oy + r * cell} width={cell} height={cell} fill={fill} />)
  }
  const lines: string[] = []
  for (let c = 1; c < cols; c++) lines.push(`M${ox + c * cell} ${oy}V${oy + gh}`)
  for (let r = 1; r < rows; r++) lines.push(`M${ox} ${oy + r * cell}H${ox + gw}`)
  const marks: ReactNode[] = []
  if (units) {
    for (let c = 0; c < cols; c++) {
      marks.push(<Txt key={`c${c}`} x={ox + c * cell + cell / 2} y={oy - 14} size={14} fill={MUTED}>{c + 1}</Txt>)
    }
    for (let r = 0; r < rows; r++) {
      marks.push(<Txt key={`r${r}`} x={ox - 12} y={oy + r * cell + cell / 2} size={14} fill={MUTED} anchor="end">{r + 1}</Txt>)
    }
  }
  return {
    w: ox + gw + PAD,
    h: oy + gh + PAD,
    el: (
      <g>
        <rect x={ox} y={oy} width={gw} height={gh} fill={WHITE} />
        {shaded}
        <path d={lines.join('')} stroke={INK} strokeWidth={SW1} fill="none" strokeLinecap="butt" />
        <rect x={ox} y={oy} width={gw} height={gh} fill="none" stroke={INK} strokeWidth={SW} />
        {marks}
      </g>
    ),
  }
}

export function drawFraction(s: Spec<'fraction'>): Drawn {
  const parts = int(s.parts, 1, 16)
  const shaded = int(s.shaded, 0, parts)
  const fill = strongFill('math')
  const label = s.label
  const frac = label ? /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(label) : null
  const labelH = label ? (frac ? 64 : isBlank(label) ? 44 : 36) : 0
  const pieces: ReactNode[] = []
  let w: number
  let fh: number
  if (s.shape === 'circle') {
    const R = 92
    const cx = PAD + R + 4
    const cy = PAD + R + 4
    w = (R + 4) * 2 + PAD * 2
    fh = (R + 4) * 2
    const at = (k: number): [number, number] => {
      const a = (k / parts) * Math.PI * 2
      return [cx + R * Math.sin(a), cy - R * Math.cos(a)]
    }
    if (parts === 1) {
      pieces.push(<circle key="c" cx={cx} cy={cy} r={R} fill={shaded ? fill : WHITE} />)
    } else {
      for (let k = 0; k < parts; k++) {
        const [x1, y1] = at(k)
        const [x2, y2] = at(k + 1)
        const large = 1 / parts > 0.5 ? 1 : 0
        pieces.push(
          <path key={k} d={`M${cx} ${cy}L${r2(x1)} ${r2(y1)}A${R} ${R} 0 ${large} 1 ${r2(x2)} ${r2(y2)}Z`} fill={k < shaded ? fill : WHITE} stroke={INK} strokeWidth={2} />,
        )
      }
    }
    pieces.push(<circle key="o" cx={cx} cy={cy} r={R} fill="none" stroke={INK} strokeWidth={SW} />)
  } else if (s.shape === 'square') {
    const side = 184
    // susun kotak sedekat mungkin ke persegi: baris x kolom
    let rows = 1
    for (let d = Math.floor(Math.sqrt(parts)); d >= 1; d--) {
      if (parts % d === 0) {
        rows = d
        break
      }
    }
    const cols = parts / rows
    const x0 = PAD + 4
    const y0 = PAD + 4
    w = side + 8 + PAD * 2
    fh = side + 8
    for (let k = 0; k < parts; k++) {
      const r = Math.floor(k / cols)
      const c = k % cols
      pieces.push(
        <rect key={k} x={r2(x0 + (c * side) / cols)} y={r2(y0 + (r * side) / rows)} width={r2(side / cols)} height={r2(side / rows)} fill={k < shaded ? fill : WHITE} stroke={INK} strokeWidth={2} />,
      )
    }
    pieces.push(<rect key="o" x={x0} y={y0} width={side} height={side} fill="none" stroke={INK} strokeWidth={SW} />)
  } else {
    const bw = parts <= 4 ? 300 : parts <= 10 ? 360 : 420
    const bh = 60
    const x0 = PAD + 4
    const y0 = PAD + 4
    w = bw + 8 + PAD * 2
    fh = bh + 8
    for (let k = 0; k < parts; k++) {
      pieces.push(<rect key={k} x={r2(x0 + (k * bw) / parts)} y={y0} width={r2(bw / parts)} height={bh} fill={k < shaded ? fill : WHITE} stroke={INK} strokeWidth={2} />)
    }
    pieces.push(<rect key="o" x={x0} y={y0} width={bw} height={bh} fill="none" stroke={INK} strokeWidth={SW} />)
  }
  const ly = PAD + fh + 14
  let labelEl: ReactNode = null
  if (label && frac) {
    const cx = w / 2
    const num = frac[1]!
    const den = frac[2]!
    const bar = Math.max(num.length, den.length) * 13 + 10
    labelEl = (
      <g>
        <Txt x={cx} y={ly + 13} size={22} weight={700}>{num}</Txt>
        <line x1={r2(cx - bar / 2)} y1={ly + 30} x2={r2(cx + bar / 2)} y2={ly + 30} stroke={INK} strokeWidth={SW} />
        <Txt x={cx} y={ly + 47} size={22} weight={700}>{den}</Txt>
      </g>
    )
  } else if (label && isBlank(label)) {
    labelEl = <MissingBox cx={w / 2} cy={ly + 18} w={40} h={36} size={20} />
  } else if (label) {
    labelEl = <Txt x={w / 2} y={ly + 14} size={18} weight={700}>{label}</Txt>
  }
  return { w, h: PAD * 2 + fh + labelH, el: <g>{pieces}{labelEl}</g> }
}
