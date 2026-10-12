import type { ReactElement, ReactNode } from 'react'
import { SHAPES_2D, SOLIDS } from '../spec'
import { DIVIDER, INK, WHITE } from '../palette'
import { polyPath, r2, SW, SW2 } from './kit'

export type Shape2D = (typeof SHAPES_2D)[number]
export type SolidName = (typeof SOLIDS)[number]
type Pt = [number, number]

/** Tepi untuk label: titik tengah dan normal keluar (satuan). */
export type Edge = { mx: number; my: number; nx: number; ny: number }

/**
 * Geometri bangun datar dalam kotak [0, w] x [0, h]. Urutan tepi untuk label:
 * mulai dari tepi bawah, lalu berlawanan arah jarum jam di layar (kanan, atas, kiri).
 */
export type Geo2D = {
  d: string
  w: number
  h: number
  verts: Pt[]
  edges: Edge[]
  rightAngles: number[]
  round: 'none' | 'circle' | 'semicircle' | 'oval'
}

export function isSolid(name: string): name is SolidName {
  return (SOLIDS as readonly string[]).includes(name)
}

export function isShape2D(name: string): name is Shape2D {
  return (SHAPES_2D as readonly string[]).includes(name)
}

function regular(n: number, startDeg: number, r = 100): Pt[] {
  return Array.from({ length: n }, (_, k) => {
    const a = ((startDeg + (360 / n) * k) * Math.PI) / 180
    return [r * Math.cos(a), r * Math.sin(a)] as Pt
  })
}

function star(points = 5, outer = 100, inner = 40): Pt[] {
  return Array.from({ length: points * 2 }, (_, k) => {
    const a = ((-90 + (180 / points) * k) * Math.PI) / 180
    const r = k % 2 === 0 ? outer : inner
    return [r * Math.cos(a), r * Math.sin(a)] as Pt
  })
}

/** Titik sudut nominal (y ke bawah) untuk bangun bersisi lurus. */
function nominal(name: Shape2D): Pt[] | null {
  switch (name) {
    case 'square': return [[0, 0], [160, 0], [160, 160], [0, 160]]
    case 'rectangle': return [[0, 0], [220, 0], [220, 128], [0, 128]]
    case 'triangle': return [[0, 173.2], [200, 173.2], [100, 0]]
    case 'right-triangle': return [[0, 150], [190, 150], [0, 0]]
    case 'pentagon': return regular(5, -90)
    case 'hexagon': return regular(6, 0)
    case 'octagon': return regular(8, 22.5)
    case 'rhombus': return [[-100, 0], [0, 72], [100, 0], [0, -72]]
    case 'trapezium': return [[-110, 60], [110, 60], [58, -60], [-58, -60]]
    case 'parallelogram': return [[-110, 60], [66, 60], [110, -60], [-66, -60]]
    case 'kite': return [[0, -88], [66, -32], [0, 112], [-66, -32]]
    case 'star': return star()
    default: return null
  }
}

/** Urutkan ulang poligon: mulai dari ujung kiri tepi bawah, lalu menuju ujung kanannya. */
function fromBottom(pts: Pt[]): Pt[] {
  const n = pts.length
  let best = 0
  let bestY = -Infinity
  let bestX = Infinity
  for (let i = 0; i < n; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % n]!
    const my = (a[1] + b[1]) / 2
    const mx = (a[0] + b[0]) / 2
    if (my > bestY + 0.5 || (Math.abs(my - bestY) <= 0.5 && mx < bestX)) {
      best = i
      bestY = my
      bestX = mx
    }
  }
  const a = pts[best]!
  const b = pts[(best + 1) % n]!
  const out: Pt[] = []
  if (a[0] <= b[0]) {
    for (let k = 0; k < n; k++) out.push(pts[(best + k) % n]!)
  } else {
    for (let k = 0; k < n; k++) out.push(pts[(best + 1 - k + n * 2) % n]!)
  }
  return out
}

function fit(pts: Pt[], size: number, maxH = size): { pts: Pt[]; w: number; h: number } {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  const bw = Math.max(...xs) - x0
  const bh = Math.max(...ys) - y0
  const k = Math.min(size / bw, maxH / bh)
  return { pts: pts.map(([x, y]) => [(x - x0) * k, (y - y0) * k] as Pt), w: bw * k, h: bh * k }
}

/** Geometri bangun datar yang muat di kotak size x maxH. */
export function shape2d(name: Shape2D, size: number, maxH = size): Geo2D {
  const poly = nominal(name)
  if (poly) {
    const { pts, w, h } = fit(fromBottom(poly), size, maxH)
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
    const edges: Edge[] = pts.map((a, i) => {
      const b = pts[(i + 1) % pts.length]!
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const len = Math.hypot(dx, dy) || 1
      let nx = -dy / len
      let ny = dx / len
      const mx = (a[0] + b[0]) / 2
      const my = (a[1] + b[1]) / 2
      if ((mx - cx) * nx + (my - cy) * ny < 0) {
        nx = -nx
        ny = -ny
      }
      return { mx, my, nx, ny }
    })
    const rightAngles: number[] = []
    pts.forEach((v, i) => {
      const p = pts[(i - 1 + pts.length) % pts.length]!
      const q = pts[(i + 1) % pts.length]!
      const ux = p[0] - v[0]
      const uy = p[1] - v[1]
      const wx = q[0] - v[0]
      const wy = q[1] - v[1]
      const cos = (ux * wx + uy * wy) / ((Math.hypot(ux, uy) || 1) * (Math.hypot(wx, wy) || 1))
      if (Math.abs(cos) < 0.01) rightAngles.push(i)
    })
    return { d: polyPath(pts), w, h, verts: pts, edges, rightAngles, round: 'none' }
  }
  if (name === 'circle') {
    const r = Math.min(size, maxH) / 2
    return {
      d: `M0 ${r2(r)}A${r2(r)} ${r2(r)} 0 1 1 ${r2(2 * r)} ${r2(r)}A${r2(r)} ${r2(r)} 0 1 1 0 ${r2(r)}Z`,
      w: 2 * r, h: 2 * r, verts: [], rightAngles: [], round: 'circle',
      edges: [{ mx: 2 * r, my: r, nx: 1, ny: 0 }],
    }
  }
  if (name === 'semicircle') {
    const r = Math.min(size / 2, maxH)
    return {
      d: `M0 ${r2(r)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(2 * r)} ${r2(r)}Z`,
      w: 2 * r, h: r, verts: [[0, r], [2 * r, r]], rightAngles: [], round: 'semicircle',
      edges: [{ mx: r, my: r, nx: 0, ny: 1 }, { mx: r, my: 0, nx: 0, ny: -1 }],
    }
  }
  // oval
  const rx = Math.min(size / 2, (maxH / 2) * 1.6)
  const ry = rx / 1.6
  return {
    d: `M0 ${r2(ry)}A${r2(rx)} ${r2(ry)} 0 1 1 ${r2(2 * rx)} ${r2(ry)}A${r2(rx)} ${r2(ry)} 0 1 1 0 ${r2(ry)}Z`,
    w: 2 * rx, h: 2 * ry, verts: [], rightAngles: [], round: 'oval',
    edges: [{ mx: rx, my: 2 * ry, nx: 0, ny: 1 }, { mx: 2 * rx, my: ry, nx: 1, ny: 0 }],
  }
}

/** Tanda sudut siku di titik sudut i. */
export function rightAngleMark(g: Geo2D, i: number, s = 14): string {
  const n = g.verts.length
  const v = g.verts[i]!
  const p = g.verts[(i - 1 + n) % n]!
  const q = g.verts[(i + 1) % n]!
  const ul = Math.hypot(p[0] - v[0], p[1] - v[1]) || 1
  const wl = Math.hypot(q[0] - v[0], q[1] - v[1]) || 1
  const ux = ((p[0] - v[0]) / ul) * s
  const uy = ((p[1] - v[1]) / ul) * s
  const wx = ((q[0] - v[0]) / wl) * s
  const wy = ((q[1] - v[1]) / wl) * s
  return `M${r2(v[0] + ux)} ${r2(v[1] + uy)}L${r2(v[0] + ux + wx)} ${r2(v[1] + uy + wy)}L${r2(v[0] + wx)} ${r2(v[1] + wy)}`
}

/** Bangun ruang dalam proyeksi miring sederhana, rusuk tersembunyi putus-putus. */
export type SolidGeo = { w: number; h: number; el: ReactNode }

const hiddenProps = {
  fill: 'none', stroke: INK, strokeWidth: 1.75, strokeDasharray: '6 5', strokeLinecap: 'butt' as const,
}

function lines(segs: [Pt, Pt][]): string {
  return segs.map(([a, b]) => `M${r2(a[0])} ${r2(a[1])}L${r2(b[0])} ${r2(b[1])}`).join('')
}

export function solidGeo(name: SolidName, s: number, front: string, side = DIVIDER, top = WHITE): SolidGeo {
  const sw = s >= 140 ? SW : SW2
  const vis = { fill: 'none', stroke: INK, strokeWidth: sw }
  const face = (pts: Pt[], fill: string, key: string): ReactElement => (
    <path key={key} d={polyPath(pts)} fill={fill} stroke="none" />
  )
  switch (name) {
    case 'cube':
    case 'cuboid': {
      const aw = name === 'cube' ? s * 0.64 : s * 0.8
      const ah = name === 'cube' ? aw : s * 0.46
      const dx = name === 'cube' ? aw * 0.42 : s * 0.24
      const dy = name === 'cube' ? aw * 0.32 : s * 0.18
      const FTL: Pt = [0, dy], FTR: Pt = [aw, dy], FBR: Pt = [aw, dy + ah], FBL: Pt = [0, dy + ah]
      const BTL: Pt = [dx, 0], BTR: Pt = [aw + dx, 0], BBR: Pt = [aw + dx, ah], BBL: Pt = [dx, ah]
      return {
        w: aw + dx,
        h: ah + dy,
        el: (
          <g>
            {face([FTL, BTL, BTR, FTR], top, 't')}
            {face([FTR, BTR, BBR, FBR], side, 'r')}
            {face([FTL, FTR, FBR, FBL], front, 'f')}
            <path d={lines([[BBL, BTL], [BBL, BBR], [BBL, FBL]])} {...hiddenProps} />
            <path d={polyPath([FTL, FTR, FBR, FBL])} {...vis} />
            <path d={lines([[FTL, BTL], [BTL, BTR], [BTR, FTR], [BTR, BBR], [BBR, FBR]])} {...vis} />
          </g>
        ),
      }
    }
    case 'square-pyramid': {
      const b = s * 0.74
      const dx = s * 0.28
      const dy = s * 0.16
      const hp = s * 0.62
      const H = hp + dy / 2
      const FL: Pt = [0, H], FR: Pt = [b, H], BR: Pt = [b + dx, H - dy], BL: Pt = [dx, H - dy]
      const A: Pt = [(b + dx) / 2, 0]
      return {
        w: b + dx,
        h: H,
        el: (
          <g>
            {face([FR, BR, A], side, 'r')}
            {face([FL, FR, A], front, 'f')}
            <path d={lines([[FL, BL], [BL, BR], [BL, A]])} {...hiddenProps} />
            <path d={lines([[FL, FR], [FR, BR], [FL, A], [FR, A], [BR, A]])} {...vis} />
          </g>
        ),
      }
    }
    case 'triangular-prism': {
      const b = s * 0.58
      const ht = s * 0.5
      const dx = s * 0.36
      const dy = s * 0.24
      const H = ht + dy
      const FL: Pt = [0, H], FR: Pt = [b, H], FT: Pt = [b / 2, H - ht]
      const BL: Pt = [dx, H - dy], BR: Pt = [b + dx, H - dy], BT: Pt = [b / 2 + dx, H - ht - dy]
      return {
        w: b + dx,
        h: H,
        el: (
          <g>
            {face([FR, FT, BT, BR], side, 'r')}
            {face([FL, FR, FT], front, 'f')}
            <path d={lines([[FL, BL], [BL, BR], [BL, BT]])} {...hiddenProps} />
            <path d={polyPath([FL, FR, FT])} {...vis} />
            <path d={lines([[FT, BT], [BT, BR], [FR, BR]])} {...vis} />
          </g>
        ),
      }
    }
    case 'cylinder': {
      const rx = s * 0.36
      const ry = rx * 0.32
      const hc = s * 0.62
      const yb = ry + hc
      return {
        w: 2 * rx,
        h: hc + 2 * ry,
        el: (
          <g>
            <path d={`M0 ${r2(ry)}L0 ${r2(yb)}A${r2(rx)} ${r2(ry)} 0 0 0 ${r2(2 * rx)} ${r2(yb)}L${r2(2 * rx)} ${r2(ry)}Z`} fill={front} />
            <ellipse cx={r2(rx)} cy={r2(ry)} rx={r2(rx)} ry={r2(ry)} fill={top} {...{ stroke: INK, strokeWidth: sw }} />
            <path d={`M${r2(2 * rx)} ${r2(yb)}A${r2(rx)} ${r2(ry)} 0 0 0 0 ${r2(yb)}`} {...hiddenProps} />
            <path d={`M0 ${r2(ry)}L0 ${r2(yb)}A${r2(rx)} ${r2(ry)} 0 0 0 ${r2(2 * rx)} ${r2(yb)}L${r2(2 * rx)} ${r2(ry)}`} {...vis} />
          </g>
        ),
      }
    }
    case 'cone': {
      const rx = s * 0.4
      const ry = rx * 0.32
      const hc = s * 0.7
      const yt = hc - (ry * ry) / hc
      const xt = rx * Math.sqrt(Math.max(0, 1 - (ry * ry) / (hc * hc)))
      const L: Pt = [rx - xt, yt]
      const R: Pt = [rx + xt, yt]
      const arcFront = `A${r2(rx)} ${r2(ry)} 0 1 0 ${r2(R[0])} ${r2(R[1])}`
      return {
        w: 2 * rx,
        h: hc + ry,
        el: (
          <g>
            <path d={`M${r2(rx)} 0L${r2(L[0])} ${r2(L[1])}${arcFront}Z`} fill={front} />
            <path d={`M${r2(R[0])} ${r2(R[1])}A${r2(rx)} ${r2(ry)} 0 0 0 ${r2(L[0])} ${r2(L[1])}`} {...hiddenProps} />
            <path d={`M${r2(rx)} 0L${r2(L[0])} ${r2(L[1])}${arcFront}Z`} {...vis} />
          </g>
        ),
      }
    }
    default: {
      // sphere
      const r = s * 0.45
      const ry = r * 0.3
      return {
        w: 2 * r,
        h: 2 * r,
        el: (
          <g>
            <circle cx={r2(r)} cy={r2(r)} r={r2(r)} fill={front} />
            <path d={`M${r2(2 * r)} ${r2(r)}A${r2(r)} ${r2(ry)} 0 0 0 0 ${r2(r)}`} {...hiddenProps} />
            <path d={`M0 ${r2(r)}A${r2(r)} ${r2(ry)} 0 0 0 ${r2(2 * r)} ${r2(r)}`} fill="none" stroke={INK} strokeWidth={SW2} />
            <circle cx={r2(r)} cy={r2(r)} r={r2(r)} {...vis} />
          </g>
        ),
      }
    }
  }
}
