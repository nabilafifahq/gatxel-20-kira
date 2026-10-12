import type { ReactNode } from 'react'
import { INK, MATH, MATH_50, WHITE } from '../palette'
import { int, PAD, r2, SW, Txt, type Drawn, type Spec } from './kit'

/** Sudut jarum (derajat dari angka 12, searah jarum jam). */
export function handAngles(h: number, m: number): { hour: number; minute: number } {
  const hh = ((h % 12) + 12) % 12
  return { hour: (hh + m / 60) * 30, minute: m * 6 }
}

/** Teks jam digital: 3:30, 10:05, 15:30, 00:05. */
export function digitalText(h: number, m: number): string {
  const mm = String(m).padStart(2, '0')
  if (h === 0) return `00:${mm}`
  return `${h}:${mm}`
}

export function drawClock(s: Spec<'clock'>): Drawn {
  const h = int(s.h, 0, 23)
  const m = int(s.m, 0, 59)
  const showNumbers = s.showNumbers ?? true
  const digital = s.digital ?? false
  const R = 100
  const rim = 11
  const size = (R + rim) * 2 + PAD * 2
  const cx = size / 2
  const cy = PAD + R + rim
  const at = (deg: number, r: number): [number, number] => {
    const a = (deg * Math.PI) / 180
    return [cx + r * Math.sin(a), cy - r * Math.cos(a)]
  }
  const ticks: ReactNode[] = []
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0
    const [x1, y1] = at(i * 6, R - 5)
    const [x2, y2] = at(i * 6, major ? R - 17 : R - 11)
    ticks.push(<line key={i} x1={r2(x1)} y1={r2(y1)} x2={r2(x2)} y2={r2(y2)} stroke={INK} strokeWidth={major ? 3 : 1.5} />)
  }
  const numbers: ReactNode[] = []
  if (showNumbers) {
    for (let k = 1; k <= 12; k++) {
      const [x, y] = at(k * 30, R - 33)
      numbers.push(<Txt key={k} x={x} y={y} size={20} weight={700} halo>{k}</Txt>)
    }
  }
  const { hour, minute } = handAngles(h, m)
  const [hx, hy] = at(hour, R * 0.5)
  const [mx, my] = at(minute, R * 0.8)
  const [htx, hty] = at(hour + 180, 10)
  const [mtx, mty] = at(minute + 180, 12)
  const digitalH = digital ? 64 : 0
  const height = cy + R + rim + PAD + digitalH
  const text = digitalText(h, m)
  return {
    w: size,
    h: height,
    el: (
      <g>
        <circle cx={cx} cy={cy} r={R + rim} fill={MATH_50} stroke={INK} strokeWidth={SW} />
        <circle cx={cx} cy={cy} r={R} fill={WHITE} stroke={INK} strokeWidth={SW} />
        {ticks}
        <line data-hand="hour" x1={r2(htx)} y1={r2(hty)} x2={r2(hx)} y2={r2(hy)} stroke={INK} strokeWidth={8} />
        <line data-hand="minute" x1={r2(mtx)} y1={r2(mty)} x2={r2(mx)} y2={r2(my)} stroke={MATH} strokeWidth={5} />
        {/* angka di atas jarum dengan halo putih supaya tidak tertutup jarum menit */}
        {numbers}
        <circle cx={cx} cy={cy} r={7} fill={INK} />
        <circle cx={cx} cy={cy} r={2.5} fill={WHITE} />
        {digital && (
          <g>
            <rect x={r2(cx - 66)} y={r2(cy + R + rim + 14)} width={132} height={50} rx={10} fill={WHITE} stroke={INK} strokeWidth={SW} />
            <Txt x={cx} y={cy + R + rim + 39} size={36} weight={600} display>
              {text}
            </Txt>
          </g>
        )}
      </g>
    ),
  }
}
