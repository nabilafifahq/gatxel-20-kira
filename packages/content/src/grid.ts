/**
 * Teka-teki kotak: persegi ajaib 3x3, sudoku 4x4 (kotak 2x2), dan persegi latin 3x3 atau 4x4.
 * Dipakai pemeriksa jawaban (check.ts) dan pemeriksa konten (load.ts). Tanpa impor Node,
 * aman dibundel ke client. Sel disimpan datar, baris demi baris; 0 berarti kosong.
 */

export type GridPuzzle = 'magic' | 'sudoku' | 'latin'

export const flattenGrid = (rows: readonly (readonly number[])[]): number[] => rows.flatMap((r) => [...r])

/** Ukuran yang boleh untuk tiap jenis teka-teki. */
export function sizeAllowed(puzzle: GridPuzzle, size: number): boolean {
  if (puzzle === 'magic') return size === 3
  if (puzzle === 'sudoku') return size === 4
  return size === 3 || size === 4
}

/** Angka yang boleh dipakai: sudoku dan latin 1 sampai size, persegi ajaib angka-angka di solusinya. */
export function gridValues(puzzle: GridPuzzle, size: number, solution: readonly number[]): number[] {
  if (puzzle === 'magic') return [...new Set(solution)].sort((a, b) => a - b)
  return Array.from({ length: size }, (_, i) => i + 1)
}

function lines(size: number): number[][] {
  const out: number[][] = []
  for (let r = 0; r < size; r++) out.push(Array.from({ length: size }, (_, c) => r * size + c))
  for (let c = 0; c < size; c++) out.push(Array.from({ length: size }, (_, r) => r * size + c))
  return out
}

function diagonals(size: number): number[][] {
  return [
    Array.from({ length: size }, (_, i) => i * size + i),
    Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)),
  ]
}

function boxes(size: number): number[][] {
  if (size !== 4) return []
  const out: number[][] = []
  for (const br of [0, 2]) for (const bc of [0, 2]) out.push([br * 4 + bc, br * 4 + bc + 1, (br + 1) * 4 + bc, (br + 1) * 4 + bc + 1])
  return out
}

const sorted = (a: readonly number[]) => [...a].sort((x, y) => x - y)
const sameSet = (a: readonly number[], b: readonly number[]) => a.length === b.length && sorted(a).every((v, i) => v === sorted(b)[i])

/** Semua sel terisi dan memenuhi aturan jenisnya. */
export function gridRulesOk(puzzle: GridPuzzle, size: number, cells: readonly number[], values: readonly number[]): boolean {
  if (cells.length !== size * size) return false
  if (puzzle === 'magic') {
    if (!sameSet(cells, values)) return false
    const total = cells.reduce((a, b) => a + b, 0)
    if (total % size !== 0) return false
    const target = total / size
    return [...lines(size), ...diagonals(size)].every((idx) => idx.reduce((s, i) => s + cells[i]!, 0) === target)
  }
  const groups = [...lines(size), ...(puzzle === 'sudoku' ? boxes(size) : [])]
  return groups.every((idx) => sameSet(idx.map((i) => cells[i]!), values))
}

/** Penyelesaian teka-teki (paling banyak `limit`) yang cocok dengan sel awal. */
export function solveGrid(puzzle: GridPuzzle, size: number, given: readonly number[], values: readonly number[], limit = 2): number[][] {
  const n = size * size
  const cells = Array.from({ length: n }, (_, i) => given[i] ?? 0)
  const found: number[][] = []
  if (!sizeAllowed(puzzle, size) || given.length !== n) return found
  if (puzzle === 'magic') {
    const total = values.reduce((a, b) => a + b, 0)
    if (values.length !== n || total % size !== 0) return found
    const target = total / size
    const fixed = new Set(cells.filter((v) => v !== 0))
    if (fixed.size !== cells.filter((v) => v !== 0).length || ![...fixed].every((v) => values.includes(v))) return found
    const used = new Set(fixed)
    const rowSum = (r: number) => cells.slice(r * size, r * size + size).reduce((a, b) => a + b, 0)
    const dfs = (pos: number): void => {
      if (found.length >= limit) return
      if (pos === n) {
        if (gridRulesOk('magic', size, cells, values)) found.push([...cells])
        return
      }
      if (cells[pos] !== 0) {
        dfs(pos + 1)
        return
      }
      for (const v of values) {
        if (used.has(v)) continue
        cells[pos] = v
        used.add(v)
        // Baris yang sudah penuh harus berjumlah target; sisanya diperiksa di akhir.
        const r = Math.floor(pos / size)
        const rowDone = pos % size === size - 1
        if (!rowDone || rowSum(r) === target) dfs(pos + 1)
        used.delete(v)
        cells[pos] = 0
        if (found.length >= limit) return
      }
    }
    dfs(0)
    return found
  }
  const groups = [...lines(size), ...(puzzle === 'sudoku' ? boxes(size) : [])]
  const peers: number[][] = Array.from({ length: n }, (_, i) => [...new Set(groups.filter((g) => g.includes(i)).flat())].filter((j) => j !== i))
  for (let i = 0; i < n; i++) if (cells[i] !== 0 && (!values.includes(cells[i]!) || peers[i]!.some((j) => cells[j] === cells[i]))) return found
  const dfs = (): void => {
    if (found.length >= limit) return
    let best = -1
    let bestOpts: number[] = []
    for (let i = 0; i < n; i++) {
      if (cells[i] !== 0) continue
      const opts = values.filter((v) => peers[i]!.every((j) => cells[j] !== v))
      if (best === -1 || opts.length < bestOpts.length) {
        best = i
        bestOpts = opts
        if (opts.length === 0) return
      }
    }
    if (best === -1) {
      found.push([...cells])
      return
    }
    for (const v of bestOpts) {
      cells[best] = v
      dfs()
      cells[best] = 0
      if (found.length >= limit) return
    }
  }
  dfs()
  return found
}
