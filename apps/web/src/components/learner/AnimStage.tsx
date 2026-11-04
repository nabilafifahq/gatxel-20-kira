'use client'

import { useEffect, useState, type ReactElement } from 'react'
import type { Anim } from '@kira/content/anim'
import type { Subject } from '@/lib/dto'

/**
 * Panggung gambar bergerak untuk pembahasan (SolutionPlayer). Dimuat malas (next/dynamic) supaya runner
 * tidak membawa kode ini sampai anak membuka pembahasan. Semua gambar adalah SVG yang dihitung dari satu
 * nilai kemajuan t (0 sampai 1); dengan reduced motion t langsung 1, jadi gambarnya diam dan lengkap.
 * Warna hanya lewat kelas token.
 */

type Tone = { solid: string; tint: string; stroke: string; text: string }
const TONE: Record<Subject, Tone> = {
  math: { solid: 'fill-math', tint: 'fill-math-50', stroke: 'stroke-math', text: 'fill-math' },
  english: { solid: 'fill-english', tint: 'fill-english-50', stroke: 'stroke-english', text: 'fill-english' },
  science: { solid: 'fill-science', tint: 'fill-science-50', stroke: 'stroke-science', text: 'fill-science' },
}

const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n))
/** Bagian t di antara a dan b, 0 sampai 1. */
const seg = (t: number, a: number, b: number) => clamp((t - a) / Math.max(1e-6, b - a))
const ease = (p: number) => 1 - Math.pow(1 - p, 3)
const fmt = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 6 })
const lerp = (a: number, b: number, p: number) => a + (b - a) * p

export function useProgress(ms: number, reduced: boolean): number {
  const [t, setT] = useState(reduced ? 1 : 0)
  useEffect(() => {
    if (reduced) {
      setT(1)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = clamp((now - start) / ms)
      setT(p)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ms, reduced])
  return reduced ? 1 : t
}

/** Kalimat untuk pembaca layar. */
export function describeAnim(a: Anim): string {
  switch (a.k) {
    case 'combine': {
      const word = { '+': 'plus', '-': 'minus', '×': 'times', '÷': 'divided by' }[a.op]
      return `${fmt(a.a)} ${word} ${fmt(a.b)} equals ${fmt(a.r)}.`
    }
    case 'column':
      return `Column ${a.op === '+' ? 'addition' : a.op === '-' ? 'subtraction' : 'multiplication'}: ${fmt(a.a)} ${a.op} ${fmt(a.b)} equals ${fmt(a.r)}.`
    case 'bar':
      return `Bar model: ${a.parts.map((p) => fmt(p.v)).join(', ')} make ${fmt(a.total)} in all.`
    case 'line':
      return `Number line: start at ${fmt(a.start)} and make ${a.jumps.length} ${a.jumps.length === 1 ? 'jump' : 'jumps'}.`
    case 'seq':
      return `Numbers one after another: ${a.items.join(', ')}.`
    case 'lines':
      return `Working: ${a.lines.join('. ')}.`
  }
}

const money = (n: number, cur?: 'Rp') => (cur ? `Rp${n.toLocaleString('id-ID')}` : fmt(n))

function Combine({ a, t, tone }: { a: Extract<Anim, { k: 'combine' }>; t: number; tone: Tone }): ReactElement {
  const parts = [money(a.a, a.cur), a.op, money(a.b, a.cur), '=', money(a.r, a.cur)]
  const chars = parts.reduce((n, s) => n + s.length, 0) + 3
  const fs = clamp(330 / (chars * 0.62), 20, 46)
  const gap = fs * 0.4
  const widths = parts.map((s) => s.length * fs * (s.length === 1 && /[+\-×÷=]/.test(s) ? 0.95 : 0.6))
  const total = widths.reduce((n, w) => n + w, 0) + gap * (parts.length - 1)
  let x = 180 - total / 2
  const xs = widths.map((w) => {
    const c = x + w / 2
    x += w + gap
    return c
  })
  const slide = ease(seg(t, 0, 0.4))
  const opIn = seg(t, 0.35, 0.55)
  const popP = ease(seg(t, 0.6, 0.95))
  const y = 92
  return (
    <>
      <text x={lerp(xs[0]! - 60, xs[0]!, slide)} y={y} textAnchor="middle" fontSize={fs} className={`font-display font-semibold ${tone.text}`} opacity={seg(t, 0, 0.2)}>
        {parts[0]}
      </text>
      <text x={xs[1]} y={y} textAnchor="middle" fontSize={fs} className="fill-fg font-display font-semibold" opacity={opIn}>
        {parts[1]}
      </text>
      <text x={lerp(xs[2]! + 60, xs[2]!, slide)} y={y} textAnchor="middle" fontSize={fs} className={`font-display font-semibold ${tone.text}`} opacity={seg(t, 0, 0.2)}>
        {parts[2]}
      </text>
      <text x={xs[3]} y={y} textAnchor="middle" fontSize={fs} className="fill-fg font-display font-semibold" opacity={popP}>
        {parts[3]}
      </text>
      <g transform={`translate(${xs[4]} ${y}) scale(${lerp(0.6, 1, popP)})`} opacity={popP}>
        <text textAnchor="middle" fontSize={fs} className="fill-fg font-display font-bold">
          {parts[4]}
        </text>
        <rect x={-widths[4]! / 2} y={fs * 0.18} width={widths[4]!} height={4} rx={2} className="fill-star" />
      </g>
    </>
  )
}

function carries(a: number, b: number): boolean[] {
  const da = String(a).split('').reverse().map(Number)
  const db = String(b).split('').reverse().map(Number)
  const out: boolean[] = []
  let c = 0
  for (let i = 0; i < Math.max(da.length, db.length); i++) {
    const s = (da[i] ?? 0) + (db[i] ?? 0) + c
    c = s >= 10 ? 1 : 0
    out.push(c === 1)
  }
  return out
}

function Column({ a, t, tone }: { a: Extract<Anim, { k: 'column' }>; t: number; tone: Tone }): ReactElement {
  const rs = String(a.r)
  const as = String(a.a)
  const bs = String(a.b)
  const n = Math.max(as.length, bs.length, rs.length)
  const cw = Math.min(40, 300 / (n + 1.2))
  const fs = cw * 1.15
  const left = 180 - (cw * (n + 1)) / 2
  const colX = (i: number) => left + cw * (i + 1) + cw / 2 // i = 0 kolom paling kiri
  const visible = a.upTo ?? rs.length
  const ca = a.op === '+' ? carries(a.a, a.b) : []
  const shown = visible === 0 ? 0 : t * visible
  const active = visible === 0 ? -1 : Math.min(visible - 1, Math.floor(shown))
  const rowA = 56
  const rowB = 98
  const rowR = 150
  return (
    <>
      {active >= 0 && t < 1 ? <rect x={colX(n - 1 - active) - cw / 2} y={20} width={cw} height={150} rx={8} className={tone.tint} /> : null}
      {[...as.padStart(n, ' ')].map((d, i) => (
        <text key={`a${i}`} x={colX(i)} y={rowA} textAnchor="middle" fontSize={fs} className="fill-fg font-display font-semibold">
          {d.trim()}
        </text>
      ))}
      <text x={left + cw / 2} y={rowB} textAnchor="middle" fontSize={fs} className="fill-fg font-display font-semibold">
        {a.op}
      </text>
      {[...bs.padStart(n, ' ')].map((d, i) => (
        <text key={`b${i}`} x={colX(i)} y={rowB} textAnchor="middle" fontSize={fs} className="fill-fg font-display font-semibold">
          {d.trim()}
        </text>
      ))}
      <rect x={left + 4} y={rowB + 12} width={cw * (n + 1) - 8} height={4} rx={2} className="fill-fg" />
      {ca.map((c, k) => {
        if (!c || k + 1 >= n) return null
        const p = seg(shown, k, k + 0.6)
        return (
          <text key={`c${k}`} x={colX(n - 1 - (k + 1))} y={26} textAnchor="middle" fontSize={fs * 0.55} className="fill-english font-display font-bold" opacity={p}>
            1
          </text>
        )
      })}
      {[...rs].map((d, i) => {
        const fromRight = rs.length - 1 - i
        const p = fromRight < visible ? seg(shown, fromRight, fromRight + 0.7) : 0
        return (
          <text key={`r${i}`} x={colX(n - rs.length + i)} y={rowR + (1 - ease(p)) * 14} textAnchor="middle" fontSize={fs} opacity={p} className="fill-fg font-display font-bold">
            {d}
          </text>
        )
      })}
    </>
  )
}

function Bar({ a, t, tone }: { a: Extract<Anim, { k: 'bar' }>; t: number; tone: Tone }): ReactElement {
  const W = 320
  const x0 = 20
  const n = a.parts.length
  const raw = a.parts.map((p) => Math.max(0.0001, p.v) / Math.max(1e-6, a.total))
  const min = 26 / W
  const bumped = raw.map((r) => Math.max(r, min))
  const sum = bumped.reduce((s, r) => s + r, 0)
  const widths = bumped.map((r) => (r / sum) * W)
  let acc = x0
  const y = 78
  const h = 48
  const braceP = ease(seg(t, 0, 0.2))
  const totalLabel = `${money(a.total, a.cur)}${a.unit ? ` ${a.unit}` : ''}`
  const partsView = a.parts.map((p, i) => {
    const w = widths[i]!
    const x = acc
    acc += w
    const win0 = 0.15 + (i / n) * 0.65
    const win1 = 0.15 + ((i + 1) / n) * 0.65
    const grow = ease(seg(t, win0, win1))
    const labelP = seg(t, win1 - 0.05, win1 + 0.08)
    const solved = p.q ? seg(t, 0.88, 1) : 1
    const showValue = !p.q || solved > 0.5
    return (
      <g key={i}>
        <rect x={x} y={y} width={w * grow} height={h} rx={6} className={`${p.q ? 'fill-star' : i % 2 === 0 ? tone.tint : tone.tint} stroke-fg`} strokeWidth={2.5} strokeDasharray={p.q && solved < 0.5 ? '6 4' : undefined} />
        <text x={x + w / 2} y={y + h / 2 + 8} textAnchor="middle" fontSize={w < 44 ? 14 : 22} className="fill-fg font-display font-bold" opacity={labelP}>
          {showValue ? money(p.v, a.cur) : '?'}
        </text>
        {p.label ? (
          <text x={x + w / 2} y={y + h + 22} textAnchor="middle" fontSize={13} className="fill-fg-muted font-semibold" opacity={labelP}>
            {p.label}
          </text>
        ) : null}
      </g>
    )
  })
  return (
    <>
      <g opacity={braceP}>
        <path d={`M${x0} 64 V54 H${x0 + W * braceP} V64`} fill="none" className="stroke-fg" strokeWidth={2.5} strokeLinejoin="round" />
        <text x={180} y={42} textAnchor="middle" fontSize={22} className="fill-fg font-display font-bold">
          {totalLabel}
        </text>
      </g>
      {partsView}
    </>
  )
}

function niceStep(range: number): number {
  const base = [1, 2, 5]
  for (let e = 0; e < 8; e++) for (const b of base) if (range / (b * 10 ** e) <= 10) return b * 10 ** e
  return range
}

function Line({ a, t, tone }: { a: Extract<Anim, { k: 'line' }>; t: number; tone: Tone }): ReactElement {
  const x0 = 24
  const W = 312
  const range = a.max - a.min
  const xOf = (v: number) => x0 + ((v - a.min) / range) * W
  const step = niceStep(range)
  const ticks: number[] = []
  for (let v = Math.ceil(a.min / step) * step; v <= a.max + 1e-9; v += step) ticks.push(Number(v.toFixed(6)))
  const y = 120
  const stops = [a.start]
  for (const j of a.jumps) stops.push(stops[stops.length - 1]! + j)
  const n = a.jumps.length
  const startP = seg(t, 0, 0.12)
  return (
    <>
      <line x1={x0} y1={y} x2={x0 + W} y2={y} className="stroke-fg" strokeWidth={3} strokeLinecap="round" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={xOf(v)} y1={y - 7} x2={xOf(v)} y2={y + 7} className="stroke-fg" strokeWidth={2} />
          <text x={xOf(v)} y={y + 26} textAnchor="middle" fontSize={ticks.length > 8 ? 12 : 14} className="fill-fg-muted font-semibold tabular-nums">
            {fmt(v)}
          </text>
        </g>
      ))}
      {a.jumps.map((j, i) => {
        const from = xOf(stops[i]!)
        const to = xOf(stops[i + 1]!)
        const p = ease(seg(t, 0.12 + (i / n) * 0.78, 0.12 + ((i + 1) / n) * 0.78))
        const mid = (from + to) / 2
        const lift = Math.min(70, 28 + Math.abs(to - from) * 0.18)
        return (
          <g key={i}>
            <path d={`M${from} ${y} Q${mid} ${y - lift * 2} ${to} ${y}`} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} className={tone.stroke} strokeWidth={4} strokeLinecap="round" />
            <text x={mid} y={y - lift - 6} textAnchor="middle" fontSize={20} className="fill-fg font-display font-bold" opacity={p}>
              {j > 0 ? '+' : '-'}
              {fmt(Math.abs(j))}
            </text>
            <circle cx={to} cy={y} r={9} className="fill-star stroke-fg" strokeWidth={2.5} opacity={p > 0.98 ? 1 : 0} />
          </g>
        )
      })}
      <circle cx={xOf(a.start)} cy={y} r={9} className={`${tone.solid} stroke-fg`} strokeWidth={2.5} opacity={startP} />
      <text x={xOf(a.start)} y={y + 52} textAnchor="middle" fontSize={16} className="fill-fg font-display font-bold" opacity={startP}>
        {fmt(a.start)}
      </text>
      {t > 0.98 ? (
        <text x={xOf(stops[stops.length - 1]!)} y={y + 52} textAnchor="middle" fontSize={16} className="fill-fg font-display font-bold">
          {fmt(stops[stops.length - 1]!)}
        </text>
      ) : null}
    </>
  )
}

function Seq({ a, t, tone }: { a: Extract<Anim, { k: 'seq' }>; t: number; tone: Tone }): ReactElement {
  const n = a.items.length
  const perRow = n > 7 ? Math.ceil(n / 2) : n
  const rows = Math.ceil(n / perRow)
  const cell = Math.min(48, 320 / perRow)
  const r = cell * 0.4
  return (
    <>
      {a.items.map((item, i) => {
        const row = Math.floor(i / perRow)
        const col = i % perRow
        const inRow = Math.min(perRow, n - row * perRow)
        const cx = 180 - (inRow * cell) / 2 + cell * col + cell / 2
        const cy = (rows === 1 ? 90 : 56 + row * 64)
        const p = ease(seg(t, (i / n) * 0.85, (i / n) * 0.85 + 0.15))
        const last = i === n - 1
        return (
          <g key={i} transform={`translate(${cx} ${cy}) scale(${lerp(0.3, 1, p)})`} opacity={p}>
            <circle r={r} className={`${last ? 'fill-star' : tone.tint} stroke-fg`} strokeWidth={2.5} />
            <text y={r * 0.32} textAnchor="middle" fontSize={item.length > 3 ? r * 0.7 : r * 0.95} className="fill-fg font-display font-bold tabular-nums">
              {item}
            </text>
          </g>
        )
      })}
    </>
  )
}

function Lines({ a, t }: { a: Extract<Anim, { k: 'lines' }>; t: number }): ReactElement {
  const n = a.lines.length
  return (
    <>
      {a.lines.map((line, i) => {
        const p = ease(seg(t, (i / n) * 0.85, (i / n) * 0.85 + 0.15))
        const tick = seg(t, (i / n) * 0.85 + 0.1, (i / n) * 0.85 + 0.22)
        const y = 34 + i * 30
        return (
          <g key={i} opacity={p} transform={`translate(${(1 - p) * -14} 0)`}>
            <text x={52} y={y + 8} fontSize={line.length > 36 ? 15 : 20} className="fill-fg font-display font-semibold">
              {line}
            </text>
            <circle cx={28} cy={y} r={13} className="fill-success-50 stroke-success" strokeWidth={2.5} opacity={tick} />
            <path d={`M21 ${y} L26.5 ${y + 6} L35 ${y - 6}`} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - tick} className="stroke-success" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )
      })}
    </>
  )
}

const DURATION: Record<Anim['k'], number> = { combine: 1500, column: 2600, bar: 2200, line: 2200, seq: 2000, lines: 2400 }

export default function AnimStage({ anim, subject, reduced }: { anim: Anim; subject: Subject; reduced: boolean }): ReactElement {
  const t = useProgress(DURATION[anim.k], reduced)
  const tone = TONE[subject]
  return (
    <svg viewBox="0 0 360 190" role="img" aria-label={describeAnim(anim)} className="block h-auto w-full max-w-[380px] select-none">
      {anim.k === 'combine' ? <Combine a={anim} t={t} tone={tone} /> : null}
      {anim.k === 'column' ? <Column a={anim} t={t} tone={tone} /> : null}
      {anim.k === 'bar' ? <Bar a={anim} t={t} tone={tone} /> : null}
      {anim.k === 'line' ? <Line a={anim} t={t} tone={tone} /> : null}
      {anim.k === 'seq' ? <Seq a={anim} t={t} tone={tone} /> : null}
      {anim.k === 'lines' ? <Lines a={anim} t={t} /> : null}
    </svg>
  )
}
