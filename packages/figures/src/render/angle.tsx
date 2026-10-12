import type { ReactNode } from 'react'
import { INK, MATH, MATH_50, MUTED } from '../palette'
import { clamp, emptyBox, framed, grow, r2, SW, SW1, SW2, textWidth, Txt, type Drawn, type Spec } from './kit'

/** Titik pada sudut `deg` (berlawanan arah jarum jam dari kanan, seperti di buku) dan jarak r dari (0, 0). */
function at(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [r * Math.cos(a), -r * Math.sin(a)]
}

export function drawAngle(s: Spec<'angle'>): Drawn {
  const deg = clamp(Number.isFinite(s.degrees) ? s.degrees : 45, 1, 359)
  const proto = s.showProtractor ?? false
  const P = 200
  const arm = proto ? P + 34 : 150
  const box = emptyBox()
  const parts: ReactNode[] = []
  // angka busur derajat digambar paling akhir supaya tidak tertutup kaki sudut
  const scale: ReactNode[] = []
  grow(box, 0, 0, 8)

  if (proto) {
    const inner = P * 0.42
    parts.push(
      <path
        key="pr"
        d={`M${-P} 0A${P} ${P} 0 0 1 ${P} 0H${r2(inner)}A${r2(inner)} ${r2(inner)} 0 0 0 ${r2(-inner)} 0Z`}
        fill={MATH_50}
        stroke={INK}
        strokeWidth={SW2}
      />,
    )
    const ticks: string[] = []
    const mids: string[] = []
    const bigs: string[] = []
    for (let d = 0; d <= 180; d++) {
      const len = d % 10 === 0 ? 14 : d % 5 === 0 ? 10 : 6
      const [x1, y1] = at(d, P)
      const [x2, y2] = at(d, P - len)
      const seg = `M${r2(x1)} ${r2(y1)}L${r2(x2)} ${r2(y2)}`
      if (d % 10 === 0) bigs.push(seg)
      else if (d % 5 === 0) mids.push(seg)
      else ticks.push(seg)
    }
    parts.push(<path key="t1" d={ticks.join('')} stroke={INK} strokeWidth={0.9} strokeLinecap="butt" />)
    parts.push(<path key="t5" d={mids.join('')} stroke={INK} strokeWidth={1.3} strokeLinecap="butt" />)
    parts.push(<path key="t10" d={bigs.join('')} stroke={INK} strokeWidth={SW1} strokeLinecap="butt" />)
    for (let d = 0; d <= 180; d += 10) {
      // 0 dan 180 sedikit di atas garis dasar supaya tidak tertimpa garis
      const pos = d === 0 ? 4 : d === 180 ? 176 : d
      const [x, y] = at(pos, P - 28)
      scale.push(<Txt key={`o${d}`} x={x} y={y} size={14} weight={600} halo={MATH_50}>{d}</Txt>)
      const [xi, yi] = at(d === 0 ? 5 : d === 180 ? 175 : d, P - 52)
      scale.push(<Txt key={`i${d}`} x={xi} y={yi} size={12} weight={500} fill={MUTED} halo={MATH_50}>{180 - d}</Txt>)
    }
    parts.push(<line key="bl" x1={-P} y1={0} x2={P} y2={0} stroke={INK} strokeWidth={SW2} />)
    grow(box, -P, -P)
    grow(box, P, 0)
  }

  // sektor tipis dan busur
  const large = deg > 180 ? 1 : 0
  const right = deg === 90
  const ra = proto ? 30 : deg < 30 ? 64 : deg > 180 ? 34 : 42
  const [ex, ey] = at(deg, ra)
  if (!proto && !right) {
    parts.push(<path key="sec" d={`M0 0L${ra} 0A${ra} ${ra} 0 ${large} 0 ${r2(ex)} ${r2(ey)}Z`} fill={MATH_50} />)
  }
  if (right) {
    const m = 20
    if (!proto) parts.push(<rect key="sqf" x={0} y={-m} width={m} height={m} fill={MATH_50} />)
    parts.push(<path key="sq" d={`M${m} 0V${-m}H0`} fill="none" stroke={MATH} strokeWidth={SW} />)
  } else {
    parts.push(<path key="arc" d={`M${ra} 0A${ra} ${ra} 0 ${large} 0 ${r2(ex)} ${r2(ey)}`} fill="none" stroke={MATH} strokeWidth={SW} />)
  }
  // label di garis bagi sudut, cukup jauh supaya muat di antara kedua kaki sudut
  let label: { x: number; y: number; w: number } | null = null
  let armLen = arm
  if (s.label) {
    const tw = textWidth(s.label, 18, 700)
    const hh = 18 * 0.375 + 5
    const h = ((deg / 2) * Math.PI) / 180
    const t = (deg * Math.PI) / 180
    let lr = right ? 44 : ra + 16 + Math.max(0, tw / 2 - 6)
    if (!right && deg < 90) {
      lr = Math.max(lr, (hh * Math.cos(t) + (tw / 2) * Math.sin(t)) / Math.sin(h), hh / Math.sin(h))
    }
    // sudut sangat sempit, atau label akan menimpa angka busur derajat: label di luar ujung kaki sudut
    const limit = proto ? P * 0.42 - 12 : 200
    if (lr > limit) {
      const [ex2, ey2] = at(deg / 2, arm + 10 + tw / 2)
      label = { x: ex2, y: ey2, w: tw }
    } else {
      const [lx, ly] = at(deg / 2, lr)
      label = { x: lx, y: ly, w: tw }
      armLen = Math.max(arm, lr * Math.cos(h) + tw / 2 + 18)
    }
  }
  const [x2, y2] = at(deg, armLen)
  parts.push(<line key="a1" x1={0} y1={0} x2={r2(armLen)} y2={0} stroke={INK} strokeWidth={SW + 0.5} />)
  parts.push(<line key="a2" x1={0} y1={0} x2={r2(x2)} y2={r2(y2)} stroke={INK} strokeWidth={SW + 0.5} />)
  parts.push(<circle key="v" cx={0} cy={0} r={4.5} fill={INK} />)
  grow(box, armLen, 0, 4)
  grow(box, x2, y2, 4)
  parts.push(...scale)
  if (label && s.label) {
    parts.push(<Txt key="lab" x={label.x} y={label.y} size={18} weight={700} fill={INK} halo>{s.label}</Txt>)
    grow(box, label.x - label.w / 2, label.y - 10)
    grow(box, label.x + label.w / 2, label.y + 10)
  }
  return framed(box, <g>{parts}</g>)
}
