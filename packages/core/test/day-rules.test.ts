import { describe, expect, it } from 'vitest'
import { DEFAULT_PRESET, composeDay, detectPreset, effectiveRules, normaliseRules, presetRules, ruleLevel } from '../src'

const WED = '2026-11-04'
const SAT = '2026-11-07'
const SUN = '2026-11-08'

describe('aturan hari', () => {
  it('bawaan Seimbang: 9 sesi, hanya 3 Latihan wajib', () => {
    expect(DEFAULT_PRESET).toBe('seimbang')
    const e = composeDay({ template: 'school', date: WED, slots: [], rules: presetRules('seimbang') })
    expect(e).toHaveLength(9)
    expect(e.filter((x) => x.required).map((x) => x.session)).toEqual(['latihan', 'latihan', 'latihan'])
  })
  it('Penuh 9 wajib, Ringan 3 sesi saja', () => {
    expect(composeDay({ template: 'school', date: WED, slots: [], rules: presetRules('penuh') }).filter((x) => x.required)).toHaveLength(9)
    expect(composeDay({ template: 'school', date: WED, slots: [], rules: presetRules('ringan') })).toHaveLength(3)
  })
  it('paper penuh Sabtu hanya bila Paper tidak Mati', () => {
    const on = composeDay({ template: 'saturday', date: SAT, slots: [], rules: presetRules('seimbang') })
    expect(on.filter((x) => x.paper === 'full')).toHaveLength(1)
    const off = composeDay({ template: 'saturday', date: SAT, slots: [], rules: presetRules('ringan') })
    expect(off.some((x) => x.session === 'paper')).toBe(false)
  })
  it('Minggu memakai aturan Sabtu, dan preset dikenali kembali', () => {
    expect(ruleLevel(presetRules('penuh'), SUN, 'math', 'tes')).toBe('required')
    expect(detectPreset(presetRules('ringan'))).toBe('ringan')
    const custom = normaliseRules({ '1': { math: { paper: 'off' } } }, presetRules('penuh'))
    expect(detectPreset(custom)).toBe('kustom')
    expect(effectiveRules('kustom', null)).toEqual(presetRules('seimbang'))
  })
  it('slot dasar menggantikan sesi dasar dan membawa Wajib atau Opsional; slot off mematikannya', () => {
    const slots = [
      { id: 'a', subject: 'math', session: 'tes', required: true, paperKind: null, order: 0, base: true },
      { id: 'b', subject: 'math', session: 'latihan', required: false, paperKind: null, order: 1, base: true, off: true },
    ] as const
    const e = composeDay({ template: 'school', date: WED, slots: [...slots], rules: presetRules('seimbang') })
    expect(e.find((x) => x.slotId === 'a')?.required).toBe(true)
    expect(e.some((x) => x.subject === 'math' && x.session === 'latihan')).toBe(false)
  })
})
