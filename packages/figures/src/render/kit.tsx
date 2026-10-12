import type { ReactElement, ReactNode } from 'react'
import type { FigureKind, FigureSpec } from '../spec'
import {
  ENGLISH, FONT_DISPLAY, INK, MATH, REVIEW, SCIENCE, STAR, TONES, WARN, WHITE, type Tone,
} from '../palette'
import { CAP_HEIGHT, JAKARTA_WIDTHS, METRIC_CHARS, MOHAVE_WIDTHS } from './metrics'

/** Hasil gambar satu figur: ukuran alami (viewBox) dan isinya. */
export type Drawn = { w: number; h: number; el: ReactNode }

/** Konteks render: awalan id unik untuk <defs> (pola, clipPath) per figur. */
export type Ctx = { uid: string }

export type Spec<K extends FigureKind> = Extract<FigureSpec, { kind: K }>

/** Tebal garis tinta. */
export const SW = 2.5
export const SW2 = 2
export const SW1 = 1.5
/** Jarak tepi figur. */
export const PAD = 16

export type Weight = 400 | 500 | 600 | 700 | 800

const CHAR_INDEX = new Map<string, number>()
for (let i = 0; i < METRIC_CHARS.length; i++) CHAR_INDEX.set(METRIC_CHARS[i]!, i)

/** Lebar teks dalam px untuk Plus Jakarta Sans (atau Mohave bila display). */
export function textWidth(text: string, size = 16, weight: Weight = 600, display = false): number {
  const table = display ? MOHAVE_WIDTHS[weight >= 700 ? 700 : 600] : JAKARTA_WIDTHS[weight]
  let total = 0
  for (const ch of text) {
    const i = CHAR_INDEX.get(ch)
    total += i === undefined ? 640 : table[i]!
  }
  return (total * size) / 1000
}

/** Bungkus teks per kata supaya tidak lebih lebar dari maxW. */
export function wrapText(text: string, maxW: number, size = 16, weight: Weight = 600): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && textWidth(next, size, weight) > maxW) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Bulatkan koordinat ke 2 desimal supaya markup ringkas. */
export const r2 = (n: number): number => Math.round(n * 100) / 100

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

/** Bilangan bulat aman: NaN dan undefined menjadi nilai bawah. */
export function int(n: number | undefined, lo: number, hi: number): number {
  if (n === undefined || !Number.isFinite(n)) return lo
  return clamp(Math.round(n), lo, hi)
}

/** Teks label. `y` adalah pusat vertikal huruf kapital dan angka. */
export function Txt({
  x, y, children, size = 16, weight = 600, anchor = 'middle', fill = INK, display = false, halo = false,
}: {
  x: number
  y: number
  children: ReactNode
  size?: number
  weight?: Weight
  anchor?: 'start' | 'middle' | 'end'
  fill?: string
  display?: boolean
  /** Halo di belakang huruf supaya garis di bawahnya tidak mengganggu. `true` berarti putih. */
  halo?: boolean | string
}): ReactElement {
  return (
    <text
      x={r2(x)}
      y={r2(y + (size * CAP_HEIGHT) / 2)}
      fontSize={size}
      fontWeight={weight}
      textAnchor={anchor}
      fill={fill}
      {...(display ? { fontFamily: FONT_DISPLAY } : {})}
      {...(halo ? { stroke: halo === true ? WHITE : halo, strokeWidth: 4, strokeLinejoin: 'round' as const, paintOrder: 'stroke' } : {})}
    >
      {children}
    </text>
  )
}

/** Beberapa baris teks yang dipusatkan secara vertikal di y. */
export function Lines({
  x, y, lines, size = 16, weight = 600, anchor = 'middle', fill = INK, lineHeight,
}: {
  x: number
  y: number
  lines: string[]
  size?: number
  weight?: Weight
  anchor?: 'start' | 'middle' | 'end'
  fill?: string
  lineHeight?: number
}): ReactElement {
  const lh = lineHeight ?? Math.round(size * 1.3)
  const top = y - ((lines.length - 1) * lh) / 2
  return (
    <>
      {lines.map((line, i) => (
        <Txt key={i} x={x} y={top + i * lh} size={size} weight={weight} anchor={anchor} fill={fill}>
          {line}
        </Txt>
      ))}
    </>
  )
}

/** Ujung panah segitiga dengan ujung di (x, y) yang menghadap sudut `ang` (radian, layar). */
export function arrowHeadPath(x: number, y: number, ang: number, len = 11, half = 6): string {
  const bx = x - Math.cos(ang) * len
  const by = y - Math.sin(ang) * len
  const px = -Math.sin(ang) * half
  const py = Math.cos(ang) * half
  return `M${r2(x)} ${r2(y)}L${r2(bx + px)} ${r2(by + py)}L${r2(bx - px)} ${r2(by - py)}Z`
}

export function ArrowHead({ x, y, ang, len = 11, half = 6, color = INK }: {
  x: number; y: number; ang: number; len?: number; half?: number; color?: string
}): ReactElement {
  return <path d={arrowHeadPath(x, y, ang, len, half)} fill={color} stroke={color} strokeWidth={1.5} />
}

/** Kotak putus-putus berisi "?" untuk nilai yang hilang. */
export function MissingBox({ cx, cy, w = 36, h = 30, size = 18, rx = 7 }: {
  cx: number; cy: number; w?: number; h?: number; size?: number; rx?: number
}): ReactElement {
  return (
    <g>
      <rect x={r2(cx - w / 2)} y={r2(cy - h / 2)} width={r2(w)} height={r2(h)} rx={rx} fill={WHITE} stroke={INK} strokeWidth={SW2} strokeDasharray="4 5" />
      <Txt x={cx} y={cy} size={size} weight={700}>?</Txt>
    </g>
  )
}

/** Teks yang berarti "kosong, isi di sini". */
export function isBlank(text: string | null | undefined): boolean {
  return text === null || text === undefined || text.trim() === '?'
}

/** Angka gaya en-GB: koma ribuan, titik desimal, tanda minus sejati. */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return ''
  const neg = n < 0 && Math.abs(n) >= 5e-7
  const fixed = Math.abs(n).toFixed(6).replace(/\.?0+$/, '')
  const [whole = '0', dec] = fixed.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${neg ? '−' : ''}${grouped}${dec ? `.${dec}` : ''}`
}

/** Rupiah gaya Indonesia: Rp5.000. */
export function rupiah(n: number): string {
  return `Rp${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

/** Jumlah desimal yang dibutuhkan untuk menampilkan n. */
export function decimals(n: number): number {
  const s = Math.abs(n).toFixed(6).replace(/0+$/, '')
  const i = s.indexOf('.')
  return i < 0 ? 0 : s.length - i - 1
}

/** Bulatkan ke presisi tertentu untuk menghindari 0.30000000000000004. */
export function snap(n: number, dp: number): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

/** Langkah sumbu yang rapi: 1, 2, 5, 10, 20, 25, 50, ... */
export function niceStep(max: number, maxTicks = 10): number {
  if (!(max > 0)) return 1
  const raw = max / maxTicks
  const p = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * p >= raw) return snap(m * p, 6)
  }
  return snap(10 * p, 6)
}

/** Isian tipis (latar) per tone. */
export function lightFill(t: Tone | undefined): string {
  return TONES[t ?? 'math'].fill
}

/** Isian kuat per tone untuk bagian yang bermakna (diarsir, batang). Tetap terbaca di cetak hitam putih. */
export function strongFill(t: Tone | undefined): string {
  switch (t ?? 'math') {
    case 'english': return ENGLISH
    case 'science': return SCIENCE
    case 'warn': return WARN
    case 'star': return STAR
    case 'muted': return REVIEW
    case 'ink': return INK
    default: return MATH
  }
}

/** Kotak pembatas sederhana. */
export type Box = { x0: number; y0: number; x1: number; y1: number }

export function emptyBox(): Box {
  return { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
}

export function grow(b: Box, x: number, y: number, pad = 0): void {
  b.x0 = Math.min(b.x0, x - pad)
  b.y0 = Math.min(b.y0, y - pad)
  b.x1 = Math.max(b.x1, x + pad)
  b.y1 = Math.max(b.y1, y + pad)
}

/** Pindahkan isi supaya kotak `b` mulai di (PAD, PAD), lalu kembalikan ukuran figur. */
export function framed(b: Box, el: ReactNode, pad = PAD): Drawn {
  const w = Math.ceil(b.x1 - b.x0 + pad * 2)
  const h = Math.ceil(b.y1 - b.y0 + pad * 2)
  return {
    w,
    h,
    el: <g transform={`translate(${r2(pad - b.x0)} ${r2(pad - b.y0)})`}>{el}</g>,
  }
}

/** Ubah daftar titik menjadi path tertutup. */
export function polyPath(pts: readonly (readonly [number, number])[], close = true): string {
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${r2(x)} ${r2(y)}`).join('') + (close ? 'Z' : '')
}

/** Bagi n menjadi baris yang hampir sama panjang dengan paling banyak `max` per baris. */
export function splitRows(n: number, max: number): number[] {
  if (n <= 0) return []
  const rows = Math.ceil(n / max)
  const base = Math.floor(n / rows)
  const extra = n % rows
  return Array.from({ length: rows }, (_, i) => base + (i < extra ? 1 : 0))
}
