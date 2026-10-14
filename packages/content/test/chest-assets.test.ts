import { describe, expect, it } from 'vitest'
import { CHEST_ACCESSORIES, CHEST_BACKGROUNDS, CHEST_STICKERS } from '@kira/core'
import { AVATAR_BACKGROUND_IDS, CHEST_ART_IDS, ICON_NAMES } from '@kira/figures'

describe('aset peti hadiah lintas paket', () => {
  it('setiap stiker punya ikon', () => {
    for (const s of CHEST_STICKERS) expect(ICON_NAMES as readonly string[]).toContain(s.id)
  })
  it('aksesori peti sama dengan gambarnya', () => {
    expect([...CHEST_ART_IDS].sort()).toEqual(CHEST_ACCESSORIES.map((a) => a.id).sort())
  })
  it('latar peti sama dengan gambarnya', () => {
    expect([...AVATAR_BACKGROUND_IDS].sort()).toEqual(CHEST_BACKGROUNDS.map((b) => b.id).sort())
  })
})
