import type { ReactNode } from 'react'
import { IconGlyph } from '../icons'
import { DIVIDER, ENGLISH, INK, MATH, REVIEW, SCIENCE, STAR, WARN, WHITE, type Tone } from '../palette'
import { shape2d } from './geometry'
import { MissingBox, PAD, r2, splitRows, SW, textWidth, Txt, type Ctx, type Drawn, type Spec } from './kit'

/** Path tertutup halus (Catmull-Rom) melalui titik-titik. */
function smoothClosed(pts: [number, number][]): string {
  const n = pts.length
  let d = `M${r2(pts[0]![0])} ${r2(pts[0]![1])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!
    const p1 = pts[i]!
    const p2 = pts[(i + 1) % n]!
    const p3 = pts[(i + 2) % n]!
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2[0])} ${r2(p2[1])}`
  }
  return `${d}Z`
}

/** Batu loncatan: elips yang sedikit tidak rata, berbeda per indeks tetapi tetap deterministik. */
function stonePath(cx: number, cy: number, rx: number, ry: number, seed: number): string {
  const pts: [number, number][] = []
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    const wobble = 1 + 0.06 * Math.sin(k * 2.1 + seed * 1.7) + 0.03 * Math.cos(k * 3.3 + seed)
    pts.push([cx + Math.cos(a) * rx * wobble, cy + Math.sin(a) * ry * wobble])
  }
  return smoothClosed(pts)
}

export function drawSequence(s: Spec<'sequence'>): Drawn {
  const items = (s.items ?? []).slice(0, 12)
  const style = s.style ?? 'boxes'
  const size = 22
  const maxText = Math.max(0, ...items.map((t) => (t === null ? 0 : textWidth(t, size, 700))))
  const cw = Math.min(150, Math.max(style === 'stones' ? 70 : 56, maxText + (style === 'circles' ? 22 : 26)))
  const ch = style === 'stones' ? 50 : style === 'circles' ? cw : 56
  const gap = style === 'stones' ? 12 : 14
  // baris dipecah bila terlalu lebar (lebih dari 8 item atau lebih dari 600 px)
  const fitPerRow = Math.max(1, Math.floor((600 + gap) / (cw + gap)))
  const perRowMax = Math.min(items.length > 8 ? Math.ceil(items.length / 2) : items.length, fitPerRow)
  const rows = splitRows(items.length, perRowMax)
  const perRow = Math.max(...rows)
  const rowH = ch + (style === 'stones' ? 14 : 0)
  const w = PAD * 2 + perRow * cw + (perRow - 1) * gap
  const h = PAD * 2 + rows.length * rowH + (rows.length - 1) * 18
  const parts: ReactNode[] = []
  let i = 0
  rows.forEach((count, ri) => {
    for (let c = 0; c < count; c++, i++) {
      const item = items[i] ?? null
      const cx = PAD + c * (cw + gap) + cw / 2
      const wob = style === 'stones' ? (i % 2 === 0 ? 7 : -7) : 0
      const cy = PAD + ri * (rowH + 18) + rowH / 2 + wob
      const blank = item === null || item.trim() === '' || item.trim() === '?'
      const dash = blank ? '5 6' : undefined
      const fill = blank ? WHITE : style === 'stones' ? DIVIDER : WHITE
      let shape: ReactNode
      if (style === 'circles') {
        shape = <circle cx={r2(cx)} cy={r2(cy)} r={r2(cw / 2)} fill={fill} stroke={INK} strokeWidth={SW} strokeDasharray={dash} />
      } else if (style === 'stones') {
        shape = <path d={stonePath(cx, cy, cw / 2, ch / 2, i)} fill={fill} stroke={INK} strokeWidth={SW} strokeDasharray={dash} />
      } else {
        shape = <rect x={r2(cx - cw / 2)} y={r2(cy - ch / 2)} width={r2(cw)} height={ch} rx={12} fill={fill} stroke={INK} strokeWidth={SW} strokeDasharray={dash} />
      }
      parts.push(
        <g key={i}>
          {shape}
          <Txt x={cx} y={cy} size={size} weight={700}>{blank ? '?' : item}</Txt>
        </g>,
      )
    }
  })
  return { w: Math.ceil(w), h: Math.ceil(h), el: <g>{parts}</g> }
}

/** Isian pola: warna kuat ditambah tekstur, supaya warna tetap bisa dibedakan saat dicetak hitam putih. */
const PATTERN_FILL: Record<Tone, string> = {
  math: MATH, english: ENGLISH, science: SCIENCE, warn: WARN, star: STAR, muted: REVIEW, ink: WHITE,
}

function textureDefs(uid: string, used: Set<Tone>): ReactNode {
  const defs: ReactNode[] = []
  if (used.has('english')) {
    defs.push(
      <pattern key="e" id={`${uid}-tx-english`} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={8} height={8} fill={ENGLISH} />
        <line x1={4} y1={0} x2={4} y2={8} stroke={WHITE} strokeWidth={1.75} />
      </pattern>,
    )
  }
  if (used.has('science')) {
    defs.push(
      <pattern key="s" id={`${uid}-tx-science`} width={8} height={8} patternUnits="userSpaceOnUse">
        <rect width={8} height={8} fill={SCIENCE} />
        <circle cx={4} cy={4} r={1.5} fill={WHITE} />
      </pattern>,
    )
  }
  if (used.has('warn')) {
    defs.push(
      <pattern key="w" id={`${uid}-tx-warn`} width={8} height={8} patternUnits="userSpaceOnUse">
        <rect width={8} height={8} fill={WARN} />
        <line x1={0} y1={4} x2={8} y2={4} stroke={WHITE} strokeWidth={1.75} />
      </pattern>,
    )
  }
  if (used.has('muted')) {
    defs.push(
      <pattern key="m" id={`${uid}-tx-muted`} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={8} height={8} fill={REVIEW} />
        <path d="M4 0V8M0 4H8" stroke={WHITE} strokeWidth={1.5} />
      </pattern>,
    )
  }
  return defs.length ? <defs>{defs}</defs> : null
}

function toneFill(uid: string, tone: Tone): string {
  return tone === 'english' || tone === 'science' || tone === 'warn' || tone === 'muted' ? `url(#${uid}-tx-${tone})` : PATTERN_FILL[tone]
}

export function drawPattern(s: Spec<'pattern'>, ctx: Ctx): Drawn {
  const items = (s.items ?? []).slice(0, 14)
  const n = items.length
  const cell = n <= 8 ? 56 : 50
  const inner = cell - 10
  const gap = 10
  const rows = n > 9 ? splitRows(n, Math.ceil(n / 2)) : [n]
  const perRow = Math.max(...rows)
  const w = PAD * 2 + perRow * cell + (perRow - 1) * gap
  const h = PAD * 2 + rows.length * cell + (rows.length - 1) * 16
  const used = new Set<Tone>()
  const parts: ReactNode[] = []
  let i = 0
  rows.forEach((count, ri) => {
    for (let c = 0; c < count; c++, i++) {
      const it = items[i] ?? null
      const x = PAD + c * (cell + gap)
      const y = PAD + ri * (cell + 16)
      if (it === null) {
        parts.push(<MissingBox key={i} cx={x + cell / 2} cy={y + cell / 2} w={cell - 4} h={cell - 4} size={22} rx={10} />)
      } else if ('icon' in it) {
        parts.push(<IconGlyph key={i} name={it.icon} x={x + 5} y={y + 5} size={inner} />)
      } else {
        const tone: Tone = it.tone ?? 'math'
        used.add(tone)
        const tall = it.shape === 'rectangle' || it.shape === 'oval' || it.shape === 'semicircle'
        const g = shape2d(it.shape, inner, tall ? inner * 0.66 : inner)
        parts.push(
          <path
            key={i}
            d={g.d}
            transform={`translate(${r2(x + (cell - g.w) / 2)} ${r2(y + (cell - g.h) / 2)})`}
            fill={toneFill(ctx.uid, tone)}
            stroke={INK}
            strokeWidth={SW}
          />,
        )
      }
    }
  })
  return { w, h, el: <g>{textureDefs(ctx.uid, used)}{parts}</g> }
}
