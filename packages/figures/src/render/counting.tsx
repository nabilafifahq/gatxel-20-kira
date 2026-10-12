import type { ReactElement, ReactNode } from 'react'
import { IconGlyph } from '../icons'
import type { IconName } from '../spec'
import { BG, BORDER, INK, MATH, MATH_50, WARN, WARN_50, WHITE } from '../palette'
import { int, PAD, r2, splitRows, SW, SW2, type Drawn, type Spec } from './kit'

/** Penanda sorotan: pita biru muda bergaris biru (garis tetap terlihat saat dicetak). */
function Highlight({ x, y, w, h, rx = 12 }: { x: number; y: number; w: number; h: number; rx?: number }): ReactElement {
  return <rect x={r2(x)} y={r2(y)} width={r2(w)} height={r2(h)} rx={rx} fill={MATH_50} stroke={MATH} strokeWidth={SW2} />
}

export function drawArray(s: Spec<'array'>): Drawn {
  const rows = int(s.rows, 1, 12)
  const cols = int(s.cols, 1, 12)
  const m = Math.max(rows, cols)
  const cell = m <= 5 ? 50 : m <= 8 ? 42 : 34
  const icon = cell - 8
  const hl = int(s.highlightRows ?? 0, 0, rows)
  const pad = PAD + 6
  const w = cols * cell + pad * 2
  const h = rows * cell + pad * 2
  const icons: ReactNode[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      icons.push(<IconGlyph key={`${r}-${c}`} name={s.icon} x={pad + c * cell + 4} y={pad + r * cell + 4} size={icon} />)
    }
  }
  return {
    w,
    h,
    el: (
      <g>
        {hl > 0 && <Highlight x={pad - 6} y={pad - 6} w={cols * cell + 12} h={hl * cell + 12} />}
        {icons}
      </g>
    ),
  }
}

/**
 * Susunan benda dalam satu kelompok: pola dadu untuk jumlah kecil supaya mudah
 * dikenali tanpa menghitung, lalu baris berisi 5.
 */
const ROW_PATTERNS: Record<number, number[]> = {
  1: [1], 2: [2], 3: [1, 2], 4: [2, 2], 5: [2, 1, 2], 6: [3, 3], 7: [4, 3], 8: [4, 4], 9: [3, 3, 3], 10: [5, 5],
}

function rowPattern(n: number): number[] {
  if (n <= 0) return []
  const p = ROW_PATTERNS[n]
  if (p) return p
  const rows: number[] = []
  let left = n
  while (left > 0) {
    rows.push(Math.min(5, left))
    left -= 5
  }
  return rows
}

/** Wadah lebar (keranjang, kotak): satu baris sampai 5 benda, lalu baris berisi paling banyak 5. */
function wideRows(n: number): number[] {
  if (n <= 0) return []
  return splitRows(n, 5)
}

/** Posisi pusat benda relatif terhadap pusat kelompok. */
function groupPositions(n: number, step: number, wide = false): [number, number][] {
  const rows = wide ? wideRows(n) : rowPattern(n)
  const out: [number, number][] = []
  const top = -((rows.length - 1) * step) / 2
  rows.forEach((count, ri) => {
    const left = -((count - 1) * step) / 2
    for (let i = 0; i < count; i++) out.push([left + i * step, top + ri * step])
  })
  return out
}

function patternSize(n: number, step: number, wide = false): { w: number; h: number } {
  const rows = wide ? wideRows(Math.max(1, n)) : rowPattern(Math.max(1, n))
  return { w: (Math.max(...rows) - 1) * step, h: (rows.length - 1) * step }
}

type ContainerName = 'plate' | 'bag' | 'box' | 'basket' | 'circle'

const BASKET_BAND = 18

/** Wadah digambar di belakang benda. (cx, cy) pusat area benda, iw x ih ukuran area benda. */
function Container({ kind, cx, cy, iw, ih }: { kind: ContainerName; cx: number; cy: number; iw: number; ih: number }): ReactElement {
  if (kind === 'circle' || kind === 'plate') {
    const r = Math.max(iw, ih) / 2
    if (kind === 'circle') {
      return <circle cx={r2(cx)} cy={r2(cy)} r={r2(r)} fill={WHITE} stroke={INK} strokeWidth={SW} />
    }
    return (
      <g>
        <circle cx={r2(cx)} cy={r2(cy)} r={r2(r + 9)} fill={WHITE} stroke={INK} strokeWidth={SW} />
        <circle cx={r2(cx)} cy={r2(cy)} r={r2(r)} fill={BG} stroke={BORDER} strokeWidth={SW2} />
      </g>
    )
  }
  const x0 = cx - iw / 2
  const x1 = cx + iw / 2
  const y0 = cy - ih / 2
  const y1 = cy + ih / 2
  if (kind === 'box') {
    return (
      <g>
        <path d={`M${r2(x0)} ${r2(y0)}L${r2(x0 - 14)} ${r2(y0 - 16)}L${r2(x0 + iw * 0.3)} ${r2(y0 - 16)}L${r2(x0 + iw * 0.36)} ${r2(y0)}Z`} fill={WARN_50} stroke={INK} strokeWidth={SW2} />
        <path d={`M${r2(x1)} ${r2(y0)}L${r2(x1 + 14)} ${r2(y0 - 16)}L${r2(x1 - iw * 0.3)} ${r2(y0 - 16)}L${r2(x1 - iw * 0.36)} ${r2(y0)}Z`} fill={WARN_50} stroke={INK} strokeWidth={SW2} />
        <rect x={r2(x0)} y={r2(y0)} width={r2(iw)} height={r2(ih)} rx={4} fill={WARN_50} stroke={INK} strokeWidth={SW} />
      </g>
    )
  }
  if (kind === 'basket') {
    // pegangan rendah, anyaman hanya di pita bawah supaya benda tetap mudah dihitung
    const hh = Math.min(38, iw * 0.34)
    const yb = y1 + BASKET_BAND
    // posisi relatif garis pita pada sisi miring keranjang
    const bandT = (y1 + 1 - y0) / (yb - y0)
    const weave: string[] = []
    for (let x = x0 + 6; x <= x1 - 16; x += 12) weave.push(`M${r2(x)} ${r2(y1 + 3)}l8 ${BASKET_BAND - 6}`)
    return (
      <g>
        <path d={`M${r2(x0 + 10)} ${r2(y0)}C${r2(x0 + 10)} ${r2(y0 - hh * 1.33)} ${r2(x1 - 10)} ${r2(y0 - hh * 1.33)} ${r2(x1 - 10)} ${r2(y0)}`} fill="none" stroke={INK} strokeWidth={SW + 2} />
        <path d={`M${r2(x0 - 8)} ${r2(y0)}L${r2(x1 + 8)} ${r2(y0)}L${r2(x1 - 4)} ${r2(yb)}L${r2(x0 + 4)} ${r2(yb)}Z`} fill={WARN_50} stroke={INK} strokeWidth={SW} />
        <path d={weave.join('')} stroke={WARN} strokeWidth={1.5} fill="none" />
        <line x1={r2(x0 - 8 + 12 * bandT)} y1={r2(y1 + 1)} x2={r2(x1 + 8 - 12 * bandT)} y2={r2(y1 + 1)} stroke={INK} strokeWidth={SW2} />
        <rect x={r2(x0 - 12)} y={r2(y0 - 6)} width={r2(iw + 24)} height={10} rx={5} fill={WARN_50} stroke={INK} strokeWidth={SW2} />
      </g>
    )
  }
  // bag
  return (
    <g>
      <path d={`M${r2(cx - iw * 0.22)} ${r2(y0 + 2)}C${r2(cx - iw * 0.22)} ${r2(y0 - 26)} ${r2(cx + iw * 0.22)} ${r2(y0 - 26)} ${r2(cx + iw * 0.22)} ${r2(y0 + 2)}`} fill="none" stroke={INK} strokeWidth={SW} />
      <path d={`M${r2(x0 + 4)} ${r2(y0)}L${r2(x1 - 4)} ${r2(y0)}L${r2(x1 + 6)} ${r2(y1 - 12)}Q${r2(x1 + 7)} ${r2(y1)} ${r2(x1 - 6)} ${r2(y1)}L${r2(x0 + 6)} ${r2(y1)}Q${r2(x0 - 7)} ${r2(y1)} ${r2(x0 - 6)} ${r2(y1 - 12)}Z`} fill={MATH_50} stroke={INK} strokeWidth={SW} />
    </g>
  )
}

export function drawGroups(s: Spec<'groups'>): Drawn {
  const counts = (s.groups ?? []).slice(0, 10).map((n) => int(n, 0, 20))
  if (counts.length === 0) counts.push(0)
  const kind: ContainerName = s.container ?? 'circle'
  const k = Math.max(1, ...counts)
  const icon = k <= 4 ? 34 : k <= 10 ? 28 : 24
  const step = icon + 6
  const round = kind === 'circle' || kind === 'plate'
  const wide = kind === 'basket' || kind === 'box'
  const ps = patternSize(k, step, wide)
  // ukuran area benda di dalam wadah
  let iw: number
  let ih: number
  if (round) {
    const all = groupPositions(k, step)
    const reach = Math.max(...all.map(([x, y]) => Math.hypot(Math.abs(x) + icon / 2, Math.abs(y) + icon / 2)))
    const d = Math.max(reach * 2 + 8, icon * 1.9)
    iw = d
    ih = d
  } else {
    iw = Math.max(ps.w + icon + 28, 70)
    ih = Math.max(ps.h + icon + 24, 56)
  }
  // ruang ekstra di luar area benda: bibir piring, tutup kotak, pegangan
  const extraTop = kind === 'plate' ? 9 : kind === 'box' ? 18 : kind === 'basket' ? Math.min(38, iw * 0.34) + 4 : kind === 'bag' ? 22 : 0
  const extraBottom = kind === 'plate' ? 9 : kind === 'basket' ? BASKET_BAND : 0
  const extraSide = kind === 'plate' ? 9 : kind === 'box' ? 14 : kind === 'basket' ? 12 : kind === 'bag' ? 8 : 0
  const cw = iw + extraSide * 2 + 12
  const ch = ih + extraTop + extraBottom + 12
  const gap = 18
  const perRow = Math.max(1, Math.min(counts.length, Math.floor((560 - PAD * 2 + gap) / (cw + gap))))
  const rowsSplit = splitRows(counts.length, perRow)
  const maxPer = Math.max(...rowsSplit)
  const w = PAD * 2 + maxPer * cw + (maxPer - 1) * gap
  const h = PAD * 2 + rowsSplit.length * ch + (rowsSplit.length - 1) * gap
  const hl = int(s.highlightGroups ?? 0, 0, counts.length)
  const parts: ReactNode[] = []
  let gi = 0
  rowsSplit.forEach((inRow, ri) => {
    const rowW = inRow * cw + (inRow - 1) * gap
    const left = (w - rowW) / 2
    for (let i = 0; i < inRow; i++, gi++) {
      const gx = left + i * (cw + gap)
      const gy = PAD + ri * (ch + gap)
      const cx = gx + cw / 2
      const cy = gy + 6 + extraTop + ih / 2
      const n = counts[gi]!
      parts.push(
        <g key={gi}>
          {gi < hl && <rect x={r2(gx)} y={r2(gy)} width={r2(cw)} height={r2(ch)} rx={14} fill={MATH_50} stroke={MATH} strokeWidth={SW2} />}
          <Container kind={kind} cx={cx} cy={cy} iw={iw} ih={ih} />
          {groupPositions(n, step, wide).map(([x, y], j) => (
            <IconGlyph key={j} name={s.icon} x={r2(cx + x - icon / 2)} y={r2(cy + y - icon / 2)} size={icon} />
          ))}
        </g>,
      )
    }
  })
  return { w, h, el: <g>{parts}</g> }
}

/** Tanda silang di atas benda yang dicoret (diambil). */
function Cross({ x, y, size }: { x: number; y: number; size: number }): ReactElement {
  const i = size * 0.08
  return (
    <path
      d={`M${r2(x + i)} ${r2(y + i)}L${r2(x + size - i)} ${r2(y + size - i)}M${r2(x + size - i)} ${r2(y + i)}L${r2(x + i)} ${r2(y + size - i)}`}
      stroke={INK}
      strokeWidth={3.5}
      fill="none"
    />
  )
}

export function drawObjects(s: Spec<'objects'>): Drawn {
  const items = (s.items ?? []).slice(0, 5).map((it) => ({ icon: it.icon as IconName, count: int(it.count, 1, 20), crossed: int(it.crossed ?? 0, 0, 20) }))
  const total = items.reduce((t, it) => t + it.count, 0)
  const icon = total <= 10 ? 44 : 36
  const step = icon + 6
  const fiveGap = 10
  const typeGap = 26
  // satu baris bila sedikit, kalau tidak setiap jenis di barisnya sendiri (paling banyak 10 per baris)
  const oneLine = total <= 10 && items.length <= 3
  type Placed = { icon: IconName; x: number; y: number; crossed: boolean }
  const placed: Placed[] = []
  let maxX = 0
  let y = PAD
  if (oneLine) {
    let x = PAD
    items.forEach((it, ti) => {
      if (ti > 0) x += typeGap
      for (let i = 0; i < it.count; i++) {
        if (i === 5) x += fiveGap
        placed.push({ icon: it.icon, x, y, crossed: i >= it.count - it.crossed })
        x += step
      }
      x -= 6
    })
    maxX = x
    y += icon
  } else {
    items.forEach((it, ti) => {
      if (ti > 0) y += 14
      const lines = Math.ceil(it.count / 10)
      for (let l = 0; l < lines; l++) {
        let x = PAD
        for (let i = l * 10; i < Math.min(it.count, (l + 1) * 10); i++) {
          if (i % 10 === 5) x += fiveGap
          placed.push({ icon: it.icon, x, y, crossed: i >= it.count - it.crossed })
          x += step
        }
        maxX = Math.max(maxX, x - 6)
        y += step
      }
      y -= 6
    })
  }
  return {
    w: Math.ceil(maxX + PAD),
    h: Math.ceil(y + PAD),
    el: (
      <g>
        {placed.map((p, i) =>
          p.crossed ? (
            <g key={i}>
              <g opacity={0.45}>
                <IconGlyph name={p.icon} x={p.x} y={p.y} size={icon} />
              </g>
              <Cross x={p.x} y={p.y} size={icon} />
            </g>
          ) : (
            <IconGlyph key={i} name={p.icon} x={p.x} y={p.y} size={icon} />
          ),
        )}
      </g>
    ),
  }
}
