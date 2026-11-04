import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TTS_STYLE_IDS, TTS_STYLE_VOICE, TTS_VOICE_VERSION, isTtsKey, ttsKeyInput } from '@kira/core/tts'

const styles = JSON.parse(readFileSync(join(__dirname, '../../../deploy/tts/styles.json'), 'utf8')) as {
  voiceVersion: string
  models: Record<string, string>
  styles: Record<string, { voice: string; speed: number; gapMs: number }>
}

describe('aturan suara tetap (deploy/tts/styles.json)', () => {
  it('memuat persis peran yang dikenal kode, tiap peran satu suara tetap', () => {
    expect(Object.keys(styles.styles).sort()).toEqual([...TTS_STYLE_IDS].sort())
    for (const id of TTS_STYLE_IDS) {
      const s = styles.styles[id]!
      expect(typeof s.voice).toBe('string') // satu suara, bukan daftar yang diputar
      expect(s.voice).toBe(TTS_STYLE_VOICE[id])
      expect(s.speed).toBeGreaterThan(0.6)
      expect(s.speed).toBeLessThan(1.3)
    }
  })
  it('hanya dua suara Inggris berbeda, keduanya Inggris Britania; suara utama dipakai guru, kuis, dan dikte', () => {
    const voices = new Set(Object.entries(styles.styles).filter(([id]) => id !== 'indonesian').map(([, s]) => s.voice))
    expect(voices.size).toBeLessThanOrEqual(2)
    for (const v of voices) expect(v).toMatch(/^b[fm]_/)
    expect(styles.styles.teacher!.voice).toBe(styles.styles.quizhost!.voice)
    expect(styles.styles.teacher!.voice).toBe(styles.styles.dictation!.voice)
    expect(styles.styles.second!.voice).not.toBe(styles.styles.teacher!.voice)
  })
  it('kuis lebih cepat dan dikte lebih lambat dari suara guru (orang yang sama, kecepatan berbeda)', () => {
    expect(styles.styles.quizhost!.speed).toBeGreaterThan(styles.styles.teacher!.speed)
    expect(styles.styles.dictation!.speed).toBeLessThan(styles.styles.teacher!.speed)
  })
  it('versi suara di berkas sama dengan kode, dan model Kokoro terdaftar', () => {
    expect(styles.voiceVersion).toBe(TTS_VOICE_VERSION)
    expect(Object.keys(styles.models)).toEqual(['kokoro'])
  })
})

describe('kunci klip', () => {
  it('sha256 masukan menghasilkan kunci 64 hex yang dikenali', () => {
    const key = createHash('sha256').update(ttsKeyInput('The cat sat.', 'dictation')).digest('hex')
    expect(isTtsKey(key)).toBe(true)
  })
})
