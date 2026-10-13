/**
 * Pembuat soal Quick Maths. Deterministik: (config, seed, index) selalu menghasilkan soal yang sama,
 * jadi server bisa membuat ulang soal untuk memeriksa jawaban tanpa menyimpannya.
 *
 * Aman untuk kelas 2: tidak ada hasil negatif dan pembagian selalu habis (diuji untuk ribuan seed).
 */
import { createRng, type Rng } from '../rng'
import { genFlash, genSoroban } from './anzan'
import {
  OP_SYMBOL,
  QM_OPS,
  type QmConfig,
  type QmOp,
  type QmProblem,
  type StrategyId,
} from './types'

const lo = (d: number): number => (d === 1 ? 1 : 10 ** (d - 1))
const hi = (d: number): number => 10 ** d - 1

/** Jumlah kolom yang menghasilkan simpanan saat a + b. */
export function carryCount(a: number, b: number): number {
  let n = 0
  let carry = 0
  let x = a
  let y = b
  while (x > 0 || y > 0 || carry > 0) {
    const s = (x % 10) + (y % 10) + carry
    carry = s >= 10 ? 1 : 0
    n += carry
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return n
}

/** Jumlah kolom yang meminjam saat a - b (a >= b). */
export function borrowCount(a: number, b: number): number {
  let n = 0
  let borrow = 0
  let x = a
  let y = b
  while (x > 0 || y > 0) {
    const da = (x % 10) - borrow
    if (da < (y % 10)) {
      n++
      borrow = 1
    } else borrow = 0
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return n
}

type CarryMode = 'none' | 'force' | 'any'

type ColSpec = { da: number; db: number; carry: CarryMode }

const TRIES = 600

function addCols(rng: Rng, spec: ColSpec): [number, number] {
  for (let i = 0; i < TRIES; i++) {
    const a = rng.int(lo(spec.da), hi(spec.da))
    const b = rng.int(lo(spec.db), hi(spec.db))
    const c = carryCount(a, b)
    if (spec.carry === 'any' || (spec.carry === 'none' ? c === 0 : c >= 1)) return [a, b]
  }
  return spec.carry === 'force' ? [lo(spec.da) + 8, 9] : [lo(spec.da), 1]
}

function subCols(rng: Rng, spec: ColSpec): [number, number] {
  for (let i = 0; i < TRIES; i++) {
    let a = rng.int(lo(spec.da), hi(spec.da))
    let b = rng.int(lo(spec.db), hi(spec.db))
    if (a < b) [a, b] = [b, a]
    if (a === b) continue
    const c = borrowCount(a, b)
    if (spec.carry === 'any' || (spec.carry === 'none' ? c === 0 : c >= 1)) return [a, b]
  }
  return spec.carry === 'force' ? [lo(spec.da) + 2, 9] : [hi(spec.da), 1]
}

// ---------------------------------------------------------------------------
// Tangga level per operasi (otomatis/adaptif)

const ADD_LADDER: ({ within10: true } | ColSpec)[] = [
  { within10: true },
  { da: 1, db: 1, carry: 'force' },
  { da: 2, db: 1, carry: 'none' },
  { da: 2, db: 1, carry: 'force' },
  { da: 2, db: 2, carry: 'none' },
  { da: 2, db: 2, carry: 'force' },
  { da: 3, db: 2, carry: 'any' },
  { da: 3, db: 3, carry: 'any' },
]

const SUB_LADDER: ({ within10: true } | { teens: true } | ColSpec)[] = [
  { within10: true },
  { teens: true },
  { da: 2, db: 1, carry: 'none' },
  { da: 2, db: 1, carry: 'force' },
  { da: 2, db: 2, carry: 'none' },
  { da: 2, db: 2, carry: 'force' },
  { da: 3, db: 2, carry: 'any' },
  { da: 3, db: 3, carry: 'any' },
]

/** Tabel yang dipakai level 1 sampai 5 untuk kali dan bagi. */
export const TABLES_BY_LEVEL: readonly (readonly number[])[] = [
  [2, 5, 10],
  [2, 3, 4, 5, 10],
  [2, 3, 4, 5, 6, 10],
  [2, 3, 4, 5, 6, 7, 8, 9, 10],
  [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
]

/** Deskripsi level untuk layar (en-GB). */
export function describeLevel(op: QmOp, level: number): string {
  const l = Math.max(1, Math.min(8, Math.floor(level)))
  const add = ['sums up to 10', 'two single digits across ten', '2-digit plus 1-digit, no carrying', '2-digit plus 1-digit with carrying', '2-digit plus 2-digit, no carrying', '2-digit plus 2-digit with carrying', '3-digit plus 2-digit', '3-digit plus 3-digit']
  const sub = ['taking away within 10', 'taking away across ten', '2-digit minus 1-digit, no borrowing', '2-digit minus 1-digit with borrowing', '2-digit minus 2-digit, no borrowing', '2-digit minus 2-digit with borrowing', '3-digit minus 2-digit', '3-digit minus 3-digit']
  const mul = ['2, 5 and 10 times tables', '2 to 5 and 10 times tables', 'times tables up to 6 and 10', 'all times tables to 10', 'times tables to 12', '2-digit times 1-digit, no carrying', '2-digit times 1-digit', '2-digit times 2-digit']
  const div = ['sharing by 2, 5 and 10', 'sharing by 2 to 5 and 10', 'sharing by 2 to 6 and 10', 'all division facts to 10', 'division facts to 12', '2-digit shared by 1-digit, easy', '2-digit shared by 1-digit', '3-digit shared by 1-digit']
  const table = { add, sub, mul, div }[op]
  return table[l - 1] ?? table[0]!
}

// ---------------------------------------------------------------------------
// Jenis soal (untuk statistik)

function digitsOf(n: number): number {
  return String(Math.abs(n)).length
}

export function addFact(a: number, b: number): string {
  const x = Math.max(a, b)
  const y = Math.min(a, b)
  if (x <= 9) {
    if (a + b === 10) return 'add:bond10'
    if (a === b) return 'add:double'
    if (x - y === 1) return 'add:near-double'
    return a + b > 10 ? 'add:bridge10' : 'add:within10'
  }
  const c = carryCount(a, b) > 0 ? '+' : ''
  return `add:${digitsOf(x)}d${digitsOf(y)}d${c}`
}

export function subFact(a: number, b: number): string {
  if (a <= 10) return 'sub:within10'
  if (a <= 19 && b <= 9) return borrowCount(a, b) > 0 ? 'sub:bridge10' : 'sub:teens'
  const c = borrowCount(a, b) > 0 ? '-' : ''
  return `sub:${digitsOf(a)}d${digitsOf(b)}d${c}`
}

const FACT_NAMES: Record<string, string> = {
  'add:bond10': 'Pairs that make 10',
  'add:double': 'Doubles',
  'add:near-double': 'Near doubles',
  'add:within10': 'Adding within 10',
  'add:bridge10': 'Adding across ten',
  'sub:within10': 'Taking away within 10',
  'sub:bridge10': 'Taking away across ten',
  'sub:teens': 'Taking away from the teens',
  'comp:add': 'Adding nearly a ten',
  'comp:sub': 'Taking away nearly a ten',
  'mul:2d1d': '2-digit times 1-digit',
  'mul:2d2d': '2-digit times 2-digit',
  'mul:3d1d': '3-digit times 1-digit',
  'div:2d1d': '2-digit shared by 1-digit',
  'div:3d1d': '3-digit shared by 1-digit',
  'soroban:read': 'Reading the soroban',
  'soroban:set': 'Setting the soroban',
  'soroban:anzan': 'Soroban in your head',
}

/** Nama jenis soal untuk layar. */
export function factLabel(fact: string): string {
  const known = FACT_NAMES[fact]
  if (known) return known
  const [kind, rest = ''] = fact.split(':')
  if (kind === 'mul' && /^\d+$/.test(rest)) return `${rest} times table`
  if (kind === 'div' && /^\d+$/.test(rest)) return `Sharing by ${rest}`
  if (kind === 'flash') return `Flash Anzan level ${rest.replace('L', '')}`
  const m = /^(\d)d(\d)d([+-]?)$/.exec(rest)
  if (m && (kind === 'add' || kind === 'sub')) {
    const verb = kind === 'add' ? 'plus' : 'minus'
    const extra = m[3] === '+' ? ' with carrying' : m[3] === '-' ? ' with borrowing' : ''
    return `${m[1]}-digit ${verb} ${m[2]}-digit${extra}`
  }
  return fact
}

const FACT_NAMES_ID: Record<string, string> = {
  'add:bond10': 'Pasangan 10',
  'add:double': 'Dobel',
  'add:near-double': 'Hampir dobel',
  'add:within10': 'Tambah sampai 10',
  'add:bridge10': 'Tambah lewat 10',
  'sub:within10': 'Kurang sampai 10',
  'sub:bridge10': 'Kurang lewat 10',
  'sub:teens': 'Kurang dari bilangan belasan',
  'comp:add': 'Tambah bilangan hampir puluhan',
  'comp:sub': 'Kurang bilangan hampir puluhan',
  'mul:2d1d': 'Kali 2 digit dengan 1 digit',
  'mul:2d2d': 'Kali 2 digit dengan 2 digit',
  'mul:3d1d': 'Kali 3 digit dengan 1 digit',
  'div:2d1d': 'Bagi 2 digit dengan 1 digit',
  'div:3d1d': 'Bagi 3 digit dengan 1 digit',
}

/** Nama jenis soal untuk laporan tutor (Indonesia). */
export function factLabelId(fact: string): string {
  const known = FACT_NAMES_ID[fact]
  if (known) return known
  const [kind, rest = ''] = fact.split(':')
  if (kind === 'mul' && /^d+$/.test(rest)) return `Tabel perkalian ${rest}`
  if (kind === 'div' && /^d+$/.test(rest)) return `Pembagian dengan ${rest}`
  const m = /^(d)d(d)d([+-]?)$/.exec(rest)
  if (m && (kind === 'add' || kind === 'sub')) {
    const verb = kind === 'add' ? 'ditambah' : 'dikurangi'
    const extra = m[3] === '+' ? ', dengan simpanan' : m[3] === '-' ? ', dengan pinjaman' : ''
    return `${m[1]} digit ${verb} ${m[2]} digit${extra}`
  }
  return fact
}

// ---------------------------------------------------------------------------
// Soal per operasi

function arith(op: QmOp, a: number, b: number, answer: number, fact: string, level: number, missing = false): QmProblem {
  const sym = OP_SYMBOL[op]
  const text = missing ? `${a} ${sym} ? = ${a + b}` : `${a} ${sym} ${b} = ?`
  return { prompt: { kind: 'arith', text }, answer: missing ? b : answer, fact, level, op, a, b, missing }
}

function genAdd(rng: Rng, level: number): QmProblem {
  const spec = ADD_LADDER[level - 1]!
  let a: number
  let b: number
  if ('within10' in spec) {
    const sum = rng.int(2, 10)
    a = rng.int(1, sum - 1)
    b = sum - a
  } else [a, b] = addCols(rng, spec)
  if (rng.chance(0.5)) [a, b] = [b, a]
  const fact = addFact(a, b)
  // Pasangan 10 kadang ditulis dengan bilangan hilang: 6 + ? = 10.
  const missing = fact === 'add:bond10' && rng.chance(0.5)
  return arith('add', a, b, a + b, fact, level, missing)
}

function genSub(rng: Rng, level: number): QmProblem {
  const spec = SUB_LADDER[level - 1]!
  let a = 15
  let b = 8
  if ('within10' in spec) {
    a = rng.int(2, 10)
    b = rng.int(1, a - 1)
  } else if ('teens' in spec) {
    for (let i = 0; i < TRIES; i++) {
      const x = rng.int(11, 18)
      const y = rng.int(2, 9)
      if (x % 10 < y && x - y >= 2) {
        a = x
        b = y
        break
      }
    }
  } else [a, b] = subCols(rng, spec)
  return arith('sub', a, b, a - b, subFact(a, b), level)
}

function mulTable(rng: Rng, tables: readonly number[], level: number): QmProblem {
  const t = rng.pick(tables)
  const n = rng.int(2, t >= 11 ? 12 : 10)
  const [a, b] = rng.chance(0.5) ? [t, n] : [n, t]
  return arith('mul', a, b, a * b, `mul:${t}`, level)
}

function mulNoCarry(a: number, b: number): boolean {
  let x = a
  while (x > 0) {
    if ((x % 10) * b > 9) return false
    x = Math.floor(x / 10)
  }
  return true
}

function genMulMulti(rng: Rng, kind: '2d1d' | '3d1d' | '2d2d', carry: CarryMode, level: number): QmProblem {
  let a = 0
  let b = 0
  for (let i = 0; i < TRIES; i++) {
    if (kind === '2d2d') {
      a = rng.int(12, 25)
      b = rng.int(11, 19)
    } else {
      a = rng.int(kind === '2d1d' ? 11 : 101, kind === '2d1d' ? 99 : 999)
      b = rng.int(2, 9)
    }
    if (a % 10 === 0) continue
    const ok = carry === 'any' || kind === '2d2d' || (carry === 'none' ? mulNoCarry(a, b) : !mulNoCarry(a, b))
    if (ok) break
  }
  if (kind === '2d1d' && carry === 'none' && !mulNoCarry(a, b)) {
    a = 21
    b = 4
  }
  return arith('mul', a, b, a * b, `mul:${kind}`, level)
}

function genMul(rng: Rng, level: number): QmProblem {
  if (level <= 5) return mulTable(rng, TABLES_BY_LEVEL[level - 1]!, level)
  if (level === 6) return genMulMulti(rng, '2d1d', 'none', level)
  if (level === 7) return genMulMulti(rng, '2d1d', 'any', level)
  return genMulMulti(rng, '2d2d', 'any', level)
}

function divTable(rng: Rng, tables: readonly number[], level: number): QmProblem {
  const d = rng.pick(tables)
  const q = rng.int(2, d >= 11 ? 12 : 10)
  return arith('div', d * q, d, q, `div:${d}`, level)
}

function genDivMulti(rng: Rng, kind: 'easy' | '2d1d' | '3d1d', level: number): QmProblem {
  let d: number
  let q: number
  if (kind === 'easy') {
    d = rng.int(2, 4)
    const q10 = rng.int(1, Math.floor(9 / d))
    const q1 = rng.int(1, Math.floor(9 / d))
    q = q10 * 10 + q1
  } else if (kind === '2d1d') {
    d = rng.int(2, 9)
    q = rng.int(Math.max(10, Math.ceil(20 / d)), Math.floor(99 / d))
  } else {
    d = rng.int(2, 9)
    q = rng.int(Math.ceil(101 / d), Math.floor(999 / d))
  }
  const fact = kind === '3d1d' ? 'div:3d1d' : 'div:2d1d'
  return arith('div', d * q, d, q, fact, level)
}

function genDiv(rng: Rng, level: number): QmProblem {
  if (level <= 5) return divTable(rng, TABLES_BY_LEVEL[level - 1]!, level)
  if (level === 6) return genDivMulti(rng, 'easy', level)
  if (level === 7) return genDivMulti(rng, '2d1d', level)
  return genDivMulti(rng, '3d1d', level)
}

// ---------------------------------------------------------------------------
// Pengaturan manual (operasi, digit, simpan atau pinjam)

function manualAdd(rng: Rng, cfg: QmConfig): QmProblem {
  const d = cfg.digits === 'mixed' ? rng.int(1, 3) : cfg.digits
  const db = cfg.digits === 'mixed' ? rng.int(1, d) : d
  const [a, b] = addCols(rng, { da: d, db, carry: cfg.carry ? 'force' : 'none' })
  return arith('add', a, b, a + b, addFact(a, b), d * 2)
}

function manualSub(rng: Rng, cfg: QmConfig): QmProblem {
  const d = cfg.digits === 'mixed' ? rng.int(1, 3) : cfg.digits
  if (d === 1) return cfg.carry ? genSub(rng, 2) : genSub(rng, 1)
  const db = cfg.digits === 'mixed' ? rng.int(1, d) : d
  const [a, b] = subCols(rng, { da: d, db, carry: cfg.carry ? 'force' : 'none' })
  return arith('sub', a, b, a - b, subFact(a, b), d * 2)
}

function manualMul(rng: Rng, cfg: QmConfig): QmProblem {
  const d = cfg.digits === 'mixed' ? rng.int(1, 2) : cfg.digits
  if (d === 1) return mulTable(rng, [2, 3, 4, 5, 6, 7, 8, 9], 4)
  return genMulMulti(rng, d === 2 ? '2d1d' : '3d1d', cfg.carry ? 'force' : 'none', d * 3)
}

function manualDiv(rng: Rng, cfg: QmConfig): QmProblem {
  const d = cfg.digits === 'mixed' ? rng.int(1, 2) : cfg.digits
  if (d === 1) return divTable(rng, [2, 3, 4, 5, 6, 7, 8, 9], 4)
  return genDivMulti(rng, d === 2 ? '2d1d' : '3d1d', d * 3)
}

// ---------------------------------------------------------------------------
// Latihan satu strategi (pelajaran)

function genFocus(rng: Rng, focus: StrategyId): QmProblem {
  switch (focus) {
    case 'bonds10': {
      const a = rng.int(1, 9)
      const form = rng.int(0, 2)
      if (form === 0) return arith('add', a, 10 - a, 10, 'add:bond10', 1, true)
      if (form === 1) return { prompt: { kind: 'arith', text: `10 − ${a} = ?` }, answer: 10 - a, fact: 'add:bond10', level: 1, op: 'sub', a: 10, b: a }
      return arith('add', a, 10 - a, 10, 'add:bond10', 1)
    }
    case 'doubles': {
      const near = rng.chance(0.5)
      const a = rng.int(near ? 3 : 2, near ? 8 : 9)
      const b = near ? (rng.chance(0.5) ? a + 1 : a - 1) : a
      const [x, y] = rng.chance(0.5) ? [a, b] : [b, a]
      return arith('add', x, y, x + y, addFact(x, y), 1)
    }
    case 'bridge10': {
      for (let i = 0; i < TRIES; i++) {
        const a = rng.int(6, 9)
        const b = rng.int(3, 9)
        if (a + b > 10 && a !== b && Math.abs(a - b) !== 1) return rng.chance(0.5) ? arith('add', a, b, a + b, 'add:bridge10', 2) : arith('add', b, a, a + b, 'add:bridge10', 2)
      }
      return arith('add', 8, 5, 13, 'add:bridge10', 2)
    }
    case 'compensation': {
      if (rng.chance(0.6)) {
        const base = rng.int(2, 7) * 10 + rng.int(1, 6)
        const k = rng.pick([9, 19, 29, 8, 18])
        return arith('add', base, k, base + k, 'comp:add', 4)
      }
      const a = rng.int(4, 9) * 10 + rng.int(1, 9)
      const k = rng.pick([9, 19, 8, 11])
      return arith('sub', a, k, a - k, 'comp:sub', 4)
    }
    case 'partition': {
      const [a, b] = addCols(rng, { da: 2, db: 2, carry: 'none' })
      return arith('add', a, b, a + b, addFact(a, b), 5)
    }
    case 'left-to-right': {
      const [a, b] = addCols(rng, { da: 2, db: 2, carry: 'force' })
      return arith('add', a, b, a + b, addFact(a, b), 6)
    }
    case 'times-patterns': {
      return mulTable(rng, [2, 5, 9, 10], 2)
    }
  }
}

// ---------------------------------------------------------------------------
// Mode tabel perkalian

function genTables(rng: Rng, cfg: QmConfig, seed: string, index: number): QmProblem {
  const t = Math.max(2, Math.min(12, Math.floor(cfg.table)))
  const block = Math.floor(index / 12)
  const order = createRng(`${seed}#t${block}`).shuffle(Array.from({ length: 12 }, (_, i) => i + 1))
  const n = order[index % 12]!
  if (cfg.division && index % 3 === 2) return arith('div', t * n, t, n, `div:${t}`, 3)
  const [a, b] = rng.chance(0.5) ? [t, n] : [n, t]
  return arith('mul', a, b, a * b, `mul:${t}`, 3)
}

// ---------------------------------------------------------------------------

export function clampLevel(level: number, max = 8): number {
  return Math.max(1, Math.min(max, Math.floor(Number.isFinite(level) ? level : 1)))
}

function genByOp(rng: Rng, op: QmOp, cfg: QmConfig): QmProblem {
  if (cfg.auto) {
    const level = clampLevel(cfg.levels[op])
    return op === 'add' ? genAdd(rng, level) : op === 'sub' ? genSub(rng, level) : op === 'mul' ? genMul(rng, level) : genDiv(rng, level)
  }
  return op === 'add' ? manualAdd(rng, cfg) : op === 'sub' ? manualSub(rng, cfg) : op === 'mul' ? manualMul(rng, cfg) : manualDiv(rng, cfg)
}

/** Soal ke-`index` dari ronde dengan `seed`. */
export function generateProblem(cfg: QmConfig, seed: string, index: number): QmProblem {
  const rng = createRng(`${seed}#${index}`)
  if (cfg.mode === 'flash') return genFlash(rng, clampLevel(cfg.flashLevel))
  if (cfg.mode === 'soroban') return genSoroban(rng, cfg.sorobanStage, clampLevel(cfg.sorobanLevel, 4))
  if (cfg.mode === 'tables') return genTables(rng, cfg, seed, index)
  if (cfg.focus) return genFocus(rng, cfg.focus)
  const op: QmOp = cfg.op === 'mixed' ? rng.pick(QM_OPS) : cfg.op
  return genByOp(rng, op, cfg)
}

/** Bagian soal yang aman dikirim ke client. */
export function clientPrompts(cfg: QmConfig, seed: string): QmProblem['prompt'][] {
  return Array.from({ length: cfg.count }, (_, i) => generateProblem(cfg, seed, i).prompt)
}
