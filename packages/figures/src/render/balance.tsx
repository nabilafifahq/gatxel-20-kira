import type { ReactNode } from 'react'
import { DIVIDER, INK, MATH_50, REVIEW, WHITE } from '../palette'
import { isBlank, MissingBox, PAD, polyPath, r2, splitRows, SW, SW2, textWidth, Txt, type Drawn, type Spec } from './kit'

type Block = { text: string; w: number }

const BLOCK_H = 36

function blocks(list: string[]): Block[] {
  return list.slice(0, 6).map((t) => ({ text: t, w: Math.max(40, textWidth(t, 18, 700) + 20) }))
}

/** Susun balok di atas piringan: paling banyak 3 per baris, baris bawah lebih banyak. */
function stack(list: Block[]): { rows: Block[][]; w: number; h: number } {
  // tiga balok per baris, atau dua bila baloknya lebar
  const widest = Math.max(0, ...list.map((b) => b.w))
  const per = widest * 3 + 12 <= 210 ? 3 : 2
  const counts = splitRows(list.length, per).sort((a, b) => b - a)
  const rows: Block[][] = []
  let i = 0
  for (const c of counts) {
    rows.push(list.slice(i, i + c))
    i += c
  }
  const w = Math.max(0, ...rows.map((r) => r.reduce((a, b) => a + b.w, 0) + (r.length - 1) * 6))
  return { rows, w, h: rows.length * (BLOCK_H + 4) }
}

function Pan({ cx, y, w, pile, stem }: { cx: number; y: number; w: number; pile: { rows: Block[][] }; stem: number }): ReactNode {
  const parts: ReactNode[] = []
  pile.rows.forEach((row, ri) => {
    const rowW = row.reduce((a, b) => a + b.w, 0) + (row.length - 1) * 6
    let x = cx - rowW / 2
    const by = y - 6 - (ri + 1) * (BLOCK_H + 4) + 4
    row.forEach((b, bi) => {
      parts.push(
        isBlank(b.text) ? (
          <MissingBox key={`${ri}-${bi}`} cx={x + b.w / 2} cy={by + BLOCK_H / 2} w={b.w} h={BLOCK_H} size={20} rx={6} />
        ) : (
          <g key={`${ri}-${bi}`}>
            <rect x={r2(x)} y={r2(by)} width={r2(b.w)} height={BLOCK_H} rx={6} fill={MATH_50} stroke={INK} strokeWidth={SW2} />
            <Txt x={x + b.w / 2} y={by + BLOCK_H / 2} size={18} weight={700}>{b.text}</Txt>
          </g>
        ),
      )
      x += b.w + 6
    })
  })
  return (
    <g>
      {parts}
      <path d={`M${r2(cx - w / 2)} ${r2(y - 6)}H${r2(cx + w / 2)}Q${r2(cx + w / 2 - 8)} ${r2(y + 8)} ${r2(cx + w / 2 - 24)} ${r2(y + 8)}H${r2(cx - w / 2 + 24)}Q${r2(cx - w / 2 + 8)} ${r2(y + 8)} ${r2(cx - w / 2)} ${r2(y - 6)}Z`} fill={DIVIDER} stroke={INK} strokeWidth={SW} />
      <line x1={r2(cx)} y1={r2(y + 8)} x2={r2(cx)} y2={r2(y + 8 + stem)} stroke={INK} strokeWidth={5} />
    </g>
  )
}

export function drawBalance(s: Spec<'balance'>): Drawn {
  const left = stack(blocks(s.left ?? []))
  const right = stack(blocks(s.right ?? []))
  const panW = Math.max(130, left.w + 24, right.w + 24)
  const half = panW / 2 + 34
  const tilt = s.tilt ?? 'level'
  const drop = tilt === 'level' ? 0 : 22
  const pileH = Math.max(left.h, right.h, BLOCK_H + 4)
  const cx = PAD + panW / 2 + half
  // tangkai piringan cukup panjang supaya balok timbangan yang miring tidak menembus piringan
  const stem = 16 + (drop > 0 ? ((panW / 2) * drop) / half + 6 : 0)
  const pivotY = PAD + 4 + pileH + 6 + 8 + stem + drop
  const ly = pivotY + (tilt === 'left' ? drop : tilt === 'right' ? -drop : 0)
  const ry = pivotY + (tilt === 'right' ? drop : tilt === 'left' ? -drop : 0)
  const lx = cx - half
  const rx = cx + half
  const panY = (y: number): number => y - 8 - stem
  const baseY = pivotY + 110
  const ang = Math.atan2(ry - ly, rx - lx)
  const nx = -Math.sin(ang) * 5
  const ny = Math.cos(ang) * 5
  const beam = polyPath([[lx - nx, ly - ny], [rx - nx, ry - ny], [rx + nx, ry + ny], [lx + nx, ly + ny]])
  const w = cx + half + panW / 2 + PAD
  return {
    w: Math.ceil(w),
    h: Math.ceil(baseY + 14 + PAD),
    el: (
      <g>
        <path d={polyPath([[cx - 70, baseY + 12], [cx + 70, baseY + 12], [cx + 46, baseY - 6], [cx - 46, baseY - 6]])} fill={REVIEW} stroke={INK} strokeWidth={SW} />
        <rect x={cx - 7} y={pivotY} width={14} height={baseY - 6 - pivotY} fill={REVIEW} stroke={INK} strokeWidth={SW} />
        <path d={polyPath([[cx, pivotY - 6], [cx + 18, pivotY + 20], [cx - 18, pivotY + 20]])} fill={REVIEW} stroke={INK} strokeWidth={SW} />
        <path d={beam} fill={WHITE} stroke={INK} strokeWidth={SW} />
        <circle cx={cx} cy={pivotY} r={6} fill={INK} />
        <Pan cx={lx} y={panY(ly)} w={panW} pile={left} stem={stem} />
        <Pan cx={rx} y={panY(ry)} w={panW} pile={right} stem={stem} />
      </g>
    ),
  }
}
