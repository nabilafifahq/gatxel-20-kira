import type { ReactNode } from 'react'
import { DIVIDER, ENGLISH, INK, MATH, MATH_50, REVIEW, WHITE } from '../palette'
import { clamp, decimals, fmt, niceStep, PAD, r2, snap, SW, SW1, SW2, textWidth, Txt, type Drawn, type Spec } from './kit'

/**
 * Alat ukur berskala (termometer, timbangan, gelas ukur). Label selalu di kelipatan rapi
 * dari `step` milik penulis; bila terlalu rapat, label dijarangkan (x2, x5, x10) dan
 * `step` tetap digambar sebagai tick kecil.
 */

const NICE_K = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]

/** Langkah label (major) dan langkah dasar dari penulis. */
export function gaugeScale(range: number, stepIn: number | undefined, maxMajors: number): { major: number; base: number } {
  let base = stepIn !== undefined && stepIn > 0 && Number.isFinite(stepIn) ? stepIn : niceStep(range, 10)
  if (range / base > 400) base = niceStep(range, 100)
  const k = NICE_K.find((m) => range / (base * m) <= maxMajors + 1e-9) ?? 1000
  return { major: snap(base * k, 6), base }
}

/** Berapa tick kecil per langkah label: langkah penulis bila muat, kalau tidak pecahan yang rapi. */
export function minorPer(major: number, base: number, pxPerMajor: number, minPx: number): number {
  const k = Math.round(major / base)
  if (k > 1 && pxPerMajor / k >= minPx) return k
  for (const d of [10, 5, 2]) {
    if (k > 1 && d >= k) continue
    const sub = snap(major / d, 6)
    const nice = Number.isInteger(major) ? Number.isInteger(sub) : decimals(sub) <= 2
    if (pxPerMajor / d >= minPx && nice) return d
  }
  return 1
}

export type Tick = { v: number; kind: 'major' | 'mid' | 'minor'; index: number }

/** Semua tick di [min, max] pada kelipatan major / per. `index` = urutan kelipatan major. */
export function ticksBetween(min: number, max: number, major: number, per: number): Tick[] {
  const minor = major / per
  const dp = Math.min(8, decimals(snap(minor, 6)) + 2)
  const j0 = Math.ceil(min / minor - 1e-7)
  const j1 = Math.floor(max / minor + 1e-7)
  const out: Tick[] = []
  for (let j = j0; j <= j1 && out.length < 2000; j++) {
    const idx = ((j % per) + per) % per
    out.push({
      v: snap(j * minor, dp),
      kind: idx === 0 ? 'major' : per === 10 && idx === 5 ? 'mid' : 'minor',
      index: Math.round((j - idx) / per),
    })
  }
  return out
}

function range(min: number, max: number, fallbackMax: number): [number, number] {
  let lo = Number.isFinite(min) ? min : 0
  let hi = Number.isFinite(max) ? max : fallbackMax
  if (hi < lo) [lo, hi] = [hi, lo]
  if (hi === lo) hi = lo + 10
  return [lo, hi]
}

export function drawThermometer(s: Spec<'thermometer'>): Drawn {
  const [min, max] = range(s.min, s.max, 40)
  const span = max - min
  const { major, base } = gaugeScale(span, s.step ?? 10, 12)
  const spacing = clamp(270 / (span / major), 22, 56)
  const H = (span / major) * spacing
  const per = minorPer(major, base, spacing, 4.5)
  const ticks = ticksBetween(min, max, major, per)
  const value = clamp(Number.isFinite(s.value) ? s.value : min, min, max)
  const labels = ticks.filter((t) => t.kind === 'major')
  const labelW = Math.max(16, ...labels.map((t) => textWidth(fmt(t.v), 15, 600)))
  const cx = PAD + 22
  const yTop = PAD + 40
  const yOf = (v: number): number => yTop + H - ((v - min) / span) * H
  const tubeTop = yTop - 18
  const bulbR = 18
  const bulbCy = yTop + H + 22 + bulbR * 0.4
  const tw = 9
  const yj = bulbCy - Math.sqrt(bulbR * bulbR - tw * tw)
  const iw = 4.5
  const ir = 12
  const yj2 = bulbCy - Math.sqrt(ir * ir - iw * iw)
  const len = { major: 18, mid: 14, minor: 9 }
  const d = { major: [] as string[], minor: [] as string[] }
  for (const t of ticks) {
    const y = r2(yOf(t.v))
    ;(t.kind === 'minor' ? d.minor : d.major).push(`M${cx + 13} ${y}h${len[t.kind]}`)
  }
  const yv = yOf(value)
  return {
    w: Math.ceil(cx + 38 + labelW + PAD),
    h: Math.ceil(bulbCy + bulbR + PAD),
    el: (
      <g>
        <path d={`M${cx - tw} ${r2(yj)}V${tubeTop + tw}A${tw} ${tw} 0 0 1 ${cx + tw} ${tubeTop + tw}V${r2(yj)}A${bulbR} ${bulbR} 0 1 1 ${cx - tw} ${r2(yj)}Z`} fill={WHITE} stroke={INK} strokeWidth={SW} />
        <path d={`M${cx - iw} ${r2(yv)}H${cx + iw}V${r2(yj2)}A${ir} ${ir} 0 1 1 ${cx - iw} ${r2(yj2)}Z`} fill={ENGLISH} />
        <path d={d.minor.join('')} stroke={INK} strokeWidth={SW1} strokeLinecap="butt" />
        <path d={d.major.join('')} stroke={INK} strokeWidth={SW2} strokeLinecap="butt" />
        {labels.map((t) => (
          <Txt key={t.v} x={cx + 38} y={yOf(t.v)} size={15} anchor="start">{fmt(t.v)}</Txt>
        ))}
        <Txt x={cx + 38} y={PAD + 10} size={16} weight={700} anchor="start">{'°C'}</Txt>
      </g>
    ),
  }
}

export function drawScale(s: Spec<'scale'>): Drawn {
  const max = s.max > 0 && Number.isFinite(s.max) ? s.max : 1000
  const value = clamp(Number.isFinite(s.value) ? s.value : 0, 0, max)
  const unit = s.unit ?? 'g'
  const R = 108
  const bodyW = 284
  const cx = PAD + bodyW / 2
  const panY = PAD + 6
  const bodyTop = panY + 40
  const cy = bodyTop + 18 + R
  const bodyH = R * 2 + 44
  const sweep = 300
  const rad = (sweep * Math.PI) / 180
  const { major, base } = gaugeScale(max, s.step, 12)
  const nMaj = max / major
  const per = minorPer(major, base, ((R - 6) * rad) / nMaj, 5)
  const ticks = ticksBetween(0, max, major, per)
  const at = (deg: number, r: number): [number, number] => {
    const a = (deg * Math.PI) / 180
    return [cx + r * Math.sin(a), cy - r * Math.cos(a)]
  }
  const degOf = (v: number): number => -150 + (sweep * v) / max
  const labelSize = nMaj > 10 ? 14 : 15
  const majors = ticks.filter((t) => t.kind === 'major')
  // posisi label: jarak dari pusat menyesuaikan lebar teks supaya tidak menyentuh tick
  const placed = majors.map((t) => {
    const text = fmt(t.v)
    const w = textWidth(text, labelSize, 600)
    const a = (degOf(t.v) * Math.PI) / 180
    const ext = Math.abs(Math.sin(a)) * (w / 2) + Math.abs(Math.cos(a)) * labelSize * 0.4
    const [x, y] = at(degOf(t.v), R - 24 - ext)
    return { t, text, x, y, w, h: labelSize * 0.8 }
  })
  // label dijarangkan (setiap 2, 3, ...) hanya bila kotak label yang bertetangga bertabrakan
  const clash = (step: number): boolean => {
    const shown = placed.filter((p) => p.t.index % step === 0)
    return shown.some((p, i) => {
      const q = shown[i + 1]
      return q !== undefined && Math.abs(p.x - q.x) < (p.w + q.w) / 2 + 5 && Math.abs(p.y - q.y) < (p.h + q.h) / 2 + 3
    })
  }
  let every = 1
  while (every < majors.length && clash(every)) every++
  const len = { major: 14, mid: 10, minor: 6 }
  const d = { major: [] as string[], minor: [] as string[] }
  for (const t of ticks) {
    const [x1, y1] = at(degOf(t.v), R - 5)
    const [x2, y2] = at(degOf(t.v), R - 5 - len[t.kind])
    ;(t.kind === 'minor' ? d.minor : d.major).push(`M${r2(x1)} ${r2(y1)}L${r2(x2)} ${r2(y2)}`)
  }
  const labels: ReactNode[] = placed
    .filter((p) => p.t.index % every === 0)
    .map((p) => <Txt key={p.t.v} x={p.x} y={p.y} size={labelSize} halo>{p.text}</Txt>)
  const [nx, ny] = at(degOf(value), R - 14)
  const [tx, ty] = at(degOf(value) + 180, 14)
  return {
    w: Math.ceil(bodyW + PAD * 2),
    h: Math.ceil(bodyTop + bodyH + PAD),
    el: (
      <g>
        <rect x={r2(cx - 22)} y={r2(panY + 22)} width={44} height={22} fill={REVIEW} stroke={INK} strokeWidth={SW2} />
        <path d={`M${r2(cx - 128)} ${r2(panY)}H${r2(cx + 128)}Q${r2(cx + 120)} ${r2(panY + 26)} ${r2(cx + 78)} ${r2(panY + 26)}H${r2(cx - 78)}Q${r2(cx - 120)} ${r2(panY + 26)} ${r2(cx - 128)} ${r2(panY)}Z`} fill={DIVIDER} stroke={INK} strokeWidth={SW} />
        <rect x={PAD} y={bodyTop} width={bodyW} height={bodyH} rx={28} fill={MATH_50} stroke={INK} strokeWidth={SW} />
        <circle cx={cx} cy={cy} r={R} fill={WHITE} stroke={INK} strokeWidth={SW} />
        <path d={d.minor.join('')} stroke={INK} strokeWidth={SW1} />
        <path d={d.major.join('')} stroke={INK} strokeWidth={SW} />
        <Txt x={cx} y={cy + R * 0.38} size={20} weight={700}>{unit}</Txt>
        <line data-needle x1={r2(tx)} y1={r2(ty)} x2={r2(nx)} y2={r2(ny)} stroke={ENGLISH} strokeWidth={4} />
        {/* angka di atas jarum dengan halo putih supaya tetap terbaca */}
        {labels}
        <circle cx={cx} cy={cy} r={8} fill={INK} />
      </g>
    ),
  }
}

export function drawJug(s: Spec<'jug'>): Drawn {
  const capacity = s.capacity > 0 && Number.isFinite(s.capacity) ? s.capacity : 1000
  const value = clamp(Number.isFinite(s.value) ? s.value : 0, 0, capacity)
  const unit = s.unit ?? 'ml'
  const { major, base } = gaugeScale(capacity, s.step, 12)
  const nMaj = capacity / major
  const spacing = clamp(250 / nMaj, 20, 56)
  const H = nMaj * spacing
  const per = minorPer(major, base, spacing, 6)
  const ticks = ticksBetween(0, capacity, major, per).filter((t) => t.v > 0)
  const L = PAD + 24
  const R = L + 160
  const top = PAD + 12
  const B = top + 34 + H
  const yOf = (v: number): number => B - (v / capacity) * H
  const yv = yOf(value)
  const len = { major: 22, mid: 17, minor: 11 }
  const d = { major: [] as string[], minor: [] as string[] }
  for (const t of ticks) (t.kind === 'minor' ? d.minor : d.major).push(`M${L} ${r2(yOf(t.v))}h${len[t.kind]}`)
  const rr = 14
  const water = `M${L} ${r2(yv)}V${B - rr}Q${L} ${B} ${L + rr} ${B}H${R - rr}Q${R} ${B} ${R} ${B - rr}V${r2(yv)}Z`
  const body = `M${L - 20} ${top - 8}Q${L - 2} ${top} ${L} ${top + 22}V${B - rr}Q${L} ${B} ${L + rr} ${B}H${R - rr}Q${R} ${B} ${R} ${B - rr}V${top}`
  const hTop = top + 18
  const hBot = top + Math.max(80, H * 0.6)
  const handle = `M${R} ${hTop}C${R + 48} ${hTop} ${R + 48} ${hTop} ${R + 48} ${hTop + 34}V${hBot - 30}C${R + 48} ${hBot} ${R + 30} ${hBot} ${R} ${hBot}`
  const labels = ticks.filter((t) => t.kind === 'major')
  return {
    w: Math.ceil(R + 54 + PAD),
    h: Math.ceil(B + PAD),
    el: (
      <g>
        <path d={handle} fill="none" stroke={INK} strokeWidth={13} />
        <path d={handle} fill="none" stroke={MATH_50} strokeWidth={7} />
        <path d={`${body}Z`} fill={WHITE} />
        {value > 0 && <path d={water} fill={MATH_50} />}
        {value > 0 && <line x1={L} y1={r2(yv)} x2={R} y2={r2(yv)} stroke={MATH} strokeWidth={3} />}
        <path d={d.minor.join('')} stroke={INK} strokeWidth={SW1} strokeLinecap="butt" />
        <path d={d.major.join('')} stroke={INK} strokeWidth={SW2} strokeLinecap="butt" />
        {/* halo sewarna latar (air atau kaca) supaya garis permukaan air tidak menimpa angka */}
        {labels.map((t) => (
          <Txt key={t.v} x={L + 28} y={yOf(t.v)} size={15} anchor="start" halo={yOf(t.v) > yv - 9 && value > 0 ? MATH_50 : WHITE}>
            {fmt(t.v)}
          </Txt>
        ))}
        <Txt x={R - 12} y={top + 12} size={16} weight={700} anchor="end">{unit}</Txt>
        <path d={body} fill="none" stroke={INK} strokeWidth={SW} />
        <line x1={R} y1={top} x2={R + 6} y2={top - 4} stroke={INK} strokeWidth={SW} />
      </g>
    ),
  }
}
