import { describe, expect, it } from 'vitest'
import { EMPTY_ROLLED, mergeQmRecords, normaliseRolled } from '../src/arena-rolled'

describe('arena rolled', () => {
  it('menormalkan data aneh menjadi nilai aman', () => {
    expect(normaliseRolled(null)).toEqual(EMPTY_ROLLED)
    expect(normaliseRolled({ rounds: -3, bestSprintPpm: 'x', perfectSprint: 1, speedBest: 5.9 })).toEqual({ ...EMPTY_ROLLED, speedBest: 5 })
    expect(normaliseRolled({ rounds: 4, bestSprintPpm: 22, perfectSprint: true, bestTargetMs: 31500, perfectQuiz: true })).toMatchObject({ rounds: 4, bestSprintPpm: 22, perfectSprint: true, bestTargetMs: 31500, perfectQuiz: true })
  })
  it('menggabungkan rekor Quick Maths dengan ronde yang masih ada', () => {
    const live = { rounds: 5, bestSprintPpm: 12, bestTargetSec: 40 }
    const r = normaliseRolled({ rounds: 10, bestSprintPpm: 20, bestTargetMs: 30_000 })
    expect(mergeQmRecords(live, r)).toEqual({ rounds: 15, bestSprintPpm: 20, bestTargetSec: 30 })
    expect(mergeQmRecords({ rounds: 0, bestSprintPpm: null, bestTargetSec: null }, EMPTY_ROLLED)).toEqual({ rounds: 0, bestSprintPpm: null, bestTargetSec: null })
  })
})
