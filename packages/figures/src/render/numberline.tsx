import type { ReactNode } from 'react'
import { ENGLISH, INK, MATH, WHITE } from '../palette'
import {
  ArrowHead, decimals, fmt, MissingBox, niceStep, PAD, r2, snap, SW, SW2, textWidth, Txt, type Drawn, type Spec,
} from './kit'

const MAX_TICKS = 101
const MAX_W = 640

export function drawNumberline(s: Spec<'numberline'>): Drawn {
  let min = Number.isFinite(s.min) ? s.min : 0
  let max = Number.isFinite(s.max) ? s.max : 10
  if (max < min) [min, max] = [max, min]
  if (max === min) max = min + 1
  let step = s.step > 0 && Number.isFinite(s.step) ? s.step : 1
  // terlalu banyak tick: pakai langkah rapi (1, 2, 5, 10, ...) supaya label tetap bulat
  if ((max - min) / step > MAX_TICKS - 1) step = niceStep(max - min, MAX_TICKS - 1)
  const dp = Math.min(6, Math.max(decimals(step), decimals(min)))
  const n = Math.max(2, Math.round((max - min) / step) + 1)
  const ticks = Array.from({ length: n }, (_, i) => snap(min + i * step, dp))
  const near = (a: number, b: number): boolean => Math.abs(a - b) < step / 1000 + 1e-9

  const missing = (s.missing ?? []).filter((v) => Number.isFinite(v) && v >= min - 1e-9 && v <= max + 1e-9)
  const isMissing = (v: number): boolean => missing.some((m) => near(m, v))
  const mode = s.labels ?? 'all'
  const explicit = Array.isArray(mode) ? mode.filter((v) => Number.isFinite(v)) : null
  const wanted = (v: number, i: number): boolean =>
    mode === 'all' ? true : mode === 'ends' ? i === 0 || i === n - 1 : (explicit ?? []).some((e) => near(e, v))

  const labelSize = 16
  const maxLabel = Math.max(...ticks.map((v) => textWidth(fmt(v), labelSize, 600)), 14)
  const slotNeed = Math.max(maxLabel + 10, missing.length > 0 ? 44 : 0, 28)
  let spacing = slotNeed
  // 'all' dengan tick rapat: label hanya pada kelipatan rapi, tick di antaranya lebih pendek
  let every = 1
  if ((n - 1) * spacing > MAX_W) {
    spacing = Math.max(MAX_W / (n - 1), 5)
    if (mode === 'all') {
      for (const k of [1, 2, 5, 10, 20, 25, 50]) {
        every = k
        if (k * spacing >= slotNeed) break
      }
    }
  }
  if (n <= 3) spacing = Math.max(spacing, 90)
  else if (n <= 6) spacing = Math.max(spacing, 64)
  else if (n <= 11) spacing = Math.max(spacing, 44)
  // huruf label sebesar mungkin selama masih muat di jarak antarlabel
  const fontFor = (size: number): number => Math.max(...ticks.map((v) => textWidth(fmt(v), size, 600)), 10) + 8
  // jarak terdekat antara dua label yang benar-benar digambar
  const shown = ticks.map((_v, i) => i).filter((i) => wanted(ticks[i]!, i) && (mode !== 'all' || i % every === 0))
  const gapPx = shown.length > 1 ? Math.min(...shown.slice(1).map((i, k) => (i - shown[k]!) * spacing)) : every * spacing * 4
  const labelFont = [18, 17, 16, 15, 14].find((f) => fontFor(f) <= gapPx) ?? 13
  const half = every % 2 === 0 ? every / 2 : 0
  // ujung kanan tetap diberi label bila tidak terlalu dekat dengan label sebelumnya
  const lastRoom = (n - 1) % every === 0 || (n - 1) % every >= Math.ceil(every / 2)

  const lineLen = (n - 1) * spacing
  const x0 = PAD + Math.max(maxLabel / 2, 18) + 8
  const xOf = (v: number): number => x0 + ((v - min) / (max - min)) * lineLen

  // ruang di atas garis: lengkung lompatan dan label tanda
  const inRange = (v: number): number => Math.min(max, Math.max(min, v))
  const jumps = (s.jumps ?? [])
    .filter((j) => Number.isFinite(j.from) && Number.isFinite(j.to))
    .map((j) => ({ ...j, from: inRange(j.from), to: inRange(j.to) }))
    .filter((j) => j.from !== j.to)
  const arcH = (j: { from: number; to: number }): number => Math.min(78, Math.max(26, Math.abs(xOf(j.to) - xOf(j.from)) * 0.42))
  const jumpTop = jumps.length ? Math.max(...jumps.map((j) => arcH(j) + (j.label ? 26 : 4))) : 0
  const marks = (s.marks ?? []).filter((m) => Number.isFinite(m.at))
  const markTop = marks.length ? (marks.some((m) => m.label) ? 44 : 14) : 0
  const yL = PAD + Math.max(jumpTop, markTop, 4) + 10
  const labelY = yL + 30
  const h = labelY + 16 + PAD
  const w = x0 + lineLen + Math.max(maxLabel / 2, 18) + 8 + PAD

  const parts: ReactNode[] = []
  parts.push(<line key="line" x1={r2(x0 - 14)} y1={r2(yL)} x2={r2(x0 + lineLen + 14)} y2={r2(yL)} stroke={INK} strokeWidth={SW} />)
  ticks.forEach((v, i) => {
    const x = xOf(v)
    const labelled = wanted(v, i) && (mode !== 'all' || i % every === 0 || (i === n - 1 && lastRoom))
    const major = every === 1 || i % every === 0
    const medium = !major && half > 0 && i % half === 0
    const len = major ? 9 : medium ? 7 : 5
    parts.push(<line key={`t${i}`} x1={r2(x)} y1={r2(yL - len)} x2={r2(x)} y2={r2(yL + len)} stroke={INK} strokeWidth={major ? SW2 : medium ? 1.5 : 1.25} />)
    if (isMissing(v)) return
    if (labelled) parts.push(<Txt key={`l${i}`} x={x} y={labelY} size={labelFont}>{fmt(v)}</Txt>)
  })
  missing.forEach((v, i) => {
    const x = xOf(v)
    if (!ticks.some((t) => near(t, v))) {
      parts.push(<line key={`mt${i}`} x1={r2(x)} y1={r2(yL - 9)} x2={r2(x)} y2={r2(yL + 9)} stroke={INK} strokeWidth={SW2} />)
    }
    parts.push(<MissingBox key={`m${i}`} cx={x} cy={labelY} w={Math.max(34, Math.min(spacing - 6, maxLabel + 14))} h={30} />)
  })
  jumps.forEach((j, i) => {
    const xa = xOf(j.from)
    const xb = xOf(j.to)
    const H = arcH(j)
    const dx = xb - xa
    const y = yL - 4
    const c1x = xa + dx * 0.12
    const c2x = xb - dx * 0.12
    const cy = y - H * 1.33
    // arah ujung panah mengikuti garis singgung kurva di titik akhir
    const ang = Math.atan2(y - cy, xb - c2x)
    const tipBack = 2
    parts.push(
      <g key={`j${i}`}>
        <path d={`M${r2(xa)} ${r2(y)}C${r2(c1x)} ${r2(cy)} ${r2(c2x)} ${r2(cy)} ${r2(xb - Math.cos(ang) * 8)} ${r2(y - Math.sin(ang) * 8)}`} fill="none" stroke={MATH} strokeWidth={SW} />
        <ArrowHead x={xb - Math.cos(ang) * tipBack} y={y - Math.sin(ang) * tipBack} ang={ang} len={12} half={6.5} color={MATH} />
        {j.label && (
          <Txt x={(xa + xb) / 2} y={y - H - 14} size={16} weight={700} fill={MATH} halo>
            {j.label}
          </Txt>
        )}
      </g>,
    )
  })
  marks.forEach((m, i) => {
    const x = xOf(Math.min(max, Math.max(min, m.at)))
    parts.push(
      <g key={`k${i}`}>
        <circle cx={r2(x)} cy={r2(yL)} r={7} fill={ENGLISH} stroke={WHITE} strokeWidth={2} />
        {m.label && (
          <Txt x={x} y={yL - 26} size={17} weight={700} fill={ENGLISH} halo>
            {m.label}
          </Txt>
        )}
      </g>,
    )
  })
  return { w: Math.ceil(w), h: Math.ceil(h), el: <g>{parts}</g> }
}
