import type { ReactNode } from 'react'
import { IconGlyph } from '../icons'
import { BORDER, DIVIDER, INK, MATH_50, WHITE } from '../palette'
import {
  clamp, fmt, isBlank, Lines, MissingBox, niceStep, PAD, r2, snap, decimals, strongFill, SW, SW1, SW2, textWidth, Txt, wrapText,
  type Ctx, type Drawn, type Spec,
} from './kit'

/** Ukuran label grafik. */
const FS = 16

/** Hitung skala sumbu nilai: langkah, nilai tertinggi, dan label setiap berapa garis. */
function valueAxis(vmax: number, stepIn: number | undefined, maxIn: number | undefined): { step: number; top: number; count: number } {
  let step = stepIn && stepIn > 0 ? stepIn : niceStep(maxIn && maxIn > 0 ? maxIn : Math.max(vmax, 1), 8)
  let top = maxIn && maxIn > 0 ? maxIn : Math.max(step, Math.ceil(vmax / step - 1e-9) * step)
  if (top < vmax) top = Math.ceil(vmax / step - 1e-9) * step
  let count = Math.round(top / step)
  if (count > 50) {
    step = niceStep(top, 10)
    count = Math.ceil(top / step - 1e-9)
    top = count * step
  }
  return { step, top, count: Math.max(1, count) }
}

export function drawBars(s: Spec<'bars'>): Drawn {
  const n = Math.max(1, Math.min(s.categories.length, s.values.length))
  const cats = s.categories.slice(0, n)
  const vals = s.values.slice(0, n).map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0))
  const { step, top, count } = valueAxis(Math.max(...vals, 0), s.step, s.axisMax)
  const dp = Math.min(4, decimals(step))
  const fill = strongFill(s.tone)
  const horizontal = s.horizontal ?? false
  const tickLabels = Array.from({ length: count + 1 }, (_, i) => snap(Math.min(i * step, top), dp))
  if (tickLabels[tickLabels.length - 1]! < top) tickLabels.push(top)
  const parts: ReactNode[] = []
  const titleH = s.title ? 32 : 0

  if (!horizontal) {
    const yLabW = Math.max(...tickLabels.map((v) => textWidth(fmt(v), FS, 600)))
    const maxSlot = clamp(Math.floor(560 / n), 58, 112)
    // ukuran huruf kategori turun bila kata terpanjang tidak muat di slotnya
    const longestWord = (size: number): number => Math.max(...cats.flatMap((c) => c.split(/\s+/).map((w) => textWidth(w, size, 600))))
    const catFS = [FS, 15, 14, 13].find((f) => longestWord(f) + 10 <= maxSlot) ?? 12
    const catLines = cats.map((c) => wrapText(c, maxSlot - 10, catFS, 600).slice(0, 3))
    const catW = Math.max(...catLines.flat().map((l) => textWidth(l, catFS, 600)))
    const slot = clamp(catW + 14, 58, maxSlot)
    const barW = Math.min(46, slot * 0.6)
    // tinggi grafik mengikuti lebarnya supaya tidak gepeng
    const plotH = clamp(Math.max(count * 28, n * slot * 0.6), 168, 260)
    const every = Math.max(1, Math.ceil(22 / (plotH / count)))
    const x0 = PAD + (s.yLabel ? 30 : 0) + yLabW + 12
    const y0 = PAD + titleH + 12
    const yB = y0 + plotH
    const plotW = n * slot + 8
    const yOf = (v: number): number => yB - (v / top) * plotH
    tickLabels.forEach((v, i) => {
      const y = yOf(v)
      if (i > 0) parts.push(<line key={`g${i}`} x1={x0} y1={r2(y)} x2={r2(x0 + plotW)} y2={r2(y)} stroke={DIVIDER} strokeWidth={SW1} />)
      if (i % every === 0 || i === tickLabels.length - 1) {
        parts.push(<line key={`k${i}`} x1={x0 - 6} y1={r2(y)} x2={x0} y2={r2(y)} stroke={INK} strokeWidth={SW2} />)
        parts.push(<Txt key={`v${i}`} x={x0 - 10} y={y} size={FS} anchor="end">{fmt(v)}</Txt>)
      }
    })
    vals.forEach((v, i) => {
      const cx = x0 + 4 + slot * i + slot / 2
      const y = yOf(Math.min(v, top))
      if (v > 0) parts.push(<rect key={`b${i}`} x={r2(cx - barW / 2)} y={r2(y)} width={r2(barW)} height={r2(yB - y)} fill={fill} stroke={INK} strokeWidth={SW2} />)
      const lines = catLines[i]!
      lines.forEach((line, li) => parts.push(<Txt key={`c${i}-${li}`} x={cx} y={yB + 19 + li * 20} size={catFS}>{line}</Txt>))
    })
    parts.push(<path key="axes" d={`M${x0} ${y0 - 6}V${r2(yB)}H${r2(x0 + plotW)}`} fill="none" stroke={INK} strokeWidth={SW} />)
    if (s.yLabel) {
      const ly = y0 + plotH / 2
      parts.push(
        <g key="yl" transform={`rotate(-90 ${PAD + 10} ${r2(ly)})`}>
          <Txt x={PAD + 10} y={ly} size={FS} weight={700}>{s.yLabel}</Txt>
        </g>,
      )
    }
    const maxLines = Math.max(...catLines.map((l) => l.length))
    const w = Math.max(x0 + plotW + PAD, s.title ? textWidth(s.title, 16, 700) + PAD * 2 : 0)
    const h = yB + 10 + maxLines * 20 + PAD
    if (s.title) parts.push(<ChartTitle key="t" text={s.title} centre={x0 + plotW / 2} width={w} />)
    return { w: Math.ceil(w), h: Math.ceil(h), el: <g>{parts}</g> }
  }

  // batang mendatar
  const plotW = clamp(count * 40, 220, 340)
  const every = Math.max(1, Math.ceil((Math.max(...tickLabels.map((v) => textWidth(fmt(v), FS, 600))) + 10) / (plotW / count)))
  const catLines = cats.map((c) => wrapText(c, 150, FS, 600).slice(0, 2))
  const catW = Math.min(150, Math.max(...catLines.flat().map((l) => textWidth(l, FS, 600))))
  const slot = 44
  const barH = 26
  const x0 = PAD + catW + 14
  const y0 = PAD + titleH + 6
  const yB = y0 + n * slot + 4
  const xOf = (v: number): number => x0 + (v / top) * plotW
  tickLabels.forEach((v, i) => {
    const x = xOf(v)
    if (i > 0) parts.push(<line key={`g${i}`} x1={r2(x)} y1={y0} x2={r2(x)} y2={r2(yB)} stroke={DIVIDER} strokeWidth={SW1} />)
    if (i % every === 0 || i === tickLabels.length - 1) {
      parts.push(<line key={`k${i}`} x1={r2(x)} y1={r2(yB)} x2={r2(x)} y2={r2(yB + 6)} stroke={INK} strokeWidth={SW2} />)
      parts.push(<Txt key={`v${i}`} x={x} y={yB + 18} size={FS}>{fmt(v)}</Txt>)
    }
  })
  vals.forEach((v, i) => {
    const cy = y0 + 4 + i * slot + slot / 2
    const x = xOf(Math.min(v, top))
    if (v > 0) parts.push(<rect key={`b${i}`} x={x0} y={r2(cy - barH / 2)} width={r2(x - x0)} height={barH} fill={fill} stroke={INK} strokeWidth={SW2} />)
    parts.push(<Lines key={`c${i}`} x={x0 - 10} y={cy} lines={catLines[i]!} size={FS} anchor="end" lineHeight={18} />)
  })
  parts.push(<path key="axes" d={`M${x0} ${y0}V${r2(yB)}H${r2(x0 + plotW + 6)}`} fill="none" stroke={INK} strokeWidth={SW} />)
  let h = yB + 30 + PAD
  if (s.yLabel) {
    parts.push(<Txt key="yl" x={x0 + plotW / 2} y={yB + 44} size={FS} weight={700}>{s.yLabel}</Txt>)
    h += 26
  }
  const w = Math.max(
    x0 + plotW + Math.max(...tickLabels.map((v) => textWidth(fmt(v), FS, 600))) / 2 + PAD + 6,
    s.title ? textWidth(s.title, 16, 700) + PAD * 2 : 0,
  )
  if (s.title) parts.push(<ChartTitle key="t" text={s.title} centre={x0 + plotW / 2} width={w} />)
  return { w: Math.ceil(w), h: Math.ceil(h), el: <g>{parts}</g> }
}

/** Judul grafik di atas area plot, digeser bila perlu supaya tidak keluar dari figur. */
function ChartTitle({ text, centre, width }: { text: string; centre: number; width: number }): ReactNode {
  const half = textWidth(text, 16, 700) / 2
  const x = clamp(centre, PAD + half, width - PAD - half)
  return <Txt x={x} y={PAD + 10} size={16} weight={700}>{text}</Txt>
}

export function drawPictogram(s: Spec<'pictogram'>, ctx: Ctx): Drawn {
  const rows = s.rows.slice(0, 7)
  const counts = rows.map((r) => (Number.isFinite(r.count) ? clamp(r.count, 0, 20) : 0))
  const maxCount = Math.max(1, ...counts.map((c) => Math.ceil(c)))
  // lebih dari 12 ikon: dua baris ikon per baris tabel supaya figur tidak terlalu lebar
  const perLine = maxCount > 12 ? Math.ceil(maxCount / 2) : maxCount
  const lines = maxCount > 12 ? 2 : 1
  const icon = perLine <= 8 ? 34 : 30
  const step = icon + 6
  const labels = rowLabels(rows.map((r) => r.label))
  const labelW = labels.w
  const iconsW = Math.max(140, perLine * step + 22)
  const rowH = Math.max(lines * step - 6 + 18, labels.lines.some((l) => l.length > 1) ? 50 : 0)
  const titleH = s.title ? 32 : 0
  const x0 = PAD
  const y0 = PAD + titleH
  const tableW = labelW + iconsW
  const tableH = rows.length * rowH
  const parts: ReactNode[] = []
  const defs: ReactNode[] = []
  parts.push(<rect key="bg" x={x0} y={y0} width={tableW} height={tableH} rx={10} fill={WHITE} />)
  rows.forEach((_row, i) => {
    const y = y0 + i * rowH
    const cy = y + rowH / 2
    if (i > 0) parts.push(<line key={`d${i}`} x1={x0} y1={y} x2={x0 + tableW} y2={y} stroke={BORDER} strokeWidth={SW1} />)
    parts.push(<Lines key={`l${i}`} x={x0 + 14} y={cy} lines={labels.lines[i]!} anchor="start" lineHeight={19} />)
    const c = counts[i]!
    const full = Math.floor(c + 1e-9)
    const part = c - full
    const top = cy - (lines * step - 6) / 2
    const slot = (k: number): [number, number] => [x0 + labelW + 12 + (k % perLine) * step, top + Math.floor(k / perLine) * step]
    for (let k = 0; k < full; k++) {
      const [ix, iy] = slot(k)
      parts.push(<IconGlyph key={`i${i}-${k}`} name={s.icon} x={ix} y={iy} size={icon} />)
    }
    if (part > 0.01) {
      const id = `${ctx.uid}-p${i}`
      const [px, py] = slot(full)
      defs.push(
        <clipPath key={id} id={id}>
          <rect x={r2(px)} y={r2(py - 2)} width={r2(icon * part)} height={icon + 4} />
        </clipPath>,
      )
      parts.push(
        <g key={`h${i}`} clipPath={`url(#${id})`}>
          <IconGlyph name={s.icon} x={px} y={py} size={icon} />
        </g>,
      )
    }
  })
  parts.push(<line key="col" x1={x0 + labelW} y1={y0} x2={x0 + labelW} y2={y0 + tableH} stroke={BORDER} strokeWidth={SW1} />)
  parts.push(<rect key="frame" x={x0} y={y0} width={tableW} height={tableH} rx={10} fill="none" stroke={INK} strokeWidth={SW2} />)
  // kunci: setiap ikon bernilai `key`
  const keyY = y0 + tableH + 30
  const keyText = `= ${fmt(s.key ?? 1)}`
  const kx = x0 + 4
  const keyW = textWidth('Key:', 16, 700) + 10
  parts.push(<Txt key="kt" x={kx} y={keyY} anchor="start" weight={700}>Key:</Txt>)
  parts.push(<IconGlyph key="ki" name={s.icon} x={kx + keyW} y={keyY - 15} size={30} />)
  parts.push(<Txt key="kv" x={kx + keyW + 38} y={keyY} anchor="start">{keyText}</Txt>)
  if (s.title) parts.push(<Txt key="t" x={x0} y={PAD + 10} anchor="start" weight={700}>{s.title}</Txt>)
  const w = Math.max(x0 + tableW, s.title ? PAD + textWidth(s.title, 16, 700) : 0) + PAD
  return {
    w: Math.ceil(w),
    h: Math.ceil(keyY + 18 + PAD),
    el: (
      <g>
        {defs.length > 0 && <defs>{defs}</defs>}
        {parts}
      </g>
    ),
  }
}

/** Turus: kelompok lima (empat garis tegak dan satu garis miring). */
function tallyMarks(count: number, x0: number, cy: number): { el: ReactNode; end: number } {
  const groups = Math.floor(count / 5)
  const rest = count % 5
  const d: string[] = []
  let x = x0
  const half = 15
  for (let g = 0; g < groups; g++) {
    for (let k = 0; k < 4; k++) d.push(`M${x + k * 9} ${cy - half}V${cy + half}`)
    d.push(`M${x - 6} ${cy + half - 4}L${x + 33} ${cy - half + 4}`)
    x += 27 + 24
  }
  for (let k = 0; k < rest; k++) d.push(`M${x + k * 9} ${cy - half}V${cy + half}`)
  const end = rest > 0 ? x + (rest - 1) * 9 : groups > 0 ? x - 24 + 6 : x0
  return { el: <path d={d.join('')} stroke={INK} strokeWidth={SW} fill="none" />, end }
}

/** Label baris tabel (turus, piktogram): dibungkus paling banyak dua baris selebar 170. */
function rowLabels(labels: string[]): { lines: string[][]; w: number } {
  const lines = labels.map((l) => wrapText(l, 170, 16, 600).slice(0, 2))
  return { lines, w: Math.max(84, ...lines.flat().map((l) => textWidth(l, 16, 600) + 28)) }
}

export function drawTally(s: Spec<'tally'>): Drawn {
  const rows = s.rows.slice(0, 7)
  const labels = rowLabels(rows.map((r) => r.label))
  const labelW = labels.w
  const rowH = 52
  const x0 = PAD
  const y0 = PAD
  const marks = rows.map((r, i) => tallyMarks(Math.max(0, Math.min(40, Math.round(r.count))), x0 + labelW + 22, y0 + i * rowH + rowH / 2))
  const tallyW = Math.max(150, ...marks.map((m) => m.end - (x0 + labelW) + 22))
  const tableW = labelW + tallyW
  const tableH = rows.length * rowH
  return {
    w: Math.ceil(x0 + tableW + PAD),
    h: Math.ceil(y0 + tableH + PAD),
    el: (
      <g>
        <rect x={x0} y={y0} width={tableW} height={tableH} rx={10} fill={WHITE} />
        {rows.map((_r, i) => (
          <g key={i}>
            {i > 0 && <line x1={x0} y1={y0 + i * rowH} x2={x0 + tableW} y2={y0 + i * rowH} stroke={BORDER} strokeWidth={SW1} />}
            <Lines x={x0 + 14} y={y0 + i * rowH + rowH / 2} lines={labels.lines[i]!} anchor="start" lineHeight={19} />
            {marks[i]!.el}
          </g>
        ))}
        <line x1={x0 + labelW} y1={y0} x2={x0 + labelW} y2={y0 + tableH} stroke={BORDER} strokeWidth={SW1} />
        <rect x={x0} y={y0} width={tableW} height={tableH} rx={10} fill="none" stroke={INK} strokeWidth={SW2} />
      </g>
    ),
  }
}

const NUMERIC = /^[−+-]?(\d[\d,.]*|\.\d+)(\s?(%|cm|mm|m|km|kg|g|ml|l|°C|p))?$/

export function drawTable(s: Spec<'table'>): Drawn {
  const head = s.head.slice(0, 7)
  const cols = Math.max(head.length, ...s.rows.map((r) => r.length))
  const rows = s.rows.slice(0, 12).map((r) => Array.from({ length: cols }, (_, c) => r[c] ?? ''))
  const size = 16
  const lh = 21
  const padX = 12
  // lebar sel maksimum menyesuaikan jumlah kolom supaya tabel tetap muat di layar
  const maxCell = clamp(Math.floor(620 / Math.max(1, s.head.length, ...s.rows.map((r) => r.length))) - 24, 64, 190)
  const headCells = Array.from({ length: cols }, (_, c) => head[c] ?? '')
  const wrapCell = (t: string, bold: boolean): string[] => (t ? wrapText(t, maxCell, size, bold ? 700 : 500) : [''])
  const headLines = headCells.map((t) => wrapCell(t, true))
  const bodyLines = rows.map((r) => r.map((t) => (isBlank(t) ? ['?'] : wrapCell(t, false))))
  const colW = Array.from({ length: cols }, (_, c) => {
    const widths = [
      ...headLines[c]!.map((l) => textWidth(l, size, 700)),
      ...bodyLines.flatMap((r) => r[c]!.map((l) => textWidth(l, size, 500))),
    ]
    return Math.max(56, Math.ceil(Math.max(...widths)) + padX * 2)
  })
  const numericCol = Array.from({ length: cols }, (_, c) => rows.length > 0 && rows.every((r) => !r[c] || isBlank(r[c]) || NUMERIC.test(r[c]!.trim())))
  const rowHOf = (lines: string[][]): number => Math.max(44, Math.max(...lines.map((l) => l.length)) * lh + 22)
  const headH = rowHOf(headLines)
  const bodyH = bodyLines.map(rowHOf)
  const capH = s.caption ? 32 : 0
  const x0 = PAD
  const y0 = PAD + capH
  const tableW = colW.reduce((a, b) => a + b, 0)
  const tableH = headH + bodyH.reduce((a, b) => a + b, 0)
  const parts: ReactNode[] = []
  const rx = 10
  parts.push(<rect key="bg" x={x0} y={y0} width={tableW} height={tableH} rx={rx} fill={WHITE} />)
  parts.push(
    <path key="hb" d={`M${x0} ${y0 + headH}V${y0 + rx}Q${x0} ${y0} ${x0 + rx} ${y0}H${x0 + tableW - rx}Q${x0 + tableW} ${y0} ${x0 + tableW} ${y0 + rx}V${y0 + headH}Z`} fill={MATH_50} />,
  )
  const cellText = (lines: string[], c: number, xLeft: number, yTop: number, h: number, bold: boolean, key: string): ReactNode => {
    const w = colW[c]!
    const right = numericCol[c]!
    const ax = right ? xLeft + w - padX : xLeft + padX
    const top = yTop + h / 2 - ((lines.length - 1) * lh) / 2
    return (
      <g key={key}>
        {lines.map((line, li) => (
          <Txt key={li} x={ax} y={top + li * lh} size={size} weight={bold ? 700 : 500} anchor={right ? 'end' : 'start'}>
            {line}
          </Txt>
        ))}
      </g>
    )
  }
  let x = x0
  headLines.forEach((lines, c) => {
    parts.push(cellText(lines, c, x, y0, headH, true, `h${c}`))
    x += colW[c]!
  })
  let y = y0 + headH
  rows.forEach((row, r) => {
    const h = bodyH[r]!
    parts.push(<line key={`rl${r}`} x1={x0} y1={y} x2={x0 + tableW} y2={y} stroke={r === 0 ? INK : BORDER} strokeWidth={r === 0 ? SW2 : SW1} />)
    let cx = x0
    row.forEach((t, c) => {
      if (isBlank(t) && t !== '') {
        parts.push(<MissingBox key={`m${r}-${c}`} cx={cx + colW[c]! / 2} cy={y + h / 2} w={Math.min(44, colW[c]! - 16)} h={28} size={16} />)
      } else {
        parts.push(cellText(bodyLines[r]![c]!, c, cx, y, h, false, `b${r}-${c}`))
      }
      cx += colW[c]!
    })
    y += h
  })
  let cx = x0
  for (let c = 0; c < cols - 1; c++) {
    cx += colW[c]!
    parts.push(<line key={`cl${c}`} x1={cx} y1={y0} x2={cx} y2={y0 + tableH} stroke={BORDER} strokeWidth={SW1} />)
  }
  parts.push(<rect key="frame" x={x0} y={y0} width={tableW} height={tableH} rx={rx} fill="none" stroke={INK} strokeWidth={SW2} />)
  if (s.caption) parts.push(<Txt key="cap" x={x0} y={PAD + 10} anchor="start" weight={700}>{s.caption}</Txt>)
  const w = Math.max(x0 + tableW, s.caption ? PAD + textWidth(s.caption, 16, 700) : 0) + PAD
  return { w: Math.ceil(w), h: Math.ceil(y0 + tableH + PAD), el: <g>{parts}</g> }
}
