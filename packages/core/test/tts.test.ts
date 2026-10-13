import { describe, expect, it } from 'vitest'
import {
  TTS_CLIP_MAX_CHARS,
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

describe('kunci klip', () => {
  it('menormalkan spasi dan membedakan gaya', () => {
    expect(normalizeTtsText('  Hello   there\n friend ')).toBe('Hello there friend')
    expect(ttsKeyInput('Hello  there', 'teacher')).toBe('teacher\nHello there')
    expect(ttsKeyInput('Hello there', 'narrator')).not.toBe(ttsKeyInput('Hello there', 'teacher'))
  })
  it('sha256 masukan menghasilkan kunci 64 hex yang dikenali', () => {
    const key = 'ab12'.repeat(16)
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
  it('jenis soal baru dibacakan per bagian: cerita bertahap, kepingan, isian, label, dan tabel', () => {
    const parts = speakableParts({
      prompt: 'Mia has 8 mangoes.',
      parts: [{ prompt: 'How many?' }, { prompt: 'Who?', options: ['Mia', 'Sam'] }],
      tiles: ['we', 'eat'],
      cloze: [['walks', 'walk']],
      labels: ['root'],
      table: { head: ['Animal', 'Legs'], rows: [['Cat', '4'], ['Bird', '']] },
    })
    expect(parts).toEqual([
      'Mia has 8 mangoes.', 'How many?', 'Who?', 'Option A.', 'Mia', 'Option B.', 'Sam', 'we', 'eat',
      'Blank 1.', 'walks', 'walk', 'root', 'Animal, Legs', 'Cat, 4', 'Bird, blank',
    ])
  })
  it('gaya mengikuti skill dan jenis bacaan', () => {
    expect(styleForSkill('e2.spelling-bee')).toBe('dictation')
    expect(styleForSkill('e2.dictation')).toBe('dictation')
    expect(styleForSkill('e2.magic-e')).toBe('teacher')
    expect(styleForPassageKind('story')).toBe('narrator')
    expect(styleForPassageKind('information')).toBe('teacher')
  })
})
