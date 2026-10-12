import type { ReactNode } from 'react'
import { DIVIDER, INK, MATH, MATH_50, WHITE } from '../palette'
import { int, PAD, polyPath, r2, splitRows, type Drawn, type Spec } from './kit'

type P = [number, number]

/**
 * Balok berpetak dalam proyeksi miring: nx x ny kotak di muka depan, nz kotak ke belakang.
 * (x, y) adalah sudut kiri bawah muka depan.
 */
function Block({ x, y, nx, ny, nz, u, k }: { x: number; y: number; nx: number; ny: number; nz: number; u: number; k: number }): ReactNode {
  const W = nx * u
  const H = ny * u
  const D = nz * k
  const ftl: P = [x, y - H]
  const ftr: P = [x + W, y - H]
  const fbr: P = [x + W, y]
  const fbl: P = [x, y]
  const btl: P = [x + D, y - H - D]
  const btr: P = [x + W + D, y - H - D]
  const bbr: P = [x + W + D, y - D]
  const grid: string[] = []
  for (let i = 1; i < nx; i++) grid.push(`M${r2(x + i * u)} ${r2(y)}V${r2(y - H)}l${r2(D)} ${r2(-D)}`)
  for (let j = 1; j < ny; j++) grid.push(`M${r2(x)} ${r2(y - j * u)}H${r2(x + W)}l${r2(D)} ${r2(-D)}`)
  for (let d = 1; d < nz; d++) {
    grid.push(`M${r2(x + d * k)} ${r2(y - H - d * k)}H${r2(x + W + d * k)}V${r2(y - d * k)}`)
  }
  const sw = u >= 8 ? 2 : 1.5
  return (
    <g>
      <path d={polyPath([ftl, btl, btr, ftr])} fill={WHITE} />
      <path d={polyPath([ftr, btr, bbr, fbr])} fill={DIVIDER} />
      <path d={polyPath([fbl, ftl, ftr, fbr])} fill={MATH_50} />
      {grid.length > 0 && <path d={grid.join('')} fill="none" stroke={MATH} strokeWidth={1} strokeLinecap="butt" />}
      <path d={polyPath([fbl, ftl, btl, btr, bbr, fbr])} fill="none" stroke={INK} strokeWidth={sw} />
      <path d={`M${r2(ftl[0])} ${r2(ftl[1])}H${r2(ftr[0])}V${r2(fbr[1])}M${r2(ftr[0])} ${r2(ftr[1])}L${r2(btr[0])} ${r2(btr[1])}`} fill="none" stroke={INK} strokeWidth={sw} />
    </g>
  )
}

type Piece = { nx: number; ny: number; nz: number; deep: boolean }
const THOUSAND: Piece = { nx: 10, ny: 10, nz: 10, deep: true }
const HUNDRED: Piece = { nx: 10, ny: 10, nz: 1, deep: false }
const TEN: Piece = { nx: 1, ny: 10, nz: 1, deep: false }
const ONE: Piece = { nx: 1, ny: 1, nz: 1, deep: false }

type Group = { w: number; h: number; items: { x: number; y: number; p: Piece }[] }

function layoutGroups(t: number, h: number, te: number, o: number, u: number): Group[] {
  const k1 = u * 0.6
  const kd = u * 0.35
  const foot = (p: Piece): [number, number] => {
    const k = p.deep ? kd : k1
    return [p.nx * u + p.nz * k, p.ny * u + p.nz * k]
  }
  const grid = (count: number, p: Piece, perRow: number, gx: number, gy: number): Group => {
    const [fw, fh] = foot(p)
    const rows = splitRows(count, perRow)
    const maxPer = Math.max(...rows)
    const items: Group['items'] = []
    let idx = 0
    rows.forEach((inRow, r) => {
      for (let c = 0; c < inRow; c++, idx++) items.push({ x: c * (fw + gx), y: r * (fh + gy) + fh, p })
    })
    return { w: maxPer * fw + (maxPer - 1) * gx, h: rows.length * fh + (rows.length - 1) * gy, items }
  }
  const out: Group[] = []
  if (t > 0) out.push(grid(t, THOUSAND, t <= 3 ? t : t === 4 ? 2 : 3, 8, 8))
  if (h > 0) out.push(grid(h, HUNDRED, h <= 3 ? h : h === 4 ? 2 : 3, 7, 7))
  if (te > 0) out.push(grid(te, TEN, 10, 3, 8))
  if (o > 0) {
    // satuan: kolom berisi 5, dari bawah ke atas
    const [fw, fh] = foot(ONE)
    const cols = Math.ceil(o / 5)
    const items: Group['items'] = []
    for (let i = 0; i < o; i++) {
      const c = Math.floor(i / 5)
      const r = i % 5
      items.push({ x: c * (fw + 4), y: -r * (fh + 3), p: ONE })
    }
    const rows = Math.min(5, o)
    const gh = rows * fh + (rows - 1) * 3
    out.push({ w: cols * fw + (cols - 1) * 4, h: gh, items: items.map((it) => ({ ...it, y: it.y + gh })) })
  }
  return out
}

const MAX_ROW = 560 - PAD * 2

function rowWidth(groups: Group[], u: number): number {
  return groups.reduce((a, g) => a + g.w, 0) + Math.max(0, groups.length - 1) * u * 3
}

export function drawBasetens(s: Spec<'basetens'>): Drawn {
  const t = int(s.thousands ?? 0, 0, 9)
  const h = int(s.hundreds ?? 0, 0, 9)
  const te = int(s.tens ?? 0, 0, 19)
  const o = int(s.ones ?? 0, 0, 19)
  // satu baris (ribuan, ratusan, puluhan, satuan) bila muat; kalau tidak, ribuan dan ratusan di baris atas
  let u = 10
  let rows: Group[][] = []
  for (const cand of [10, 9, 8, 7]) {
    u = cand
    rows = [layoutGroups(t, h, te, o, u)]
    if (rowWidth(rows[0]!, u) <= MAX_ROW) break
  }
  if (rowWidth(rows[0]!, u) > MAX_ROW) {
    for (const cand of [10, 9, 8, 7, 6]) {
      u = cand
      rows = [layoutGroups(t, h, 0, 0, u), layoutGroups(0, 0, te, o, u)].filter((r) => r.length > 0)
      if (Math.max(...rows.map((r) => rowWidth(r, u))) <= MAX_ROW) break
    }
  }
  const k1 = u * 0.6
  const kd = u * 0.35
  const parts: ReactNode[] = []
  let y = PAD
  let maxW = 40
  rows.forEach((groups, ri) => {
    const gh = Math.max(20, ...groups.map((g) => g.h))
    const yB = y + gh
    let x = PAD
    groups.forEach((g, gi) => {
      const top = yB - g.h
      g.items.forEach((it, ii) => {
        parts.push(<Block key={`${ri}-${gi}-${ii}`} x={x + it.x} y={top + it.y} nx={it.p.nx} ny={it.p.ny} nz={it.p.nz} u={u} k={it.p.deep ? kd : k1} />)
      })
      x += g.w + u * 3
    })
    maxW = Math.max(maxW, rowWidth(groups, u))
    y = yB + u * 3
  })
  return { w: Math.ceil(maxW + PAD * 2), h: Math.ceil(y - u * 3 + PAD), el: <g>{parts}</g> }
}
