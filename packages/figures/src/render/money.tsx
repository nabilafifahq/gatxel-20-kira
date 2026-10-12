import type { ReactNode } from 'react'
import {
  BORDER, DIVIDER, ENGLISH, ENGLISH_50, INK, MATH, MATH_50, MUTED, SCIENCE, SCIENCE_50, STAR, WARN, WARN_50,
} from '../palette'
import { int, PAD, r2, rupiah, SW, SW1, textWidth, Txt, type Drawn, type Spec } from './kit'

const NOTE_W = 152
const NOTE_H = 74

/** Warna uang kertas sederhana per nilai (bukan tiruan desain uang asli). */
const NOTE_TONE: Record<number, { fill: string; line: string }> = {
  2000: { fill: DIVIDER, line: MUTED },
  5000: { fill: WARN_50, line: WARN },
  10000: { fill: STAR, line: INK },
  20000: { fill: SCIENCE_50, line: SCIENCE },
  50000: { fill: MATH_50, line: MATH },
  100000: { fill: ENGLISH_50, line: ENGLISH },
}

const COIN_R: Record<number, number> = { 100: 28, 200: 30, 500: 32, 1000: 35 }

function Note({ x, y, value }: { x: number; y: number; value: number }): ReactNode {
  const tone = NOTE_TONE[value] ?? { fill: DIVIDER, line: MUTED }
  const label = rupiah(value)
  const size = Math.min(22, Math.floor((22 * (NOTE_W - 30)) / textWidth(label, 22, 700)))
  return (
    <g>
      <rect x={r2(x)} y={r2(y)} width={NOTE_W} height={NOTE_H} rx={8} fill={tone.fill} stroke={INK} strokeWidth={SW} />
      <rect x={r2(x + 7)} y={r2(y + 7)} width={NOTE_W - 14} height={NOTE_H - 14} rx={4} fill="none" stroke={tone.line} strokeWidth={SW1} />
      <Txt x={x + NOTE_W / 2} y={y + NOTE_H / 2} size={size} weight={700}>{label}</Txt>
    </g>
  )
}

function Coin({ cx, cy, value }: { cx: number; cy: number; value: number }): ReactNode {
  const r = COIN_R[value] ?? 30
  const fill = value >= 500 ? STAR : DIVIDER
  const num = rupiah(value).slice(2)
  return (
    <g>
      <circle cx={r2(cx)} cy={r2(cy)} r={r} fill={fill} stroke={INK} strokeWidth={SW} />
      <circle cx={r2(cx)} cy={r2(cy)} r={r - 5} fill="none" stroke={value >= 500 ? INK : BORDER} strokeWidth={SW1} />
      <Txt x={cx} y={cy - 10} size={13} weight={700}>Rp</Txt>
      <Txt x={cx} y={cy + 8} size={value >= 1000 ? 16 : 17} weight={800}>{num}</Txt>
    </g>
  )
}

export function drawMoney(s: Spec<'money'>): Drawn {
  const units: { value: number; note: boolean; item: number }[] = []
  ;(s.items ?? []).slice(0, 6).forEach((it, i) => {
    const n = int(it.count, 1, 10)
    for (let k = 0; k < n; k++) units.push({ value: it.value, note: it.value >= 2000, item: i })
  })
  const maxW = 520
  type Row = { units: { value: number; note: boolean; x: number; w: number }[]; h: number }
  const rows: Row[] = []
  let row: Row = { units: [], h: 0 }
  let x = 0
  let prev: { note: boolean; item: number } | null = null
  const unitW = (u: { value: number; note: boolean }): number => (u.note ? NOTE_W : (COIN_R[u.value] ?? 30) * 2)
  for (const u of units) {
    const w = unitW(u)
    const gap = prev === null ? 0 : prev.item !== u.item ? 22 : u.note ? 10 : 8
    const switchKind = prev !== null && prev.note !== u.note
    // satu jenis uang tidak dipecah ke dua baris bila masih muat utuh di baris baru
    const startsItem = prev === null || prev.item !== u.item
    const same = units.filter((v) => v.item === u.item)
    const itemW = same.reduce((a, v) => a + unitW(v), 0) + (same.length - 1) * (u.note ? 10 : 8)
    const itemBreak = startsItem && x + gap + itemW > maxW && itemW <= maxW
    if (row.units.length > 0 && (switchKind || itemBreak || x + gap + w > maxW)) {
      rows.push(row)
      row = { units: [], h: 0 }
      x = 0
    }
    const g = row.units.length === 0 ? 0 : gap
    row.units.push({ value: u.value, note: u.note, x: x + g, w })
    row.h = Math.max(row.h, u.note ? NOTE_H : w)
    x += g + w
    prev = u
  }
  if (row.units.length) rows.push(row)
  const width = Math.max(...rows.map((r) => r.units.reduce((m, u) => Math.max(m, u.x + u.w), 0)), 40)
  const parts: ReactNode[] = []
  let y = PAD
  rows.forEach((r, ri) => {
    r.units.forEach((u, ui) => {
      if (u.note) parts.push(<Note key={`${ri}-${ui}`} x={PAD + u.x} y={y + (r.h - NOTE_H) / 2} value={u.value} />)
      else parts.push(<Coin key={`${ri}-${ui}`} cx={PAD + u.x + u.w / 2} cy={y + r.h / 2} value={u.value} />)
    })
    y += r.h + 14
  })
  return { w: Math.ceil(width + PAD * 2), h: Math.ceil(y - 14 + PAD), el: <g>{parts}</g> }
}
