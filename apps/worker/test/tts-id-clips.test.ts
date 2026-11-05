import { describe, expect, it } from 'vitest'
import { withoutEnglishGloss } from '../src/tts/collect'

describe('bentuk ucapan terjemahan', () => {
  it('istilah Inggris di dalam kurung tidak dibacakan', () => {
    expect(withoutEnglishGloss('Tema (theme) adalah ide besar.', 'A theme is the big idea.')).toBe('Tema adalah ide besar.')
    expect(withoutEnglishGloss('Lalu menjadi ulat (caterpillar), kepompong (chrysalis).', 'Then a caterpillar and a chrysalis.')).toBe('Lalu menjadi ulat, kepompong.')
    expect(withoutEnglishGloss('Kata benda (noun) menyebut nama.', 'Nouns are naming words.')).toBe('Kata benda menyebut nama.')
  })

  it('arti Indonesia dan angka di dalam kurung tetap dibacakan', () => {
    expect(withoutEnglishGloss('Sugar rasanya sweet (manis).', 'Sugar tastes sweet.')).toBe('Sugar rasanya sweet (manis).')
    expect(withoutEnglishGloss('Jumlahnya (3 + 4) sama dengan 7.', 'The total (3 + 4) is 7.')).toBe('Jumlahnya (3 + 4) sama dengan 7.')
  })

  it('teks tanpa kurung tidak berubah', () => {
    expect(withoutEnglishGloss('Disagree berarti tidak setuju.', 'Disagree means not agree.')).toBe('Disagree berarti tidak setuju.')
  })
})
