import { describe, expect, it } from 'vitest'
import { spokenIndonesian, TTS_ID_SERVED_VERSION_FILE, TTS_ID_VOICE_VERSION, TTS_SERVED_VERSION_FILE, TTS_VOICE_VERSION, ttsKeyInput } from '../src/tts'

describe('suara Indonesia', () => {
  it('versi dan penunjuknya terpisah dari suara Inggris', () => {
    expect(TTS_ID_VOICE_VERSION).not.toBe(TTS_VOICE_VERSION)
    expect(TTS_ID_SERVED_VERSION_FILE).not.toBe(TTS_SERVED_VERSION_FILE)
    expect(ttsKeyInput('Halo.', 'indonesian', TTS_ID_VOICE_VERSION)).not.toBe(ttsKeyInput('Halo.', 'teacher'))
  })

  it.each([
    ['3 x 4 = 12', '3 kali 4 sama dengan 12'],
    ['12 × 3 = 36', '12 kali 3 sama dengan 36'],
    ['1,000 + 2,500 = 3,500', '1000 tambah 2500 sama dengan 3500'],
    ['1,000,000 itu besar.', '1000000 itu besar.'],
    ['3.5 cm', '3 koma 5 sentimeter'],
    ['50% dari 200', '50 persen dari 200'],
    ['Rp5.000', '5000 rupiah'],
    ['7 - 3 = 4', '7 kurang 3 sama dengan 4'],
    ['1/2 dari 8', '1 per 2 dari 8'],
    ['25°C', '25 derajat Celsius'],
    ['10 m dan 5 kg', '10 meter dan 5 kilogram'],
    ['Suhunya -3 °C.', 'Suhunya minus 3 derajat Celsius.'],
    ['Luasnya 12 m² dan volumenya 8 cm³.', 'Luasnya 12 meter persegi dan volumenya 8 sentimeter kubik.'],
  ])('%s diucapkan %s', (shown, spoken) => {
    expect(spokenIndonesian(shown)).toBe(spoken)
  })

  it('kata ulang, awalan, dan tanda hubung lain tidak berubah', () => {
    expect(spokenIndonesian('Kupu-kupu dan dis- tetap.')).toBe('Kupu-kupu dan dis- tetap.')
  })
})
