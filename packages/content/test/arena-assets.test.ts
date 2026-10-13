import { describe, expect, it } from 'vitest'
import { ACCESSORY_IDS } from '@kira/core'
import { ACCESSORY_ART_IDS, PLANET_ART_NAMES } from '@kira/figures'
import { PLANET_NAMES } from '../src/knowledge/types'

describe('aset arena lintas paket', () => {
  it('semua id aksesori di core punya gambar di figures, dan sebaliknya', () => {
    expect([...ACCESSORY_ART_IDS].sort()).toEqual([...ACCESSORY_IDS].sort())
  })

  it('nama planet di data Quiz Arena sama dengan gambar planet di figures', () => {
    expect([...PLANET_NAMES].sort()).toEqual([...PLANET_ART_NAMES].sort())
  })
})
