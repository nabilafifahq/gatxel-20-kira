import type { ReactNode } from 'react'
import { DIVIDER, ENGLISH, INK, STAR } from '../palette'
import type { Tone } from '../palette'
import { isShape2D, isSolid, rightAngleMark, shape2d, solidGeo, type Geo2D } from './geometry'
import {
  emptyBox, framed, grow, lightFill, PAD, r2, SW, SW2, textWidth, Txt, wrapText, type Drawn, type Spec,
} from './kit'

function shapeFill(tone: Tone | undefined): string {
  return tone === 'star' ? STAR : lightFill(tone)
}

/** Label sisi: kotak teks diletakkan di luar tepi, searah normal keluar. */
function sideLabel(g: Geo2D, i: number, text: string, size = 16): { x: number; y: number; w: number; h: number } | null {
  const e = g.edges[i]
  if (!e) return null
  const tw = textWidth(text, size, 600)
  const th = size * 0.8
  const off = 10 + Math.abs(e.nx) * (tw / 2) + Math.abs(e.ny) * (th / 2)
  return { x: e.mx + e.nx * off, y: e.my + e.ny * off, w: tw, h: th }
}

export function drawShape(s: Spec<'shape'>): Drawn {
  const g = shape2d(s.shape, 200, 170)
  const labels = (s.sideLabels ?? []).slice(0, 8)
  const box = emptyBox()
  grow(box, 0, 0)
  grow(box, g.w, g.h)
  const parts: ReactNode[] = []
  parts.push(<path key="body" d={g.d} fill={shapeFill(s.tone)} stroke={INK} strokeWidth={SW} />)
  if ((s.showRightAngles ?? false) && g.rightAngles.length) {
    parts.push(<path key="ra" d={g.rightAngles.map((i) => rightAngleMark(g, i, 16)).join('')} fill="none" stroke={INK} strokeWidth={SW2} />)
  }
  const sym = s.lineOfSymmetry ?? 'none'
  if (sym !== 'none') {
    const ext = 18
    const d = sym === 'vertical'
      ? `M${r2(g.w / 2)} ${r2(-ext)}L${r2(g.w / 2)} ${r2(g.h + ext)}`
      : `M${r2(-ext)} ${r2(g.h / 2)}L${r2(g.w + ext)} ${r2(g.h / 2)}`
    parts.push(<path key="sym" d={d} stroke={ENGLISH} strokeWidth={SW} strokeDasharray="9 7" strokeLinecap="butt" fill="none" />)
    if (sym === 'vertical') {
      grow(box, g.w / 2, -ext)
      grow(box, g.w / 2, g.h + ext)
    } else {
      grow(box, -ext, g.h / 2)
      grow(box, g.w + ext, g.h / 2)
    }
  }
  if (g.round === 'circle' && labels[0]) {
    // jari-jari dari pusat ke kanan, label di atasnya
    const r = g.w / 2
    parts.push(<line key="rad" x1={r2(r)} y1={r2(r)} x2={r2(2 * r)} y2={r2(r)} stroke={INK} strokeWidth={SW2} />)
    parts.push(<circle key="ctr" cx={r2(r)} cy={r2(r)} r={4} fill={INK} />)
    parts.push(<Txt key="rl" x={r * 1.5} y={r - 14} halo>{labels[0]}</Txt>)
  } else {
    labels.forEach((text, i) => {
      if (!text) return
      const p = sideLabel(g, i, text)
      if (!p) return
      parts.push(<Txt key={`l${i}`} x={p.x} y={p.y}>{text}</Txt>)
      grow(box, p.x - p.w / 2, p.y - p.h / 2)
      grow(box, p.x + p.w / 2, p.y + p.h / 2)
    })
  }
  return framed(box, <g>{parts}</g>, PAD + 4)
}

/** Satu bangun (datar atau ruang) yang muat di kotak `size`. */
export function shapeOrSolid(name: string, size: number, tone: Tone | undefined): { w: number; h: number; el: ReactNode } {
  if (isSolid(name)) {
    const g = solidGeo(name, size * 1.05, shapeFill(tone), DIVIDER)
    return g
  }
  if (isShape2D(name)) {
    const g = shape2d(name, size, name === 'rectangle' || name === 'oval' || name === 'semicircle' ? size * 0.7 : size)
    return { w: g.w, h: g.h, el: <path d={g.d} fill={shapeFill(tone)} stroke={INK} strokeWidth={SW} /> }
  }
  return { w: size, h: size, el: <rect width={size} height={size} rx={8} fill={DIVIDER} stroke={INK} strokeWidth={SW} /> }
}

export function drawShapes(s: Spec<'shapes'>): Drawn {
  const items = (s.items ?? []).slice(0, 8)
  const size = 96
  // lebar sel tetap; label panjang dibungkus, hanya kata tunggal yang panjang yang melebarkan sel
  const longestWord = Math.max(0, ...items.flatMap((it) => (it.label ?? '').split(/\s+/).map((w) => textWidth(w, 16, 600))))
  const cellW = Math.min(170, Math.max(116, longestWord + 14))
  const perRow = items.length <= 4 ? Math.max(1, items.length) : Math.ceil(items.length / 2)
  const rows = Math.ceil(items.length / perRow)
  const hasLabels = items.some((it) => it.label)
  const labelH = hasLabels ? 40 : 0
  const cellH = size + 16 + labelH
  const gap = 8
  const w = PAD * 2 + perRow * cellW + (perRow - 1) * gap
  const h = PAD * 2 + rows * cellH + (rows - 1) * gap
  const parts: ReactNode[] = items.map((it, i) => {
    const r = Math.floor(i / perRow)
    const inRow = Math.min(perRow, items.length - r * perRow)
    const rowW = inRow * cellW + (inRow - 1) * gap
    const c = i % perRow
    const x = (w - rowW) / 2 + c * (cellW + gap)
    const y = PAD + r * (cellH + gap)
    const g = shapeOrSolid(it.shape, size, it.tone)
    const ox = x + (cellW - g.w) / 2
    const oy = y + 8 + (size - g.h) / 2
    const lines = it.label ? wrapText(it.label, cellW - 8, 16, 600).slice(0, 2) : []
    return (
      <g key={i}>
        <g transform={`translate(${r2(ox)} ${r2(oy)})`}>{g.el}</g>
        {lines.map((line, li) => (
          <Txt key={li} x={x + cellW / 2} y={y + size + 30 + li * 20 - (lines.length - 1) * 10}>{line}</Txt>
        ))}
      </g>
    )
  })
  return { w, h, el: <g>{parts}</g> }
}

export function drawSolid(s: Spec<'solid'>): Drawn {
  const g = solidGeo(s.solid, 200, lightFill('math'))
  const labelH = s.label ? 36 : 0
  const w = Math.max(g.w, s.label ? textWidth(s.label, 16, 600) : 0) + PAD * 2 + 8
  const h = g.h + PAD * 2 + 8 + labelH
  return {
    w: Math.ceil(w),
    h: Math.ceil(h),
    el: (
      <g>
        <g transform={`translate(${r2((w - g.w) / 2)} ${PAD + 4})`}>{g.el}</g>
        {s.label && <Txt x={w / 2} y={PAD + 4 + g.h + 26}>{s.label}</Txt>}
      </g>
    ),
  }
}
