import type { ReactElement, ReactNode } from 'react'
import { INK } from '../palette'

/**
 * Alat gambar bersama untuk ikon 48 x 48. Semua ikon dibungkus `ink()`, jadi
 * setiap bentuk di dalamnya mewarisi garis INK 2,5 dengan ujung dan sudut bulat
 * dan tanpa isi. Bentuk yang berwarna cukup menulis `fill`.
 */

export const LINE = 2.5
export const THIN = 2

export function ink(children: ReactNode, transform?: string): ReactElement {
  return (
    <g fill="none" stroke={INK} strokeWidth={LINE} strokeLinecap="round" strokeLinejoin="round" transform={transform}>
      {children}
    </g>
  )
}

/** Titik isi tanpa garis, untuk mata, biji, dan lubang kecil. */
export function dot(cx: number, cy: number, r = 1.7, fill: string = INK): ReactElement {
  return <circle cx={cx} cy={cy} r={r} fill={fill} stroke="none" />
}

/** Garis berwarna dengan tepi tinta: garis INK lebar, lalu warna di atasnya. */
export function tube(d: string, color: string, width = 2.5): ReactElement {
  return (
    <>
      <path d={d} strokeWidth={width + 3} />
      <path d={d} stroke={color} strokeWidth={width} />
    </>
  )
}

/**
 * Bingkai pemandangan 40 x 40 bersudut 7 untuk tempat dan habitat. Isi digambar
 * di dalam bingkai, lalu garis bingkai digambar paling akhir.
 */
export function scene(sky: string, children: ReactNode): ReactElement {
  return (
    <>
      <rect x="4" y="4" width="40" height="40" rx="7" fill={sky} stroke="none" />
      {children}
      <rect x="4" y="4" width="40" height="40" rx="7" />
    </>
  )
}

/** Tanah di dalam bingkai pemandangan, dari garis y sampai bawah (y paling besar 37). */
export function ground(y: number): string {
  return `M4 ${y} L44 ${y} L44 37 A7 7 0 0 1 37 44 L11 44 A7 7 0 0 1 4 37 Z`
}

const r2 = (n: number): number => Math.round(n * 100) / 100

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))]
}

/** Lingkaran bergerigi bulat (surai, awan, kelopak): n busur yang menonjol keluar. */
export function scallop(cx: number, cy: number, r: number, n: number, bulge = 0.6, start = -90): string {
  const rr = r2(2 * r * Math.sin(Math.PI / n) * bulge)
  const [x0, y0] = polar(cx, cy, r, start)
  let d = `M${x0} ${y0}`
  for (let i = 1; i <= n; i++) {
    const [x, y] = polar(cx, cy, r, start + (i * 360) / n)
    d += ` A${rr} ${rr} 0 0 1 ${x} ${y}`
  }
  return `${d} Z`
}

/** Poligon bintang dengan n ujung. */
export function starPath(cx: number, cy: number, outer: number, inner: number, n: number, start = -90): string {
  let d = ''
  for (let i = 0; i < n * 2; i++) {
    const [x, y] = polar(cx, cy, i % 2 === 0 ? outer : inner, start + (i * 180) / n)
    d += `${i === 0 ? 'M' : ' L'}${x} ${y}`
  }
  return `${d} Z`
}

/** Garis jari-jari dari r1 ke r2, misalnya sinar matahari. */
export function rays(cx: number, cy: number, from: number, to: number, n: number, start = -90): string {
  let d = ''
  for (let i = 0; i < n; i++) {
    const [x1, y1] = polar(cx, cy, from, start + (i * 360) / n)
    const [x2, y2] = polar(cx, cy, to, start + (i * 360) / n)
    d += `${i === 0 ? '' : ' '}M${x1} ${y1} L${x2} ${y2}`
  }
  return d
}
