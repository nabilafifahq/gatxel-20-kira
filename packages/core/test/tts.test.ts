import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  TTS_CLIP_MAX_CHARS,
  TTS_STYLE_IDS,
  TTS_STYLE_MODEL,
  isClipText,
  isTtsKey,
  normalizeTtsText,
  sentenceKind,
  spokenBlanks,
  splitClipText,
  splitSentences,
  toSegments,
  clipTextsOf,
  letterClip,
  speakableParts,
  styleForPassageKind,
  styleForSkill,
  ttsKeyFromFile,
  ttsKeyInput,
  ttsSeed,
} from '../src/tts'

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
  it('menormalkan spasi dan membedakan gaya', () => {
    expect(normalizeTtsText('  Hello   there\n friend ')).toBe('Hello there friend')
    expect(ttsKeyInput('Hello  there', 'teacher')).toBe('teacher\nHello there')
    expect(ttsKeyInput('Hello there', 'narrator')).not.toBe(ttsKeyInput('Hello there', 'teacher'))
  })
  it('sha256 masukan menghasilkan kunci 64 hex yang dikenali', () => {
    const key = createHash('sha256').update(ttsKeyInput('The cat sat.', 'dictation')).digest('hex')
    expect(isTtsKey(key)).toBe(true)
    expect(ttsKeyFromFile(`${key}.mp3`)).toBe(key)
    expect(ttsKeyFromFile(`../${key}.mp3`)).toBeNull()
    expect(ttsKeyFromFile(`${key}.wav`)).toBeNull()
    expect(isTtsKey('abc')).toBe(false)
    expect(ttsSeed(key)).toBe(parseInt(key.slice(0, 8), 16))
  })
})

describe('kalimat', () => {
  it('menggolongkan pujian, pertanyaan, perintah, dan kalimat biasa', () => {
    expect(sentenceKind('Well done!')).toBe('praise')
    expect(sentenceKind('Great job, Syakira.')).toBe('praise')
    expect(sentenceKind('What can you see in the picture?')).toBe('question')
    expect(sentenceKind('Choose the right word.')).toBe('instruction')
    expect(sentenceKind('Listen and tick the box.')).toBe('instruction')
    expect(sentenceKind('The cat sat on the mat.')).toBe('statement')
    expect(sentenceKind('')).toBe('statement')
  })
  it('memecah kalimat tanpa memotong singkatan', () => {
    expect(splitSentences('Mr. Brown has a dog. It is big! Is it nice?')).toEqual(['Mr. Brown has a dog.', 'It is big!', 'Is it nice?'])
    expect(toSegments('Look at the picture. What is the girl doing?').map((s) => s.kind)).toEqual(['instruction', 'question'])
  })
  it('kata ___ dibacakan sebagai blank', () => {
    expect(spokenBlanks('The cat is ___ the box.')).toBe('The cat is blank the box.')
  })
})

describe('pemecah klip', () => {
  it('teks pendek tetap satu klip', () => {
    expect(splitClipText('Read the sentence. Choose the missing word.')).toEqual(['Read the sentence. Choose the missing word.'])
  })
  it('teks panjang dipecah di batas kalimat dan paragraf, tiap potongan di bawah batas', () => {
    const sentence = 'The little fox ran across the quiet field to find his friend.'
    const text = `${Array(12).fill(sentence).join(' ')}\n\nA second paragraph starts here.`
    const parts = splitClipText(text)
    expect(parts.length).toBeGreaterThan(2)
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(TTS_CLIP_MAX_CHARS)
    expect(parts[parts.length - 1]).toBe('A second paragraph starts here.')
    expect(parts.join(' ').replace(/\s+/g, ' ')).toContain('The little fox ran')
  })
  it('satu kalimat sangat panjang tetap terpecah di bawah batas', () => {
    const long = Array(80).fill('word').join(' ') + '.'
    for (const p of splitClipText(long, 100)) expect(p.length).toBeLessThanOrEqual(100)
  })
  it('hasilnya deterministik', () => {
    const t = 'One. Two two. Three three three.'
    expect(splitClipText(t, 10)).toEqual(splitClipText(t, 10))
  })
  it('isClipText menolak teks tanpa huruf atau terlalu panjang', () => {
    expect(isClipText('cat')).toBe(true)
    expect(isClipText('12')).toBe(true)
    expect(isClipText('?!')).toBe(false)
    expect(isClipText('a'.repeat(TTS_CLIP_MAX_CHARS + 1))).toBe(false)
  })
})

describe('bagian soal yang dibacakan', () => {
  it('opsi dibacakan satu per satu dengan penanda huruf, tanpa tergantung urutan lain', () => {
    const parts = speakableParts({ prompt: 'The cat is ___ the box.', options: ['on', 'in', 'under'] })
    expect(parts).toEqual(['The cat is blank the box.', 'Option A.', 'on', 'Option B.', 'in', 'Option C.', 'under'])
    expect(clipTextsOf(parts)).toEqual(parts)
    expect(letterClip(1)).toBe('Option B.')
  })
  it('opsi yang diacak menghasilkan himpunan klip yang sama', () => {
    const a = new Set(clipTextsOf(speakableParts({ prompt: 'Pick one.', options: ['cat', 'dog'] })))
    const b = new Set(clipTextsOf(speakableParts({ prompt: 'Pick one.', options: ['dog', 'cat'] })))
    expect([...a].filter((t) => !t.startsWith('Option')).sort()).toEqual([...b].filter((t) => !t.startsWith('Option')).sort())
  })
  it('gaya mengikuti skill dan jenis bacaan', () => {
    expect(styleForSkill('e2.spelling-bee')).toBe('dictation')
    expect(styleForSkill('e2.dictation')).toBe('dictation')
    expect(styleForSkill('e2.magic-e')).toBe('teacher')
    expect(styleForPassageKind('story')).toBe('narrator')
    expect(styleForPassageKind('information')).toBe('teacher')
  })
})
