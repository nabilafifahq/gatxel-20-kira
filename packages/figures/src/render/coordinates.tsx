import type { ReactNode } from 'react'
import { DIVIDER, INK, MATH, MATH_50, MUTED, WHITE } from '../palette'
import { ArrowHead, fmt, int, PAD, polyPath, SW, SW1, Txt, type Drawn, type Spec } from './kit'

export function drawCoordinates(s: Spec<'coordinates'>): Drawn {
  const size = int(s.size, 4, 12)
  const four = s.quadrants === 4
  const lo = four ? -size : 0
  const cells = four ? size * 2 : size
  const cell = cells <= 6 ? 40 : cells <= 8 ? 34 : cells <= 12 ? 28 : cells <= 16 ? 24 : 20
  const every = cell >= 24 ? 1 : 2
  const gw = cells * cell
  const left = PAD + (four ? 12 : 30)
  const top = PAD + 26
  const xOf = (v: number): number => left + (v - lo) * cell
  const yOf = (v: number): number => top + gw - (v - lo) * cell
  const ox = xOf(0)
  const oy = yOf(0)
  const parts: ReactNode[] = []
  const pts = (s.points ?? [])
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= lo && p.x <= size && p.y >= lo && p.y <= size)
    .slice(0, 10)
  if ((s.polygon ?? false) && pts.length >= 3) {
    parts.push(<path key="pf" d={polyPath(pts.map((p) => [xOf(p.x), yOf(p.y)] as [number, number]))} fill={MATH_50} />)
  }
  const grid: string[] = []
  for (let i = 0; i <= cells; i++) {
    const v = lo + i
    if (v === 0) continue
    grid.push(`M${xOf(v)} ${top}V${top + gw}`)
    grid.push(`M${left} ${yOf(v)}H${left + gw}`)
  }
  parts.push(<path key="grid" d={grid.join('')} stroke={DIVIDER} strokeWidth={SW1} strokeLinecap="butt" fill="none" />)
  // sumbu dengan panah ke arah positif
  const ext = 20
  parts.push(<line key="xa" x1={four ? left - 8 : ox} y1={oy} x2={left + gw + ext - 6} y2={oy} stroke={INK} strokeWidth={SW} />)
  parts.push(<line key="ya" x1={ox} y1={four ? top + gw + 8 : oy} x2={ox} y2={top - ext + 6} stroke={INK} strokeWidth={SW} />)
  parts.push(<ArrowHead key="xh" x={left + gw + ext} y={oy} ang={0} len={11} half={6} />)
  parts.push(<ArrowHead key="yh" x={ox} y={top - ext} ang={-Math.PI / 2} len={11} half={6} />)
  parts.push(<Txt key="xl" x={left + gw + ext + 4} y={oy + 16} size={16} weight={700} anchor="start">x</Txt>)
  parts.push(<Txt key="yl" x={ox - 10} y={top - ext - 2} size={16} weight={700} anchor="end">y</Txt>)
  // angka sumbu
  for (let i = 0; i <= cells; i++) {
    const v = lo + i
    if (v % every !== 0) continue
    if (v === 0) {
      // di empat kuadran titik asal sudah jelas; angka 0 akan bertabrakan dengan -1
      if (!four) parts.push(<Txt key="o" x={ox - 9} y={oy + 15} size={14} fill={MUTED} anchor="end">0</Txt>)
      continue
    }
    parts.push(<line key={`tx${v}`} x1={xOf(v)} y1={oy - 4} x2={xOf(v)} y2={oy + 4} stroke={INK} strokeWidth={SW1} />)
    parts.push(<line key={`ty${v}`} x1={ox - 4} y1={yOf(v)} x2={ox + 4} y2={yOf(v)} stroke={INK} strokeWidth={SW1} />)
    parts.push(<Txt key={`nx${v}`} x={xOf(v)} y={oy + 16} size={14} fill={MUTED} halo={four}>{fmt(v)}</Txt>)
    parts.push(<Txt key={`ny${v}`} x={ox - 9} y={yOf(v)} size={14} fill={MUTED} anchor="end" halo={four}>{fmt(v)}</Txt>)
  }
  if ((s.polygon ?? false) && pts.length >= 2) {
    parts.push(<path key="po" d={polyPath(pts.map((p) => [xOf(p.x), yOf(p.y)] as [number, number]), pts.length >= 3)} fill="none" stroke={MATH} strokeWidth={SW} />)
  }
  pts.forEach((p, i) => {
    const x = xOf(p.x)
    const y = yOf(p.y)
    parts.push(<circle key={`p${i}`} cx={x} cy={y} r={5.5} fill={MATH} stroke={WHITE} strokeWidth={1.5} />)
    if (p.label) {
      // label menjauh dari sumbu: ke kanan atas di kuadran pertama, ke arah luar di kuadran lain
      let rightSide = four ? p.x >= 0 : true
      let upSide = four ? p.y >= 0 : true
      if (p.x >= size - 0.5) rightSide = false
      if (p.y >= size - 0.5) upSide = false
      if (four && p.x <= -size + 0.5) rightSide = true
      if (four && p.y <= -size + 0.5) upSide = true
      parts.push(
        <Txt key={`pl${i}`} x={x + (rightSide ? 10 : -10)} y={y + (upSide ? -13 : 14)} size={17} weight={700} anchor={rightSide ? 'start' : 'end'} halo>
          {p.label}
        </Txt>,
      )
    }
  })
  return { w: Math.ceil(left + gw + ext + 18 + PAD), h: Math.ceil(top + gw + (four ? 14 : 30) + PAD), el: <g>{parts}</g> }
}
