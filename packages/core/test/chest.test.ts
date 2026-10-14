import { describe, expect, it } from 'vitest'
import { CHEST_WEIGHTS, chestStateOf, chestTable, pickChestReward, rewardKey } from '../src'

describe('peti hadiah harian', () => {
  it('hasil sama untuk seed yang sama', () => {
    const a = pickChestReward('learner-1:2026-10-14', new Set())
    const b = pickChestReward('learner-1:2026-10-14', new Set())
    expect(a).toEqual(b)
  })

  it('mendahulukan hadiah yang belum dimiliki', () => {
    const owned = new Set(
      chestTable()
        .filter((r) => r.kind === 'sticker')
        .map((r) => rewardKey(r.kind, r.id)),
    )
    for (let d = 0; d < 40; d++) {
      const { reward, isNew } = pickChestReward(`x:${d}`, owned)
      expect(isNew).toBe(true)
      expect(reward.kind).not.toBe('sticker')
    }
  })

  it('semua sudah dimiliki: tetap memberi hadiah, tanda isNew mati', () => {
    const owned = new Set(chestTable().map((r) => rewardKey(r.kind, r.id)))
    const { reward, isNew } = pickChestReward('y:1', owned)
    expect(isNew).toBe(false)
    expect(reward.id.length).toBeGreaterThan(0)
  })

  it('stiker paling sering, aksesori paling jarang', () => {
    const count = { sticker: 0, background: 0, accessory: 0 }
    for (let d = 0; d < 600; d++) count[pickChestReward(`dist:${d}`, new Set()).reward.kind]++
    expect(count.sticker).toBeGreaterThan(count.background)
    expect(count.background).toBeGreaterThan(count.accessory)
    expect(Object.values(CHEST_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('keadaan peti', () => {
    expect(chestStateOf({ rest: true, doneCount: 0, totalCount: 0, openedToday: false })).toBe('none')
    expect(chestStateOf({ rest: false, doneCount: 2, totalCount: 9, openedToday: false })).toBe('locked')
    expect(chestStateOf({ rest: false, doneCount: 9, totalCount: 9, openedToday: false })).toBe('ready')
    expect(chestStateOf({ rest: false, doneCount: 9, totalCount: 9, openedToday: true })).toBe('opened')
  })

  it('kata terlarang tidak muncul di label', () => {
    for (const r of chestTable()) expect(r.label.toLowerCase()).not.toMatch(/unlock/)
  })
})
