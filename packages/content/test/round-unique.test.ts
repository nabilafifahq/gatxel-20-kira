import { describe, expect, it } from 'vitest'
import { planRound, questionSignature, roundQuestion } from '../src/knowledge'
import { TOPIC_IDS } from '../src/knowledge/types'

describe('ronde Quiz Arena', () => {
  it('tidak menanyakan hal yang sama dua kali dalam satu ronde', () => {
    for (const topic of [...TOPIC_IDS, 'mix' as const]) {
      for (const mode of ['quiz', 'speed'] as const) {
        for (let s = 0; s < 12; s++) {
          const seed = `s${s}`
          const plan = planRound({ topic, mode, seed, know: {} })
          const sigs = plan.map((_, i) => questionSignature(roundQuestion(plan, seed, i)))
          expect(new Set(sigs).size, `${topic} ${mode} ${seed}`).toBe(sigs.length)
        }
      }
    }
  })
})
