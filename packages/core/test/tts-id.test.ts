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
    ['180 - 140 = 40°.', '180 kurang 140 sama dengan 40 derajat.'],
    ['7 ÷ 40 = 0.175', '7 dibagi 40 sama dengan 0 koma 1 7 5'],
    ['0.25 sama dengan 25%.', '0 koma 2 5 sama dengan 25 persen.'],
    ['3.125 kurang 1.5', '3 koma 1 2 5 kurang 1 koma 5'],
    ['Kembaliannya 50.000 - 22.500 = Rp27.500.', 'Kembaliannya 50000 kurang 22500 sama dengan 27500 rupiah.'],
    ['Rp7.125 dan Rp1,250', '7125 rupiah dan 1250 rupiah'],
    ['Harga 12.50 dolar.', 'Harga 12 koma 5 0 dolar.'],
    ['Luasnya 12 m² dan volumenya 8 cm³.', 'Luasnya 12 meter persegi dan volumenya 8 sentimeter kubik.'],
  ])('%s diucapkan %s', (shown, spoken) => {
    expect(spokenIndonesian(shown)).toBe(spoken)
  })

  it('kata ulang, awalan, dan tanda hubung lain tidak berubah', () => {
    expect(spokenIndonesian('Kupu-kupu dan dis- tetap.')).toBe('Kupu-kupu dan dis- tetap.')
  })
})
