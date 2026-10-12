import type { ReactNode } from 'react'
import { DIVIDER, INK, MATH_50, SCIENCE_50, WHITE } from '../palette'
import { isBlank, Lines, MissingBox, PAD, r2, SW, SW2, textWidth, Txt, wrapText, type Drawn, type Spec } from './kit'

export function drawVenn(s: Spec<'venn'>): Drawn {
  const r = 104
  const d = 124
  const items = (s.items ?? []).slice(0, 16)
  const by = { a: [] as string[], b: [] as string[], both: [] as string[], none: [] as string[] }
  for (const it of items) by[it.region].push(it.text)
  const crowded = Math.max(by.a.length, by.b.length, by.both.length) > 5
  const size = crowded || items.some((it) => textWidth(it.text, 16, 600) > 84) ? 14 : 16
  const lh = size + 8
  const labelA = wrapText(s.sets[0], 170, 16, 700)
  const labelB = wrapText(s.sets[1], 170, 16, 700)
  const labelLines = Math.max(labelA.length, labelB.length)
  const left = PAD
  const cxA = left + 22 + r
  const cxB = cxA + d
  const right = cxB + r + 22
  const labelTop = PAD + 18
  const cy = labelTop + labelLines * 20 + 8 + r
  const circleBottom = cy + r
  const noneRows: string[][] = []
  if (by.none.length) {
    let row: string[] = []
    let wsum = 0
    for (const t of by.none) {
      const tw = textWidth(t, size, 600) + 20
      if (row.length && wsum + tw > right - left - 24) {
        noneRows.push(row)
        row = []
        wsum = 0
      }
      row.push(t)
      wsum += tw
    }
    if (row.length) noneRows.push(row)
  }
  const bottom = circleBottom + 16 + noneRows.length * (lh + 4) + (noneRows.length ? 8 : 0)
  const hc = Math.sqrt(r * r - (d / 2) * (d / 2))
  const mx = (cxA + cxB) / 2
  const lens = `M${r2(mx)} ${r2(cy - hc)}A${r} ${r} 0 0 1 ${r2(mx)} ${r2(cy + hc)}A${r} ${r} 0 0 1 ${r2(mx)} ${r2(cy - hc)}Z`
  const column = (list: string[], x: number): ReactNode[] => {
    if (list.length === 0) return []
    const cols = list.length > 5 ? 2 : 1
    const per = Math.ceil(list.length / cols)
    const colW = Math.max(...list.map((t) => textWidth(t, size, 600))) + 10
    return list.map((t, i) => {
      const c = Math.floor(i / per)
      const k = i % per
      const inCol = Math.min(per, list.length - c * per)
      const xx = cols === 1 ? x : x + (c === 0 ? -colW / 2 : colW / 2)
      const yy = cy - ((inCol - 1) * lh) / 2 + k * lh
      return isBlank(t)
        ? <MissingBox key={`${x}-${i}`} cx={xx} cy={yy} w={30} h={lh - 2} size={size} />
        : <Txt key={`${x}-${i}`} x={xx} y={yy} size={size}>{t}</Txt>
    })
  }
  const parts: ReactNode[] = []
  parts.push(<rect key="u" x={left} y={PAD} width={right - left} height={bottom - PAD} rx={14} fill={WHITE} stroke={INK} strokeWidth={SW2} />)
  parts.push(<circle key="a" cx={cxA} cy={cy} r={r} fill={MATH_50} />)
  parts.push(<circle key="b" cx={cxB} cy={cy} r={r} fill={SCIENCE_50} />)
  parts.push(<path key="lens" d={lens} fill={DIVIDER} />)
  parts.push(<circle key="ao" cx={cxA} cy={cy} r={r} fill="none" stroke={INK} strokeWidth={SW} />)
  parts.push(<circle key="bo" cx={cxB} cy={cy} r={r} fill="none" stroke={INK} strokeWidth={SW} />)
  parts.push(<Lines key="la" x={cxA - 24} y={labelTop + ((labelLines - 1) * 20) / 2} lines={labelA} weight={700} lineHeight={20} />)
  parts.push(<Lines key="lb" x={cxB + 24} y={labelTop + ((labelLines - 1) * 20) / 2} lines={labelB} weight={700} lineHeight={20} />)
  parts.push(...column(by.a, cxA - r * 0.42))
  parts.push(...column(by.b, cxB + r * 0.42))
  parts.push(...column(by.both, mx))
  noneRows.forEach((row, ri) => {
    const widths = row.map((t) => textWidth(t, size, 600) + 20)
    const total = widths.reduce((a, b) => a + b, 0)
    let x = (left + right) / 2 - total / 2
    row.forEach((t, i) => {
      const xx = x + widths[i]! / 2
      const yy = circleBottom + 14 + lh / 2 + ri * (lh + 4)
      parts.push(isBlank(t)
        ? <MissingBox key={`n${ri}-${i}`} cx={xx} cy={yy} w={30} h={lh - 2} size={size} />
        : <Txt key={`n${ri}-${i}`} x={xx} y={yy} size={size}>{t}</Txt>)
      x += widths[i]!
    })
  })
  return { w: Math.ceil(right + PAD), h: Math.ceil(bottom + PAD), el: <g>{parts}</g> }
}

export function drawCarroll(s: Spec<'carroll'>): Drawn {
  const size = 17
  const head = 16
  const colLabels = s.cols.map((c) => wrapText(c, 160, head, 700))
  const rowLabels = s.rows.map((c) => wrapText(c, 140, head, 700))
  const rowHeadW = Math.max(96, ...rowLabels.flat().map((l) => textWidth(l, head, 700))) + 24
  const cells = s.cells.map((list) => list.slice(0, 20))
  // lebar kolom: label kolom atau isian, paling sedikit 150
  const colW = [0, 1].map((c) => {
    const labelW = Math.max(...colLabels[c]!.map((l) => textWidth(l, head, 700))) + 24
    const itemW = Math.max(0, ...[cells[c]!, cells[c + 2]!].flat().map((t) => textWidth(t, size, 600) + 28))
    return Math.max(150, labelW, Math.min(260, itemW))
  })
  // susun isian sel ke baris-baris
  const flow = (list: string[], width: number): string[][] => {
    const rows: string[][] = []
    let row: string[] = []
    let used = 0
    for (const t of list) {
      const tw = textWidth(t, size, 600) + 20
      if (row.length && used + tw > width - 16) {
        rows.push(row)
        row = []
        used = 0
      }
      row.push(t)
      used += tw
    }
    if (row.length) rows.push(row)
    return rows
  }
  const cellRows = cells.map((list, i) => flow(list, colW[i % 2]!))
  const headH = Math.max(46, Math.max(...colLabels.map((l) => l.length)) * 20 + 24)
  const rowH = [0, 1].map((r) => Math.max(68, Math.max(cellRows[r * 2]!.length, cellRows[r * 2 + 1]!.length, rowLabels[r]!.length * 0.7) * 30 + 24))
  const x0 = PAD
  const y0 = PAD
  const xs = [x0 + rowHeadW, x0 + rowHeadW + colW[0]!, x0 + rowHeadW + colW[0]! + colW[1]!]
  const ys = [y0 + headH, y0 + headH + rowH[0]!, y0 + headH + rowH[0]! + rowH[1]!]
  const parts: ReactNode[] = []
  parts.push(<rect key="hc" x={xs[0]} y={y0} width={xs[2]! - xs[0]!} height={headH} fill={MATH_50} stroke={INK} strokeWidth={SW2} />)
  parts.push(<rect key="hr" x={x0} y={ys[0]} width={rowHeadW} height={ys[2]! - ys[0]!} fill={MATH_50} stroke={INK} strokeWidth={SW2} />)
  parts.push(<rect key="body" x={xs[0]} y={ys[0]} width={xs[2]! - xs[0]!} height={ys[2]! - ys[0]!} fill={WHITE} stroke={INK} strokeWidth={SW2} />)
  parts.push(<path key="grid" d={`M${xs[1]} ${y0}V${ys[2]}M${x0} ${ys[1]}H${xs[2]}`} stroke={INK} strokeWidth={SW2} />)
  colLabels.forEach((lines, c) => parts.push(<Lines key={`c${c}`} x={(xs[c]! + xs[c + 1]!) / 2} y={y0 + headH / 2} lines={lines} size={head} weight={700} lineHeight={20} />))
  rowLabels.forEach((lines, r) => parts.push(<Lines key={`r${r}`} x={x0 + rowHeadW / 2} y={(ys[r]! + ys[r + 1]!) / 2} lines={lines} size={head} weight={700} lineHeight={20} />))
  cellRows.forEach((rows, i) => {
    const c = i % 2
    const r = Math.floor(i / 2)
    const cx = (xs[c]! + xs[c + 1]!) / 2
    const cy = (ys[r]! + ys[r + 1]!) / 2
    rows.forEach((row, ri) => {
      const widths = row.map((t) => textWidth(t, size, 600) + 20)
      const total = widths.reduce((a, b) => a + b, 0)
      let x = cx - total / 2
      const y = cy - ((rows.length - 1) * 30) / 2 + ri * 30
      row.forEach((t, k) => {
        const xx = x + widths[k]! / 2
        parts.push(isBlank(t)
          ? <MissingBox key={`i${i}-${ri}-${k}`} cx={xx} cy={y} w={32} h={26} size={16} />
          : <Txt key={`i${i}-${ri}-${k}`} x={xx} y={y} size={size}>{t}</Txt>)
        x += widths[k]!
      })
    })
  })
  return { w: Math.ceil(xs[2]! + PAD), h: Math.ceil(ys[2]! + PAD), el: <g>{parts}</g> }
}
