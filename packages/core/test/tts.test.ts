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
  TTS_STYLE_IDS,
  TTS_VOICE_VERSION,
  dialogueTurns,
  passageClipPlan,
} from '../src/tts'

describe('kunci klip', () => {
  it('menormalkan spasi dan membedakan gaya', () => {
    expect(normalizeTtsText('  Hello   there\n friend ')).toBe('Hello there friend')
    expect(ttsKeyInput('Hello  there', 'teacher')).toBe(`${TTS_VOICE_VERSION}\nteacher\nHello there`)
    expect(ttsKeyInput('Hello there', 'dictation')).not.toBe(ttsKeyInput('Hello there', 'teacher'))
  })
  it('sha256 masukan menghasilkan kunci 64 hex yang dikenali', () => {
    const key = 'ab12'.repeat(16)
    expect(isTtsKey(key)).toBe(true)
    expect(ttsKeyFromFile(`${key}.mp3`)).toBe(key)
    expect(ttsKeyFromFile(`../${key}.mp3`)).toBeNull()
    expect(ttsKeyFromFile(`${key}.wav`)).toBeNull()
    expect(isTtsKey('abc')).toBe(false)
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
    expect(styleForPassageKind('story')).toBe('teacher')
    expect(styleForPassageKind('information')).toBe('teacher')
  })
})

describe('suara pembawa acara Quiz Arena', () => {
  it('kalimat pembuka muncul di pertanyaan pertama lalu tiap empat pertanyaan', async () => {
    const { hostIntroLine, QUIZ_HOST_INTROS } = await import('../src/tts')
    expect(hostIntroLine(0)).toBe(QUIZ_HOST_INTROS[0])
    expect([1, 2, 3, 5, 6, 7].map(hostIntroLine)).toEqual([null, null, null, null, null, null])
    const later = [4, 8, 12, 16].map(hostIntroLine)
    expect(later.every((l) => l !== null && (QUIZ_HOST_INTROS as readonly string[]).includes(l))).toBe(true)
    expect(hostIntroLine(-4)).toBeNull()
  })
  it('pujian deretan hanya pada 3, 5, 8, dan 10', async () => {
    const { hostStreakLine } = await import('../src/tts')
    expect([1, 2, 4, 6, 7, 9, 11].map(hostStreakLine)).toEqual([null, null, null, null, null, null, null])
    expect(hostStreakLine(3)).toBe('Three in a row!')
    expect(hostStreakLine(10)).toBe('Ten in a row! Amazing!')
  })
  it('semua kalimat pembawa acara layak jadi klip bergaya quizhost dan ikut batch', async () => {
    const { QUIZ_HOST_LINES, TTS_FIXED_LINES, isClipText } = await import('../src/tts')
    expect(QUIZ_HOST_LINES.length).toBe(8)
    for (const t of QUIZ_HOST_LINES) {
      expect(isClipText(t)).toBe(true)
      expect(TTS_FIXED_LINES).toContainEqual({ text: t, style: 'quizhost' })
    }
  })
})

const sha256 = async (input: string): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)))].map((b) => b.toString(16).padStart(2, '0')).join('')

describe('kunci memuat versi suara', () => {
  it('versi masuk ke masukan hash, jadi klip suara lama (kunci tanpa versi) tidak pernah cocok', async () => {
    const withVersion = await sha256(ttsKeyInput('Hello there', 'teacher'))
    const legacy = await sha256('teacher\nHello there')
    expect(withVersion).not.toBe(legacy)
    expect(ttsKeyInput('Hello there', 'teacher').startsWith(`${TTS_VOICE_VERSION}\n`)).toBe(true)
  })
  it('kunci stabil: teks, peran, dan versi sama selalu menghasilkan kunci sama', async () => {
    const k = (t: string, s: 'teacher' | 'quizhost') => sha256(ttsKeyInput(t, s))
    expect(await k('What is 3 + 4?', 'teacher')).toBe(await k('What is 3 +  4?\n', 'teacher'))
    expect(await k('What is 3 + 4?', 'teacher')).not.toBe(await k('What is 3 + 4?', 'quizhost'))
  })
})

describe('aturan suara', () => {
  it('hanya empat peran: tiga memakai suara utama dan satu suara kedua', () => {
    expect([...TTS_STYLE_IDS]).toEqual(['teacher', 'quizhost', 'dictation', 'second'])
  })
  it('semua jenis bacaan memakai suara utama', () => {
    for (const kind of ['story', 'poem', 'diary', 'letter', 'dialogue', 'information', 'report', 'instructions']) {
      expect(styleForPassageKind(kind)).toBe('teacher')
      if (kind !== 'dialogue') expect(passageClipPlan(kind, 'Once upon a time. There was a cat.').every((c) => c.style === 'teacher')).toBe(true)
    }
  })
  it('dialog dengan tepat dua pembicara: pembicara kedua memakai suara kedua, label tidak dibacakan', () => {
    const text = 'Rani: Can I play with you?\nDika: Yes, you can!\nRani: Thank you.'
    expect(dialogueTurns(text)).toEqual([
      { text: 'Can I play with you?', style: 'teacher' },
      { text: 'Yes, you can!', style: 'second' },
      { text: 'Thank you.', style: 'teacher' },
    ])
    expect(passageClipPlan('dialogue', text).map((c) => c.style)).toEqual(['teacher', 'second', 'teacher'])
  })
  it('petunjuk panggung dilewati; tiga pembicara atau satu pembicara tetap satu suara', () => {
    expect(dialogueTurns('(A room.)\nA: Hi.\nB: (smiling) Hello.')).toEqual([
      { text: 'Hi.', style: 'teacher' },
      { text: 'Hello.', style: 'second' },
    ])
    expect(dialogueTurns('A: Hi.\nB: Hello.\nC: Hey.')).toBeNull()
    expect(dialogueTurns('A: Hi.\nA: Again.')).toBeNull()
    expect(dialogueTurns('Just a plain line.')).toBeNull()
    const three = passageClipPlan('dialogue', 'A: Hi.\nB: Hello.\nC: Hey.')
    expect(new Set(three.map((c) => c.style))).toEqual(new Set(['teacher']))
  })
  it('satu klip selalu satu peran, jadi satu suara dari awal sampai akhir', () => {
    for (const c of passageClipPlan('dialogue', 'A: First line. Second sentence.\nB: Reply here.')) expect(TTS_STYLE_IDS).toContain(c.style)
  })
})
