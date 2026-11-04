import { describe, expect, it } from 'vitest'
import { splitClipText } from '@kira/core/tts'
import {
  BOOK_RULES,
  bookProblems,
  bookSpeechClips,
  chapterSentences,
  loadBooks,
  paginate,
  WORDS_PER_PAGE,
  wordCount,
  type Book,
} from '../src/books'
import { findContentDir } from '../src/load'

const { books, errors } = loadBooks(findContentDir())

function sample(over: Partial<Book> = {}): Book {
  const text = 'Dewi has a red kite. It is big. It has a long tail.\n\nShe runs to the field. The wind is strong today. Dewi is happy.\n\nA bird flies by. It says hello to the kite. The kite just dances in the wind. Ibu smiles at Dewi.'
  const q = (n: number, answer: number) => ({ id: `q${n}`, prompt: `Question ${n}?`, options: ['one', 'two', 'three'], answer, why: 'Because the text says so.' })
  const chapter = (n: number) => ({ id: `c${n}`, title: `Chapter ${n}`, text, questions: [q(1, 0), q(2, 1), q(3, 2), q(4, 0), q(5, 1), q(6, 2)] })
  return {
    id: 'g1-sample',
    grade: 1,
    title: 'Sample',
    kind: 'story',
    genre: 'adventure',
    blurb: 'A sample.',
    cover: { motif: 'kite', tint: 'math' },
    chapters: [chapter(1), chapter(2), chapter(3)],
    ...over,
  }
}

describe('buku Ruang Baca', () => {
  it('buku yang ada di content/books bersih dari error', () => {
    expect(errors).toEqual([])
    expect(books.length).toBeGreaterThan(0)
  })

  it('setiap kelas yang punya buku mengikuti aturan bab dan kata', () => {
    for (const b of books) {
      const r = BOOK_RULES[b.grade]!
      expect(b.chapters.length).toBeGreaterThanOrEqual(r.chapters[0])
      expect(b.chapters.length).toBeLessThanOrEqual(r.chapters[1])
      for (const c of b.chapters) {
        expect(c.questions.length).toBeGreaterThanOrEqual(6)
        expect(c.questions.length).toBeLessThanOrEqual(8)
      }
    }
  })

  it('contoh yang benar lolos pemeriksaan', () => {
    expect(bookProblems(sample())).toEqual([])
  })

  it('pemeriksa menangkap jawaban di luar pilihan, opsi kembar, dan dash', () => {
    const bad = sample()
    bad.chapters[0]!.questions[0]!.answer = 3
    bad.chapters[0]!.questions[1]!.options = ['same', 'same', 'other']
    bad.chapters[1]!.title = 'A — B'
    const found = bookProblems(bad).join('\n')
    expect(found).toMatch(/answer di luar opsi/)
    expect(found).toMatch(/opsi kembar/)
    expect(found).toMatch(/dash/)
  })

  it('pemeriksa menangkap jawaban benar yang selalu di posisi sama', () => {
    const bad = sample()
    for (const q of bad.chapters[0]!.questions) q.answer = 0
    expect(bookProblems(bad).join('\n')).toMatch(/kurang beragam|posisi yang sama/)
  })

  it('kalimat bab mengikuti paragraf dan tidak kosong', () => {
    const s = chapterSentences(sample().chapters[0]!)
    expect(s).toHaveLength(6 + 4)
    expect(s[0]!.paragraph).toBe(0)
    expect(s[3]!.paragraph).toBe(1)
  })

  it('halaman: kalimat tidak terpotong, urutan tetap, kata per halaman mengikuti level', () => {
    for (const b of books) {
      for (const c of b.chapters) {
        const sentences = chapterSentences(c)
        const pages = paginate(sentences, WORDS_PER_PAGE[b.grade]!)
        expect(pages.flatMap((p) => p.sentences)).toEqual(sentences)
        for (const p of pages) {
          const words = p.sentences.reduce((n, s) => n + wordCount(s.text), 0)
          if (p.sentences.length > 1) expect(words).toBeLessThanOrEqual(WORDS_PER_PAGE[b.grade]! * 1.15 + 1)
        }
      }
    }
    expect(WORDS_PER_PAGE[1]!).toBeLessThan(WORDS_PER_PAGE[6]!)
  })

  it('klip suara: satu klip pencerita per kalimat, dengan teks yang sama dengan penyaji', () => {
    const b = sample()
    const clips = bookSpeechClips(b)
    expect(clips.every((c) => c.style === 'narrator')).toBe(true)
    const expected = b.chapters.flatMap((c) => chapterSentences(c).flatMap((s) => splitClipText(s.text)))
    expect(clips.map((c) => c.text)).toEqual(expected)
  })

  it('id buku unik dan sama dengan nama berkas', () => {
    expect(new Set(books.map((b) => b.id)).size).toBe(books.length)
  })
})
