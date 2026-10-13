/**
 * Tipe Quick Maths (arena Hitung Cepat). Semua soal dibuat deterministik dari (config, seed, index)
 * di server; client hanya menerima `QmPrompt`, tidak pernah `answer`.
 */

export const QM_OPS = ['add', 'sub', 'mul', 'div'] as const
export type QmOp = (typeof QM_OPS)[number]
export type QmOpChoice = QmOp | 'mixed'
export type QmDigits = 1 | 2 | 3 | 'mixed'

export const QM_MODES = ['practice', 'sprint60', 'sprint120', 'target20', 'tables', 'flash', 'soroban'] as const
export type QmMode = (typeof QM_MODES)[number]

export const SOROBAN_STAGES = ['read', 'set', 'anzan'] as const
export type SorobanStage = (typeof SOROBAN_STAGES)[number]

export const STRATEGY_IDS = ['bonds10', 'doubles', 'bridge10', 'compensation', 'partition', 'left-to-right', 'times-patterns'] as const
export type StrategyId = (typeof STRATEGY_IDS)[number]

export const QM_MIN_LEVEL = 1
export const QM_MAX_LEVEL = 8
export const FLASH_MAX_LEVEL = 8
export const SOROBAN_MAX_LEVEL = 4

export type QmLevels = Record<QmOp, number>

/** Pengaturan satu ronde, disimpan di arena_session.config. */
export type QmConfig = {
  mode: QmMode
  op: QmOpChoice
  digits: QmDigits
  /** Ya: soal dengan simpanan atau pinjaman. Tidak: tanpa simpanan atau pinjaman. */
  carry: boolean
  /** Level otomatis dari kemampuan (adaptif) memakai `levels`. */
  auto: boolean
  levels: QmLevels
  /** Mode tabel perkalian: tabel 2 sampai 12. */
  table: number
  division: boolean
  flashLevel: number
  sorobanStage: SorobanStage
  sorobanLevel: number
  /** Latihan satu strategi (pelajaran). */
  focus: StrategyId | null
  /** Jumlah soal yang disiapkan. */
  count: number
}

export type QmPrompt =
  /** `text` sudah lengkap, misalnya "7 + 5 = ?" atau "6 + ? = 10". */
  | { kind: 'arith'; text: string }
  /** `terms` bertanda: angka negatif berarti dikurangi. Setiap angka tampil `intervalMs`. */
  | { kind: 'flash'; terms: number[]; intervalMs: number }
  | { kind: 'bead-read'; rods: number; digits: number[] }
  | { kind: 'bead-set'; rods: number; target: number }
  | { kind: 'bead-anzan'; rods: number; digits: number[]; showMs: number; add: number | null }

export type QmProblem = {
  prompt: QmPrompt
  answer: number
  /** Kunci jenis soal untuk statistik, misalnya "add:bridge10" atau "mul:7". */
  fact: string
  level: number
  op: QmOp | 'flash' | 'soroban'
  /** Operan untuk petunjuk strategi (soal aritmetika saja). */
  a?: number
  b?: number
  /** Bentuk soal bilangan hilang: "6 + ? = 10". */
  missing?: boolean
}

export const OP_SYMBOL: Record<QmOp, string> = { add: '+', sub: '−', mul: '×', div: '÷' }

export const DEFAULT_QM_LEVELS: QmLevels = { add: 3, sub: 3, mul: 2, div: 1 }
