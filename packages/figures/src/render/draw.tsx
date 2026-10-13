import type { FigureSpec } from '../spec'
import { DIVIDER, MUTED, WHITE } from '../palette'
import { drawAngle } from './angle'
import { drawBalance } from './balance'
import { drawBasetens } from './basetens'
import { drawBars, drawPictogram, drawTable, drawTally } from './charts'
import { drawCircuit } from './circuit'
import { drawClock } from './clock'
import { drawCoordinates } from './coordinates'
import { drawArray, drawGroups, drawObjects } from './counting'
import { drawFraction, drawGrid } from './grid'
import { drawIcons } from './iconrow'
import { SW2, Txt, type Ctx, type Drawn } from './kit'
import { drawJug, drawScale, drawThermometer } from './gauges'
import { drawRuler } from './measure'
import { drawMoney } from './money'
import { drawNumberline } from './numberline'
import { drawPattern, drawSequence } from './sequence'
import { drawCarroll, drawVenn } from './sets'
import { drawShape, drawShapes, drawSolid } from './shapes'
import { drawClip } from './clip'

function dispatch(spec: FigureSpec, ctx: Ctx): Drawn {
  switch (spec.kind) {
    case 'array': return drawArray(spec)
    case 'groups': return drawGroups(spec)
    case 'objects': return drawObjects(spec)
    case 'numberline': return drawNumberline(spec)
    case 'clock': return drawClock(spec)
    case 'shape': return drawShape(spec)
    case 'shapes': return drawShapes(spec)
    case 'solid': return drawSolid(spec)
    case 'grid': return drawGrid(spec)
    case 'fraction': return drawFraction(spec)
    case 'bars': return drawBars(spec)
    case 'pictogram': return drawPictogram(spec, ctx)
    case 'tally': return drawTally(spec)
    case 'table': return drawTable(spec)
    case 'basetens': return drawBasetens(spec)
    case 'money': return drawMoney(spec)
    case 'ruler': return drawRuler(spec)
    case 'thermometer': return drawThermometer(spec)
    case 'scale': return drawScale(spec)
    case 'jug': return drawJug(spec)
    case 'sequence': return drawSequence(spec)
    case 'pattern': return drawPattern(spec, ctx)
    case 'venn': return drawVenn(spec)
    case 'carroll': return drawCarroll(spec)
    case 'coordinates': return drawCoordinates(spec)
    case 'angle': return drawAngle(spec)
    case 'icons': return drawIcons(spec)
    case 'circuit': return drawCircuit(spec)
    case 'balance': return drawBalance(spec)
    case 'clip': return drawClip(spec)
    default: return fallback(String((spec as { kind?: unknown }).kind ?? 'figure'))
  }
}

/** Bingkai pengganti bila data figur tidak bisa digambar. Teks alt tetap dibacakan. */
function fallback(kind: string): Drawn {
  return {
    w: 240,
    h: 120,
    el: (
      <g data-fallback="">
        <rect x={1} y={1} width={238} height={118} rx={12} fill={WHITE} stroke={DIVIDER} strokeWidth={SW2} strokeDasharray="6 6" />
        <Txt x={120} y={60} size={14} fill={MUTED}>{kind}</Txt>
      </g>
    ),
  }
}

/** Gambar figur. Tidak pernah melempar galat: data yang rusak menghasilkan bingkai pengganti. */
export function draw(spec: FigureSpec, ctx: Ctx): Drawn {
  try {
    const d = dispatch(spec, ctx)
    if (!(d.w > 0 && d.h > 0 && Number.isFinite(d.w) && Number.isFinite(d.h))) return fallback(spec.kind)
    return d
  } catch {
    return fallback(spec.kind)
  }
}
