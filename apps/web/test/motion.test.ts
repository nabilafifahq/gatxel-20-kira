import { describe, expect, it } from 'vitest'
import { comboLevel } from '@/components/learner/ComboStars'
import { countUpValue } from '@/components/learner/CountUp'
import { mascotMoodFor } from '@/components/learner/Mascot'
import { isTapTarget } from '@/components/learner/TapSound'

/** Elemen tiruan: cukup `closest` dan atribut yang dibaca isTapTarget. */
function el(opts: {
  control?: boolean
  disabled?: boolean
  ariaDisabled?: boolean
  noTap?: boolean
}): Element {
  const control = {
    hasAttribute: (n: string) => n === 'disabled' && Boolean(opts.disabled),
    getAttribute: (n: string) => (n === 'aria-disabled' && opts.ariaDisabled ? 'true' : null),
    closest: (sel: string) => (sel === '[data-no-tap]' ? (opts.noTap ? {} : null) : null),
  }
  return { closest: () => (opts.control === false ? null : control) } as unknown as Element
}

describe('gerak learner', () => {
  it('tingkat kombo naik di 3, 5, dan 7 jawaban beruntun', () => {
    expect([0, 2, 3, 4, 5, 6, 7, 20].map(comboLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
  })

  it('hitung naik berakhir tepat di nilai akhir dan tidak pernah melewatinya', () => {
    expect(countUpValue(80, 0, 900)).toBe(0)
    expect(countUpValue(80, 900, 900)).toBe(80)
    expect(countUpValue(80, 5000, 900)).toBe(80)
    let last = 0
    for (let t = 0; t <= 900; t += 50) {
      const v = countUpValue(80, t, 900)
      expect(v).toBeGreaterThanOrEqual(last)
      expect(v).toBeLessThanOrEqual(80)
      last = v
    }
  })

  it('suasana maskot: benar melompat, Not yet mengangguk, soal berwaktu berpikir', () => {
    expect(mascotMoodFor({ phase: 'correct', timed: false })).toBe('cheer')
    expect(mascotMoodFor({ phase: 'not-yet', timed: false })).toBe('encourage')
    expect(mascotMoodFor({ phase: 'revealed', timed: true })).toBe('encourage')
    expect(mascotMoodFor({ phase: 'answer', timed: true })).toBe('think')
    expect(mascotMoodFor({ phase: 'answer', timed: false })).toBe('idle')
  })

  it('bunyi ketuk hanya untuk kontrol yang aktif dan tidak ditandai data-no-tap', () => {
    expect(isTapTarget(el({}))).toBe(true)
    expect(isTapTarget(el({ control: false }))).toBe(false)
    expect(isTapTarget(el({ disabled: true }))).toBe(false)
    expect(isTapTarget(el({ ariaDisabled: true }))).toBe(false)
    expect(isTapTarget(el({ noTap: true }))).toBe(false)
    expect(isTapTarget(null)).toBe(false)
  })
})
