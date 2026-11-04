import { describe, expect, it } from 'vitest'
import { DEFAULT_QM_LEVELS, generateRound, problemSignature, type QmConfig } from '../src/quickmaths'

const base: QmConfig = { mode: 'practice', op: 'mixed', digits: 1, carry: false, auto: true, levels: DEFAULT_QM_LEVELS, table: 3, division: false, flashLevel: 1, sorobanStage: 'read', sorobanLevel: 1, focus: null, count: 20 }

describe('ronde Quick Maths', () => {
  it('tidak ada dua soal sama dalam satu ronde, juga operan yang ditukar (7 + 5 dan 5 + 7)', () => {
    for (const op of ['add', 'sub', 'mul', 'div', 'mixed'] as const) {
      for (let level = 1; level <= 4; level++) {
        for (let s = 0; s < 40; s++) {
          const round = generateRound({ ...base, op, levels: { add: level, sub: level, mul: level, div: level } }, `seed${s}`)
          const sigs = round.map(problemSignature)
          expect(new Set(sigs).size, `${op} L${level} seed${s}`).toBe(sigs.length)
        }
      }
    }
  })
})
