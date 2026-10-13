import type { ReactNode } from 'react'
import { IconGlyph } from '../icons'
import { TONES, type Tone } from '../palette'
import { SW2, Txt, r2, type Drawn, type Spec } from './kit'

/**
 * Scene: gambar bebas dari bentuk dasar. Kotak gambar persis width x height tanpa bingkai tambahan,
 * jadi persen dari lebar dan tinggi (area ketuk dan titik label di soal) jatuh tepat di gambar.
 * Warna hanya dari TONES. fill 'light' memakai latar tipis, 'solid' memakai warna garis.
 */

type Shape = Spec<'scene'>['shapes'][number]

function paint(tone: Tone | undefined, fill: 'none' | 'light' | 'solid' | undefined): { stroke: string; fill: string } {
  const t = TONES[tone ?? 'ink']
  const mode = fill ?? 'light'
  return { stroke: t.stroke, fill: mode === 'none' ? 'none' : mode === 'solid' ? t.stroke : t.fill }
}

function drawShape(sh: Shape, key: number): ReactNode {
  switch (sh.t) {
    case 'rect': {
      const c = paint(sh.tone, sh.fill)
      return <rect key={key} x={r2(sh.x)} y={r2(sh.y)} width={r2(sh.w)} height={r2(sh.h)} rx={sh.r ?? 0} fill={c.fill} stroke={c.stroke} strokeWidth={SW2} />
    }
    case 'circle': {
      const c = paint(sh.tone, sh.fill)
      return <circle key={key} cx={r2(sh.cx)} cy={r2(sh.cy)} r={r2(sh.r)} fill={c.fill} stroke={c.stroke} strokeWidth={SW2} />
    }
    case 'ellipse': {
      const c = paint(sh.tone, sh.fill)
      return (
        <ellipse
          key={key}
          cx={r2(sh.cx)}
          cy={r2(sh.cy)}
          rx={r2(sh.rx)}
          ry={r2(sh.ry)}
          {...(sh.rot ? { transform: `rotate(${sh.rot} ${r2(sh.cx)} ${r2(sh.cy)})` } : {})}
          fill={c.fill}
          stroke={c.stroke}
          strokeWidth={SW2}
        />
      )
    }
    case 'line': {
      const c = paint(sh.tone, 'none')
      return <line key={key} x1={r2(sh.x1)} y1={r2(sh.y1)} x2={r2(sh.x2)} y2={r2(sh.y2)} stroke={c.stroke} strokeWidth={sh.width ?? 2.5} />
    }
    case 'poly': {
      const c = paint(sh.tone, sh.fill)
      const closed = sh.closed ?? true
      const d = `${sh.points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${r2(x)} ${r2(y)}`).join('')}${closed ? 'Z' : ''}`
      return <path key={key} d={d} fill={closed ? c.fill : 'none'} stroke={c.stroke} strokeWidth={SW2} />
    }
    case 'icon':
      return <IconGlyph key={key} name={sh.icon} x={r2(sh.x)} y={r2(sh.y)} size={sh.size ?? 56} />
    case 'text':
      return (
        <Txt key={key} x={sh.x} y={sh.y} size={sh.size ?? 16} anchor={sh.anchor ?? 'middle'} fill={TONES[sh.tone ?? 'ink'].stroke} weight={700}>
          {sh.text}
        </Txt>
      )
  }
}

export function drawScene(s: Spec<'scene'>): Drawn {
  return {
    w: s.width,
    h: s.height,
    el: <g>{s.shapes.map((sh, i) => drawShape(sh, i))}</g>,
  }
}
