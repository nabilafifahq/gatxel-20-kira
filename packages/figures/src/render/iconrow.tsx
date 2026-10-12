import type { ReactNode } from 'react'
import { IconGlyph } from '../icons'
import { INK } from '../palette'
import { ArrowHead, emptyBox, framed, grow, Lines, PAD, r2, splitRows, SW, textWidth, wrapText, type Drawn, type Spec } from './kit'

export function drawIcons(s: Spec<'icons'>): Drawn {
  const items = (s.items ?? []).slice(0, 8)
  const arrows = s.arrows ?? 'none'
  if (arrows === 'cycle' && items.length >= 2) return drawCycle(s)
  const icon = 64
  const labelLines = items.map((it) => (it.label ? wrapText(it.label, 110, 16, 600).slice(0, 2) : []))
  const hasLabels = labelLines.some((l) => l.length > 0)
  const cellW = Math.max(icon + 8, ...labelLines.flat().map((l) => textWidth(l, 16, 600) + 8))
  const gap = arrows === 'chain' ? 52 : 22
  const rows = splitRows(items.length, items.length > 5 ? Math.ceil(items.length / 2) : 5)
  const perRow = Math.max(...rows)
  const labelH = hasLabels ? Math.max(...labelLines.map((l) => l.length)) * 20 + 10 : 0
  const rowH = icon + labelH
  const rowGap = arrows === 'chain' ? 46 : 22
  const w = PAD * 2 + perRow * cellW + (perRow - 1) * gap
  const h = PAD * 2 + rows.length * rowH + (rows.length - 1) * rowGap
  const parts: ReactNode[] = []
  const centres: [number, number][] = []
  let i = 0
  rows.forEach((count, ri) => {
    const rowW = count * cellW + (count - 1) * gap
    const left = (w - rowW) / 2
    for (let c = 0; c < count; c++, i++) {
      const cx = left + c * (cellW + gap) + cellW / 2
      const top = PAD + ri * (rowH + rowGap)
      centres.push([cx, top + icon / 2])
      const it = items[i]!
      parts.push(
        <g key={i}>
          <IconGlyph name={it.icon} x={r2(cx - icon / 2)} y={top} size={icon} />
          {labelLines[i]!.length > 0 && <Lines x={cx} y={top + icon + 10 + ((labelLines[i]!.length - 1) * 20) / 2 + 4} lines={labelLines[i]!} lineHeight={20} />}
        </g>,
      )
    }
  })
  if (arrows === 'chain') {
    let k = 0
    rows.forEach((count, ri) => {
      for (let c = 0; c < count; c++, k++) {
        if (k >= items.length - 1) break
        const [ax, ay] = centres[k]!
        const [bx, by] = centres[k + 1]!
        if (c < count - 1) {
          const x1 = ax + cellW / 2 - Math.max(0, (cellW - icon) / 2) + 8
          const x2 = bx - cellW / 2 + Math.max(0, (cellW - icon) / 2) - 8
          parts.push(
            <g key={`a${k}`}>
              <line x1={r2(x1)} y1={r2(ay)} x2={r2(x2 - 8)} y2={r2(ay)} stroke={INK} strokeWidth={SW} />
              <ArrowHead x={x2} y={ay} ang={0} />
            </g>,
          )
        } else {
          // sambung ke baris berikutnya: turun, ke kiri, lalu turun ke benda pertama baris berikutnya
          const yMid = PAD + ri * (rowH + rowGap) + rowH + rowGap / 2
          const yEnd = by - icon / 2 - 6
          parts.push(
            <g key={`a${k}`}>
              <path d={`M${r2(ax + icon / 2 + 6)} ${r2(ay)}H${r2(ax + icon / 2 + 18)}V${r2(yMid)}H${r2(bx)}V${r2(yEnd - 8)}`} fill="none" stroke={INK} strokeWidth={SW} />
              <ArrowHead x={bx} y={yEnd} ang={Math.PI / 2} />
            </g>,
          )
        }
      }
    })
  }
  return { w: Math.ceil(w + (arrows === 'chain' && rows.length > 1 ? 18 : 0)), h: Math.ceil(h), el: <g>{parts}</g> }
}

/** Daur: benda di lingkaran searah jarum jam mulai dari atas, panah lengkung di antara benda. */
function drawCycle(s: Spec<'icons'>): Drawn {
  const items = s.items.slice(0, 8)
  const n = items.length
  const icon = n <= 4 ? 60 : 52
  const R = n <= 2 ? 80 : n <= 3 ? 96 : n <= 4 ? 108 : n <= 6 ? 128 : 144
  const box = emptyBox()
  const parts: ReactNode[] = []
  const angOf = (i: number): number => (i / n) * Math.PI * 2
  const pos = (a: number, r: number): [number, number] => [r * Math.sin(a), -r * Math.cos(a)]
  const half = icon / 2 + 10
  const delta = Math.asin(Math.min(0.95, half / R))
  for (let i = 0; i < n; i++) {
    const a0 = angOf(i) + delta
    const a1 = angOf(i + 1) - delta
    if (a1 <= a0) continue
    const [x0, y0] = pos(a0, R)
    const [x1, y1] = pos(a1 - 6 / R, R)
    const [tx, ty] = pos(a1, R)
    const large = a1 - a0 > Math.PI ? 1 : 0
    for (let k = 0; k <= 8; k++) {
      const [px, py] = pos(a0 + ((a1 - a0) * k) / 8, R)
      grow(box, px, py, 4)
    }
    parts.push(
      <g key={`a${i}`}>
        <path d={`M${r2(x0)} ${r2(y0)}A${R} ${R} 0 ${large} 1 ${r2(x1)} ${r2(y1)}`} fill="none" stroke={INK} strokeWidth={SW} />
        <ArrowHead x={tx} y={ty} ang={a1} />
      </g>,
    )
  }
  items.forEach((it, i) => {
    const a = angOf(i)
    const [cx, cy] = pos(a, R)
    parts.push(<IconGlyph key={`i${i}`} name={it.icon} x={r2(cx - icon / 2)} y={r2(cy - icon / 2)} size={icon} />)
    grow(box, cx - icon / 2, cy - icon / 2)
    grow(box, cx + icon / 2, cy + icon / 2)
    if (it.label) {
      const lines = wrapText(it.label, 120, 16, 600).slice(0, 2)
      const lw = Math.max(...lines.map((l) => textWidth(l, 16, 600)))
      const lh = lines.length * 20
      const sx = Math.sin(a)
      const cyDir = -Math.cos(a)
      // label keluar dari lingkaran: atas, bawah, atau samping
      let lx = cx
      let ly = cy
      let anchor: 'start' | 'middle' | 'end' = 'middle'
      if (Math.abs(sx) < 0.35) {
        ly = cy + cyDir * (icon / 2 + 8 + lh / 2) + (cyDir > 0 ? 2 : -2)
      } else {
        lx = cx + Math.sign(sx) * (icon / 2 + 8)
        anchor = sx > 0 ? 'start' : 'end'
      }
      parts.push(<Lines key={`l${i}`} x={lx} y={ly} lines={lines} anchor={anchor} lineHeight={20} />)
      const lx0 = anchor === 'start' ? lx : anchor === 'end' ? lx - lw : lx - lw / 2
      grow(box, lx0, ly - lh / 2)
      grow(box, lx0 + lw, ly + lh / 2)
    }
  })
  return framed(box, <g>{parts}</g>)
}
