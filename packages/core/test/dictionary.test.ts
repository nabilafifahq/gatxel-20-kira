import { describe, expect, it } from 'vitest'
import { dictEntryProblems, dictionaryWordClips, lookupWord, normaliseWord, splitWords, tapWordsAllowedFor, type DictFile } from '../src/dictionary'

const dict: Pick<DictFile, 'entries' | 'forms'> = {
  entries: {
    run: { i: ['berlari'], e: 'to move fast on your feet', p: 'v', g: 1 },
    mouse: { i: ['tikus'], e: 'a small furry animal', p: 'n', g: 1 },
    happy: { i: ['senang'], e: 'feeling good', p: 'adj', g: 1 },
    dog: { i: ['anjing'], e: 'a pet that barks', p: 'n', g: 1 },
  },
  forms: { ran: 'run', mice: 'mouse' },
}

describe('kamus ketuk', () => {
  it('menormalkan kata', () => {
    expect(normaliseWord('“Happy,”')).toBe('happy')
    expect(normaliseWord('Dog’s')).toBe("dog's")
  })
  it('mencari bentuk persis, bentuk jadian, milik, dan akhiran', () => {
    expect(lookupWord(dict, 'Run')?.lemma).toBe('run')
    expect(lookupWord(dict, 'ran')?.lemma).toBe('run')
    expect(lookupWord(dict, 'mice')?.lemma).toBe('mouse')
    expect(lookupWord(dict, "dog's")?.lemma).toBe('dog')
    expect(lookupWord(dict, 'dogs')?.lemma).toBe('dog')
    expect(lookupWord(dict, 'running')?.lemma).toBe('run')
    expect(lookupWord(dict, 'happier')?.lemma).toBe('happy')
    expect(lookupWord(dict, 'Zxqv')).toBeNull()
    expect(lookupWord(dict, '42')).toBeNull()
  })
  it('memecah teks tanpa kehilangan satu huruf pun', () => {
    const text = "Ana's dog ran 12 km, didn't it?"
    const pieces = splitWords(text)
    expect(pieces.map((p) => p.text).join('')).toBe(text)
    expect(pieces.filter((p) => p.word).map((p) => p.text)).toEqual(["Ana's", 'dog', 'ran', 'km', "didn't", 'it'])
  })
  it('mematikan kamus untuk soal kosakata dan soal yang menanyakan arti kata', () => {
    expect(tapWordsAllowedFor({ skill: 'e2.synonyms-opposites', prompt: 'Pick the opposite of big.' })).toBe(false)
    expect(tapWordsAllowedFor({ skill: 'e3.homophones', prompt: 'Choose the word.' })).toBe(false)
    expect(tapWordsAllowedFor({ skill: 'e3.conjunctions', prompt: 'What does enormous mean?' })).toBe(false)
    expect(tapWordsAllowedFor({ skill: 'e3.conjunctions', prompt: 'I like mangoes ___ I like bananas.', type: 'spell' })).toBe(false)
    expect(tapWordsAllowedFor({ skill: 'e3.inference', prompt: 'Why was Ana happy?' })).toBe(true)
    expect(tapWordsAllowedFor({ skill: 's4.food-chains', prompt: 'Which animal eats grass?' })).toBe(true)
  })
  it('memeriksa bentuk entri', () => {
    expect(dictEntryProblems('run', dict.entries.run)).toEqual([])
    expect(dictEntryProblems('Run', dict.entries.run)).not.toEqual([])
    expect(dictEntryProblems('x', { i: [], e: 'abc' })).not.toEqual([])
    expect(dictEntryProblems('x', { i: ['a ; b'], e: 'fine text' })).not.toEqual([])
    expect(dictEntryProblems('x', { i: ['a', 'b', 'c', 'd'], e: 'fine text' })).not.toEqual([])
  })
  it('membuat klip satu kata untuk kata dasar dan bentuk jadian', () => {
    const clips = dictionaryWordClips(dict)
    expect(clips.map((c) => c.text)).toEqual(['dog', 'happy', 'mice', 'mouse', 'ran', 'run'])
    expect(clips.every((c) => c.style === 'dictation')).toBe(true)
  })
})
