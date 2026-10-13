import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TTS_STYLE_IDS, TTS_STYLE_MODEL, isTtsKey, ttsKeyInput } from '@kira/core/tts'

const styles = JSON.parse(readFileSync(join(__dirname, '../../../deploy/tts/styles.json'), 'utf8')) as {
  models: Record<string, string>
  styles: Record<string, { model: string; voices: ({ design?: string; speaker?: string })[]; tone: Record<string, string> }>
}

describe('pustaka gaya suara (deploy/tts/styles.json)', () => {
  it('memuat persis gaya yang dikenal kode, masing-masing 2 sampai 3 suara', () => {
    expect(Object.keys(styles.styles).sort()).toEqual([...TTS_STYLE_IDS].sort())
    for (const id of TTS_STYLE_IDS) {
      const s = styles.styles[id]!
      expect(s.voices.length).toBeGreaterThanOrEqual(2)
      expect(s.voices.length).toBeLessThanOrEqual(3)
      expect(s.model).toBe(TTS_STYLE_MODEL[id])
    }
  })
  it('nada pujian, pertanyaan, dan perintah berbeda untuk setiap gaya', () => {
    for (const id of TTS_STYLE_IDS) {
      const t = styles.styles[id]!.tone
      for (const k of ['statement', 'question', 'instruction', 'praise']) expect(t[k]).toBeTruthy()
      expect(new Set([t.question, t.instruction, t.praise, t.statement]).size).toBe(4)
    }
  })
  it('suara gaya design punya deskripsi dan gaya custom punya nama pembicara', () => {
    for (const id of TTS_STYLE_IDS) {
      for (const v of styles.styles[id]!.voices) {
        if (TTS_STYLE_MODEL[id] === 'design') expect(v.design).toBeTruthy()
        else expect(v.speaker).toBeTruthy()
      }
    }
    expect(Object.keys(styles.models).sort()).toEqual(['custom', 'design'])
  })
})


describe('kunci klip', () => {
  it('sha256 masukan menghasilkan kunci 64 hex yang dikenali', () => {
    const key = createHash('sha256').update(ttsKeyInput('The cat sat.', 'dictation')).digest('hex')
    expect(isTtsKey(key)).toBe(true)
  })
})
