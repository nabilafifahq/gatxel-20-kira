/**
 * Alat peraga Math: logika murni untuk balok nilai tempat, batang pecahan, model batang, tangram,
 * dan geoboard. Dipakai server (skor), perangkat learner (umpan balik offline), widget, dan
 * halaman Alat. Tidak mengimpor apa pun dari Node.
 */

// ---------------------------------------------------------------- Balok nilai tempat

export type Blocks = { h: number; t: number; o: number }
export const BLOCK_MAX = 30

const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x)

export function blocksValue(b: Blocks): number {
  return b.h * 100 + b.t * 10 + b.o
}

export function parseBlocks(v: unknown): Blocks | null {
  if (v === null || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  if (!isInt(r.h) || !isInt(r.t) || !isInt(r.o)) return null
  if (r.h < 0 || r.t < 0 || r.o < 0 || r.h > BLOCK_MAX || r.t > BLOCK_MAX || r.o > BLOCK_MAX) return null
  return { h: r.h, t: r.t, o: r.o }
}

export type BlocksKey = { h: number; t: number; o: number; exact: boolean }

export function blocksOk(key: BlocksKey, given: Blocks | null): boolean {
  if (!given) return false
  if (key.exact) return given.h === key.h && given.t === key.t && given.o === key.o
  return blocksValue(given) === blocksValue(key)
}

/** Tukar 10 satuan menjadi 1 puluhan (atau 10 puluhan menjadi 1 ratusan). */
export function exchangeUp(b: Blocks, place: 'o' | 't'): Blocks {
  if (place === 'o' && b.o >= 10) return { ...b, o: b.o - 10, t: b.t + 1 }
  if (place === 't' && b.t >= 10) return { ...b, t: b.t - 10, h: b.h + 1 }
  return b
}

/** Pecah 1 ratusan menjadi 10 puluhan (atau 1 puluhan menjadi 10 satuan). */
export function exchangeDown(b: Blocks, place: 'h' | 't'): Blocks {
  if (place === 'h' && b.h >= 1 && b.t + 10 <= BLOCK_MAX) return { ...b, h: b.h - 1, t: b.t + 10 }
  if (place === 't' && b.t >= 1 && b.o + 10 <= BLOCK_MAX) return { ...b, t: b.t - 1, o: b.o + 10 }
  return b
}

// ---------------------------------------------------------------- Batang pecahan

export const DEFAULT_SPLITS = [2, 3, 4, 5, 6, 8, 10, 12] as const
export type FractionRowSpec = { den?: number; locked?: number }
export type FractionRelation = 'lt' | 'gt' | 'eq'
export type FractionBarKey = {
  rows: FractionRowSpec[]
  splits: number[]
  targets: ({ num: number; den: number } | null)[]
  exactSplit: boolean
  relation?: FractionRelation
}
export type BarState = { den: number; shaded: number }

export function parseBars(v: unknown): BarState[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > 3) return null
  const out: BarState[] = []
  for (const b of v) {
    if (b === null || typeof b !== 'object') return null
    const r = b as Record<string, unknown>
    if (!isInt(r.den) || !isInt(r.shaded) || r.den < 1 || r.den > 12 || r.shaded < 0 || r.shaded > r.den) return null
    out.push({ den: r.den, shaded: r.shaded })
  }
  return out
}

/** Bandingkan num1/den1 dengan num2/den2: -1, 0, atau 1. */
export function compareFractions(n1: number, d1: number, n2: number, d2: number): -1 | 0 | 1 {
  const l = n1 * d2
  const r = n2 * d1
  return l < r ? -1 : l > r ? 1 : 0
}

export function fractionBarOk(key: FractionBarKey, bars: BarState[] | null): boolean {
  if (!bars || bars.length !== key.rows.length) return false
  for (let i = 0; i < key.rows.length; i++) {
    const row = key.rows[i]!
    const bar = bars[i]!
    if (row.den !== undefined && bar.den !== row.den) return false
    if (row.den === undefined && !key.splits.includes(bar.den)) return false
    if (row.locked !== undefined && bar.shaded !== row.locked) return false
    const target = key.targets[i]
    if (target) {
      if (compareFractions(bar.shaded, bar.den, target.num, target.den) !== 0) return false
      if (key.exactSplit && row.den === undefined && bar.den !== target.den) return false
    }
  }
  if (key.relation) {
    const a = bars[0]!
    const b = bars[1]
    if (!b) return false
    const c = compareFractions(a.shaded, a.den, b.shaded, b.den)
    const want = key.relation === 'lt' ? -1 : key.relation === 'gt' ? 1 : 0
    if (c !== want) return false
  }
  return true
}

// ---------------------------------------------------------------- Model batang

export type BarModelKey = { kind: 'partwhole' | 'compare'; bars: { label: string; units: number }[]; unit?: number }
export type BarModelState = { bars: { label: string; units: number }[]; unit?: number }

export function parseModel(v: unknown): BarModelState | null {
  if (v === null || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  if (!Array.isArray(r.bars) || r.bars.length === 0 || r.bars.length > 5) return null
  const bars: BarModelState['bars'] = []
  for (const b of r.bars) {
    if (b === null || typeof b !== 'object') return null
    const x = b as Record<string, unknown>
    if (typeof x.label !== 'string' || x.label === '' || x.label.length > 40 || !isInt(x.units) || x.units < 0 || x.units > 12) return null
    bars.push({ label: x.label, units: x.units })
  }
  const unit = r.unit === undefined ? undefined : isInt(r.unit) && r.unit >= 0 && r.unit <= 200 ? r.unit : NaN
  if (Number.isNaN(unit)) return null
  return { bars, ...(unit !== undefined ? { unit } : {}) }
}

export function barModelOk(key: BarModelKey, m: BarModelState | null): boolean {
  if (!m || m.bars.length !== key.bars.length) return false
  const labels = new Set(m.bars.map((b) => b.label))
  if (labels.size !== m.bars.length) return false
  for (const want of key.bars) {
    const got = m.bars.find((b) => b.label === want.label)
    if (!got || got.units !== want.units) return false
  }
  if (key.unit !== undefined && m.unit !== key.unit) return false
  return true
}

// ---------------------------------------------------------------- Tangram

export type Pt = readonly [number, number]
export const PIECE_TYPES = ['L', 'M', 'S', 'Q', 'P'] as const
export type PieceType = (typeof PIECE_TYPES)[number]

export const PIECE_NAME: Record<PieceType, string> = { L: 'large triangle', M: 'medium triangle', S: 'small triangle', Q: 'square', P: 'parallelogram' }

/**
 * Tujuh keping tangram (dua L, satu M, dua S, satu Q, satu P) hasil membelah persegi 4 x 4.
 * Semua titik sudut berupa bilangan bulat, dan putaran 90 derajat serta cermin menjaganya tetap bulat.
 * Luas: L 4, M 2, S 1, Q 2, P 2, jumlah 16.
 */
const RAW: Record<PieceType, Pt[]> = {
  L: [[0, 0], [4, 0], [2, 2]],
  M: [[0, 4], [0, 2], [2, 4]],
  S: [[0, 0], [0, 2], [1, 1]],
  Q: [[0, 2], [1, 1], [2, 2], [1, 3]],
  P: [[2, 4], [4, 4], [3, 3], [1, 3]],
}

export const PIECE_COUNT: Record<PieceType, number> = { L: 2, M: 1, S: 2, Q: 1, P: 1 }
export const PIECE_AREA: Record<PieceType, number> = { L: 4, M: 2, S: 1, Q: 2, P: 2 }

export function normalise(pts: readonly Pt[]): Pt[] {
  const mx = Math.min(...pts.map((p) => p[0]))
  const my = Math.min(...pts.map((p) => p[1]))
  return pts.map((p): Pt => [p[0] - mx, p[1] - my])
}

/** Bentuk keping setelah dicerminkan (sumbu x) lalu diputar `rot` kali 90 derajat searah jarum jam, di pojok kiri atas (0, 0). */
export function orient(type: PieceType, rot: number, flip: boolean): Pt[] {
  let pts: Pt[] = RAW[type].map((p): Pt => (flip ? [-p[0], p[1]] : [p[0], p[1]]))
  for (let k = 0; k < ((rot % 4) + 4) % 4; k++) pts = pts.map((p): Pt => [-p[1], p[0]])
  return normalise(pts)
}

const sig = (pts: readonly Pt[]) =>
  normalise(pts)
    .map((p) => `${p[0]},${p[1]}`)
    .sort()
    .join(';')

/** Apakah keping ini, dengan arah ini, persis mengisi bentuk `slot` (titik sudut sama setelah digeser ke pojok)? */
export function fitsSlot(type: PieceType, rot: number, flip: boolean, slot: readonly Pt[]): boolean {
  return sig(orient(type, rot, flip)) === sig(slot)
}

/** Semua arah (rot, flip) yang membuat keping `type` mengisi `slot`. */
export function fittingOrientations(type: PieceType, slot: readonly Pt[]): { rot: number; flip: boolean }[] {
  const out: { rot: number; flip: boolean }[] = []
  for (const flip of [false, true]) for (let rot = 0; rot < 4; rot++) if (fitsSlot(type, rot, flip, slot)) out.push({ rot, flip })
  return out
}

/** Jenis keping untuk bentuk slot, atau null bila bukan keping tangram. */
export function pieceTypeOf(slot: readonly Pt[]): PieceType | null {
  for (const t of PIECE_TYPES) if (fittingOrientations(t, slot).length > 0) return t
  return null
}

export type Placement = readonly [piece: number, rot: number, flip: 0 | 1]
export type TangramState = (Placement | null)[]

export function parsePlacements(v: unknown, slots: number, pool: number): TangramState | null {
  if (!Array.isArray(v) || v.length !== slots) return null
  const out: TangramState = []
  for (const x of v) {
    if (x === null) {
      out.push(null)
      continue
    }
    if (!Array.isArray(x) || x.length !== 3) return null
    const [p, r, f] = x as unknown[]
    if (!isInt(p) || !isInt(r) || p < 0 || p >= pool || r < 0 || r > 3 || (f !== 0 && f !== 1)) return null
    out.push([p, r, f])
  }
  return out
}

export type TangramKey = { pieces: PieceType[]; slots: Pt[][] }

/** Berapa slot yang terisi benar, dan apakah semuanya benar. Satu keping hanya boleh dipakai satu kali. */
export function tangramScore(key: TangramKey, placed: TangramState | null): { right: number; all: boolean } {
  if (!placed || placed.length !== key.slots.length) return { right: 0, all: false }
  const used = new Set<number>()
  let right = 0
  placed.forEach((pl, i) => {
    if (!pl) return
    const [p, rot, flip] = pl
    if (used.has(p)) return
    used.add(p)
    const type = key.pieces[p]
    if (type && fitsSlot(type, rot, flip === 1, key.slots[i]!)) right++
  })
  return { right, all: right === key.slots.length }
}

// ---- Tata letak keping di bidang (untuk pembuat soal dan pemeriksa isi)

const inside = (poly: readonly Pt[], x: number, y: number): boolean => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!
    const [xj, yj] = poly[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

/** Luas tumpang tindih kasar dua poligon (dicacah pada kisi 1/8). 0 berarti tidak bertumpuk. */
export function overlapArea(a: readonly Pt[], b: readonly Pt[]): number {
  const minX = Math.max(Math.min(...a.map((p) => p[0])), Math.min(...b.map((p) => p[0])))
  const maxX = Math.min(Math.max(...a.map((p) => p[0])), Math.max(...b.map((p) => p[0])))
  const minY = Math.max(Math.min(...a.map((p) => p[1])), Math.min(...b.map((p) => p[1])))
  const maxY = Math.min(Math.max(...a.map((p) => p[1])), Math.max(...b.map((p) => p[1])))
  let n = 0
  const step = 0.125
  for (let x = minX + step / 2 + 0.0013; x < maxX; x += step) for (let y = minY + step / 2 + 0.0007; y < maxY; y += step) if (inside(a, x, y) && inside(b, x, y)) n++
  return n * step * step
}

/** Dua poligon berbagi sepotong sisi dengan panjang lebih dari 0. */
export function shareEdge(a: readonly Pt[], b: readonly Pt[]): boolean {
  for (let i = 0; i < a.length; i++) {
    const p1 = a[i]!
    const p2 = a[(i + 1) % a.length]!
    for (let j = 0; j < b.length; j++) {
      const q1 = b[j]!
      const q2 = b[(j + 1) % b.length]!
      const d1 = [p2[0] - p1[0], p2[1] - p1[1]]
      const d2 = [q2[0] - q1[0], q2[1] - q1[1]]
      if (d1[0]! * d2[1]! - d1[1]! * d2[0]! !== 0) continue
      if ((q1[0] - p1[0]) * d1[1]! - (q1[1] - p1[1]) * d1[0]! !== 0) continue
      const len2 = d1[0]! ** 2 + d1[1]! ** 2
      const t1 = ((q1[0] - p1[0]) * d1[0]! + (q1[1] - p1[1]) * d1[1]!) / len2
      const t2 = ((q2[0] - p1[0]) * d1[0]! + (q2[1] - p1[1]) * d1[1]!) / len2
      const lo = Math.max(0, Math.min(t1, t2))
      const hi = Math.min(1, Math.max(t1, t2))
      if (hi - lo > 1e-9) return true
    }
  }
  return false
}

export function polygonArea(p: readonly Pt[]): number {
  let s = 0
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!
    const b = p[(i + 1) % p.length]!
    s += a[0] * b[1] - b[0] * a[1]
  }
  return Math.abs(s) / 2
}

/** Pemeriksaan isi soal tangram: slot cocok dengan keping, tidak bertumpuk, saling tersambung. Mengembalikan daftar masalah. */
export function tangramProblems(key: TangramKey): string[] {
  const p: string[] = []
  if (key.pieces.length !== key.slots.length) p.push('Jumlah keping dan slot harus sama')
  const count: Record<string, number> = {}
  for (const t of key.pieces) count[t] = (count[t] ?? 0) + 1
  for (const t of PIECE_TYPES) if ((count[t] ?? 0) > PIECE_COUNT[t]) p.push(`Keping ${t} terlalu banyak`)
  const need: Record<string, number> = {}
  key.slots.forEach((s, i) => {
    const t = pieceTypeOf(s)
    if (!t) p.push(`Slot ${i} bukan keping tangram`)
    else need[t] = (need[t] ?? 0) + 1
  })
  for (const t of PIECE_TYPES) if ((need[t] ?? 0) !== (count[t] ?? 0)) p.push(`Slot jenis ${t} (${need[t] ?? 0}) tidak sama dengan keping (${count[t] ?? 0})`)
  for (let i = 0; i < key.slots.length; i++) {
    for (let j = i + 1; j < key.slots.length; j++) {
      if (overlapArea(key.slots[i]!, key.slots[j]!) > 0.01) p.push(`Slot ${i} dan ${j} bertumpuk`)
    }
  }
  // Tersambung: semua slot terhubung lewat sisi bersama.
  const seen = new Set<number>([0])
  const queue = [0]
  while (queue.length) {
    const i = queue.pop()!
    key.slots.forEach((s, j) => {
      if (!seen.has(j) && shareEdge(key.slots[i]!, s)) {
        seen.add(j)
        queue.push(j)
      }
    })
  }
  if (seen.size !== key.slots.length) p.push('Slot tidak saling tersambung')
  return p
}

// ---------------------------------------------------------------- Geoboard

export type Peg = readonly [number, number]
export const GEO_SHAPES = ['rectangle', 'square', 'triangle', 'right-triangle', 'isosceles-triangle', 'slanted-parallelogram', 'trapezium'] as const
export type GeoShape = (typeof GEO_SHAPES)[number]
export type GeoRule = { sides?: number; area?: number; perimeter?: number; shape?: GeoShape; rectilinear?: boolean }

export type GeoInfo = {
  ok: boolean
  reason?: 'few' | 'repeat' | 'cross' | 'flat'
  /** Titik sudut sungguhan (tanpa titik lurus di tengah sisi). */
  corners: Peg[]
  sides: number
  area: number
  perimeter: number
  rectilinear: boolean
  shape: GeoShape | null
}

const cross = (o: Peg, a: Peg, b: Peg) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
const dot = (o: Peg, a: Peg, b: Peg) => (a[0] - o[0]) * (b[0] - o[0]) + (a[1] - o[1]) * (b[1] - o[1])
const d2 = (a: Peg, b: Peg) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2

function onSegment(a: Peg, b: Peg, p: Peg): boolean {
  return cross(a, b, p) === 0 && Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1])
}

function segmentsTouch(a: Peg, b: Peg, c: Peg, d: Peg): boolean {
  const o1 = Math.sign(cross(a, b, c))
  const o2 = Math.sign(cross(a, b, d))
  const o3 = Math.sign(cross(c, d, a))
  const o4 = Math.sign(cross(c, d, b))
  if (o1 !== o2 && o3 !== o4) return true
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)
}

export function analysePegs(pegs: readonly Peg[]): GeoInfo {
  const empty: GeoInfo = { ok: false, corners: [], sides: 0, area: 0, perimeter: 0, rectilinear: false, shape: null }
  const n = pegs.length
  if (n < 3) return { ...empty, reason: 'few' }
  if (new Set(pegs.map((p) => `${p[0]},${p[1]}`)).size !== n) return { ...empty, reason: 'repeat' }
  // Sisi tidak boleh bersilang atau bersentuhan kecuali tetangga di satu titik sudut.
  for (let i = 0; i < n; i++) {
    const a = pegs[i]!
    const b = pegs[(i + 1) % n]!
    for (let j = i + 1; j < n; j++) {
      const c = pegs[j]!
      const d = pegs[(j + 1) % n]!
      const adjacent = j === i + 1 || (i === 0 && j === n - 1)
      if (adjacent) {
        // Tetangga hanya berbagi satu titik sudut: sisi tidak boleh berbalik menumpuk.
        const shared = j === i + 1 ? b : a
        const other1 = j === i + 1 ? a : b
        const other2 = j === i + 1 ? d : c
        if (cross(shared, other1, other2) === 0 && dot(shared, other1, other2) > 0) return { ...empty, reason: 'cross' }
        continue
      }
      if (segmentsTouch(a, b, c, d)) return { ...empty, reason: 'cross' }
    }
  }
  let twice = 0
  for (let i = 0; i < n; i++) {
    const a = pegs[i]!
    const b = pegs[(i + 1) % n]!
    twice += a[0] * b[1] - b[0] * a[1]
  }
  const area = Math.abs(twice) / 2
  if (area === 0) return { ...empty, reason: 'flat' }
  const corners = pegs.filter((p, i) => cross(pegs[(i + n - 1) % n]!, p, pegs[(i + 1) % n]!) !== 0)
  let perimeter = 0
  for (let i = 0; i < n; i++) perimeter += Math.sqrt(d2(pegs[i]!, pegs[(i + 1) % n]!))
  const m = corners.length
  const rectilinear = corners.every((c, i) => {
    const nx = corners[(i + 1) % m]!
    return c[0] === nx[0] || c[1] === nx[1]
  })
  const right = (i: number) => dot(corners[i]!, corners[(i + m - 1) % m]!, corners[(i + 1) % m]!) === 0
  const len = (i: number) => d2(corners[i]!, corners[(i + 1) % m]!)
  let shape: GeoShape | null = null
  if (m === 4) {
    const isRect = [0, 1, 2, 3].every(right)
    if (isRect) shape = len(0) === len(1) ? 'square' : 'rectangle'
    else {
      const [p0, p1, p2, p3] = corners as [Peg, Peg, Peg, Peg]
      const para = p0[0] + p2[0] === p1[0] + p3[0] && p0[1] + p2[1] === p1[1] + p3[1]
      if (para) shape = 'slanted-parallelogram'
      else {
        const par02 = cross([0, 0], [p1[0] - p0[0], p1[1] - p0[1]], [p2[0] - p3[0], p2[1] - p3[1]]) === 0
        const par13 = cross([0, 0], [p2[0] - p1[0], p2[1] - p1[1]], [p3[0] - p0[0], p3[1] - p0[1]]) === 0
        if (par02 !== par13) shape = 'trapezium'
      }
    }
  } else if (m === 3) {
    if ([0, 1, 2].some(right)) shape = 'right-triangle'
    else if (len(0) === len(1) || len(1) === len(2) || len(0) === len(2)) shape = 'isosceles-triangle'
    else shape = 'triangle'
  }
  return { ok: true, corners, sides: m, area, perimeter, rectilinear, shape }
}

/** Apakah bentuk memenuhi aturan `shape`? Segitiga siku-siku dan sama kaki juga segitiga; persegi juga persegi panjang. */
export function shapeMatches(info: GeoInfo, want: GeoShape): boolean {
  if (info.shape === want) return true
  if (want === 'triangle') return info.sides === 3
  if (want === 'rectangle') return info.shape === 'square'
  return false
}

export function geoOk(rule: GeoRule, info: GeoInfo): boolean {
  if (!info.ok) return false
  if (rule.sides !== undefined && info.sides !== rule.sides) return false
  if (rule.area !== undefined && Math.abs(info.area - rule.area) > 1e-9) return false
  if (rule.perimeter !== undefined && Math.abs(info.perimeter - rule.perimeter) > 1e-9) return false
  if (rule.rectilinear !== undefined && info.rectilinear !== rule.rectilinear) return false
  if (rule.shape !== undefined && !shapeMatches(info, rule.shape)) return false
  return true
}

export function parsePegs(v: unknown, size: number): Peg[] | null {
  if (!Array.isArray(v) || v.length < 3 || v.length > 16) return null
  const out: Peg[] = []
  for (const p of v) {
    if (!Array.isArray(p) || p.length !== 2 || !isInt(p[0]) || !isInt(p[1]) || p[0] < 0 || p[1] < 0 || p[0] >= size || p[1] >= size) return null
    out.push([p[0], p[1]])
  }
  return out
}

/** Perimeter untuk tampilan: bulat bila sisi lurus, selain itu dibulatkan ke satu desimal. */
export function formatLength(x: number): string {
  return Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : x.toFixed(1)
}
