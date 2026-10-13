/**
 * Flash Anzan dan sempoa (soroban) virtual.
 * Sempoa: satu manik atas bernilai 5, empat manik bawah masing-masing bernilai 1, per batang satu angka.
 */
import type { Rng } from '../rng'
import type { QmProblem, SorobanStage } from './types'

export type FlashLevelSpec = { terms: number; digits: 1 | 2; signs: boolean; intervalMs: number }

export const FLASH_LEVELS: readonly FlashLevelSpec[] = [
  { terms: 3, digits: 1, signs: false, intervalMs: 1500 },
  { terms: 4, digits: 1, signs: false, intervalMs: 1200 },
  { terms: 4, digits: 1, signs: true, intervalMs: 1000 },
  { terms: 5, digits: 1, signs: true, intervalMs: 900 },
  { terms: 3, digits: 2, signs: false, intervalMs: 1200 },
  { terms: 4, digits: 2, signs: true, intervalMs: 1000 },
  { terms: 5, digits: 2, signs: true, intervalMs: 900 },
  { terms: 6, digits: 2, signs: true, intervalMs: 800 },
]

export function describeFlashLevel(level: number): string {
  const s = FLASH_LEVELS[Math.max(1, Math.min(FLASH_LEVELS.length, level)) - 1]!
  const size = s.digits === 1 ? '1-digit' : '2-digit'
  return `${s.terms} ${size} numbers, ${s.signs ? 'adding and taking away' : 'adding'}, ${(s.intervalMs / 1000).toFixed(1)} s each`
}

export function genFlash(rng: Rng, level: number): QmProblem {
  const spec = FLASH_LEVELS[Math.max(1, Math.min(FLASH_LEVELS.length, level)) - 1]!
  const lo = spec.digits === 1 ? 1 : 10
  const hi = spec.digits === 1 ? 9 : 99
  const terms: number[] = []
  let running = 0
  for (let k = 0; k < spec.terms; k++) {
    const prev = terms[k - 1] === undefined ? 0 : Math.abs(terms[k - 1]!)
    const subtract = k > 0 && spec.signs && rng.chance(0.4) && running > lo
    let n = 0
    for (let tries = 0; tries < 60; tries++) {
      n = subtract ? rng.int(lo, Math.min(hi, running)) : rng.int(lo, hi)
      if (n !== prev) break
    }
    if (subtract && n > running) n = running
    terms.push(subtract ? -n : n)
    running += subtract ? -n : n
  }
  return { prompt: { kind: 'flash', terms, intervalMs: spec.intervalMs }, answer: running, fact: `flash:L${level}`, level, op: 'flash' }
}

// ---------------------------------------------------------------------------
// Sempoa

/** Jumlah batang untuk level sempoa 1 sampai 4. */
export const SOROBAN_RODS = [1, 2, 2, 3] as const

export function sorobanDigits(value: number, rods: number): number[] {
  const text = String(Math.max(0, Math.floor(value))).padStart(rods, '0').slice(-rods)
  return [...text].map(Number)
}

export function digitsToNumber(digits: readonly number[]): number {
  return digits.reduce((n, d) => n * 10 + d, 0)
}

/** Manik satu batang: `heaven` 0 atau 1 (bernilai 5), `earth` 0 sampai 4 (masing-masing 1). */
export type RodBeads = { heaven: 0 | 1; earth: 0 | 1 | 2 | 3 | 4 }

export function beadsOfDigit(d: number): RodBeads {
  const digit = Math.max(0, Math.min(9, Math.floor(d)))
  return { heaven: digit >= 5 ? 1 : 0, earth: (digit % 5) as RodBeads['earth'] }
}

export function digitOfBeads(b: RodBeads): number {
  return b.heaven * 5 + b.earth
}

export function describeSorobanStage(stage: SorobanStage): string {
  return stage === 'read' ? 'Read the beads' : stage === 'set' ? 'Set the beads' : 'Soroban in your head'
}

function sorobanTarget(rng: Rng, level: number): number {
  switch (level) {
    case 1:
      return rng.int(1, 9)
    case 2:
      return rng.int(1, 9) * 10 + rng.int(1, 9)
    case 3:
      return rng.int(10, 99)
    default:
      return rng.int(100, 999)
  }
}

export function genSoroban(rng: Rng, stage: SorobanStage, level: number): QmProblem {
  const lv = Math.max(1, Math.min(4, level))
  const rods = SOROBAN_RODS[lv - 1]!
  const value = sorobanTarget(rng, lv)
  if (stage === 'read') {
    return { prompt: { kind: 'bead-read', rods, digits: sorobanDigits(value, rods) }, answer: value, fact: 'soroban:read', level: lv, op: 'soroban' }
  }
  if (stage === 'set') {
    return { prompt: { kind: 'bead-set', rods, target: value }, answer: value, fact: 'soroban:set', level: lv, op: 'soroban' }
  }
  // anzan: manik tampil sebentar, lalu hilang. Dari level 3, tambahkan satu bilangan di kepala.
  const showMs = [2500, 3000, 2000, 3000][lv - 1]!
  const add = lv >= 3 ? (lv === 3 ? rng.int(1, 9) : rng.int(10, 99)) : null
  return {
    prompt: { kind: 'bead-anzan', rods, digits: sorobanDigits(value, rods), showMs, add },
    answer: value + (add ?? 0),
    fact: 'soroban:anzan',
    level: lv,
    op: 'soroban',
  }
}
