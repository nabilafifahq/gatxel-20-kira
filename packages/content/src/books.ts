import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { isClipText, splitClipText, splitSentences, type TtsClipRequest } from '@kira/core/tts'
import { grade } from './schema'

/**
 * Ruang Baca: buku bab asli di content/books/<grade>/<id>.json. Setiap bab punya teks, 6 sampai 8
 * pertanyaan pilihan ganda (dinilai server), dan kalimatnya menjadi klip suara pencerita.
 * Modul murni (tanpa server-only) supaya web, worker, dan content:check memakai aturan yang sama.
 */

export const BOOK_KINDS = ['story', 'nonfiction'] as const
export type BookKind = (typeof BOOK_KINDS)[number]

export const BOOK_GENRES = ['adventure', 'animals', 'family', 'fantasy', 'humour', 'mystery', 'school', 'nature', 'science', 'people', 'places', 'how-things-work'] as const
export type BookGenre = (typeof BOOK_GENRES)[number]

export const BOOK_GENRE_LABEL: Record<BookGenre, string> = {
  adventure: 'Adventure',
  animals: 'Animals',
  family: 'Family and friends',
  fantasy: 'Fantasy',
  humour: 'Funny',
  mystery: 'Mystery',
  school: 'School life',
  nature: 'Nature',
  science: 'Science',
  people: 'People',
  places: 'Places',
  'how-things-work': 'How things work',
}

/** Gambar sampul sederhana yang digambar packages/figures (BookCover). */
export const BOOK_MOTIFS = ['kite', 'boat', 'tree', 'star', 'fish', 'house', 'mountain', 'bird', 'rocket', 'leaf'] as const
export type BookMotif = (typeof BOOK_MOTIFS)[number]
export const BOOK_TINTS = ['math', 'english', 'science', 'mental', 'knowledge', 'warn'] as const
export type BookTint = (typeof BOOK_TINTS)[number]

const text = (max: number) => z.string().trim().min(1).max(max)

export const bookQuestionSchema = z
  .object({
    id: z.string().regex(/^q[1-8]$/),
    prompt: text(220),
    options: z.array(text(120)).min(3).max(4),
    answer: z.number().int().min(0).max(3),
    why: text(260),
  })
  .strict()
export type BookQuestion = z.infer<typeof bookQuestionSchema>

export const bookChapterSchema = z
  .object({
    id: z.string().regex(/^c[1-8]$/),
    title: text(60),
    text: z.string().trim().min(40).max(5200),
    questions: z.array(bookQuestionSchema).min(6).max(8),
  })
  .strict()
export type BookChapter = z.infer<typeof bookChapterSchema>

export const bookSchema = z
  .object({
    id: z.string().regex(/^g[1-6]-[a-z0-9]+(?:-[a-z0-9]+)*$/),
    grade,
    title: text(60),
    kind: z.enum(BOOK_KINDS),
    genre: z.enum(BOOK_GENRES),
    blurb: text(220),
    cover: z.object({ motif: z.enum(BOOK_MOTIFS), tint: z.enum(BOOK_TINTS) }).strict(),
    chapters: z.array(bookChapterSchema).min(3).max(8),
  })
  .strict()
export type Book = z.infer<typeof bookSchema>

/** Kata per halaman menurut kelas (level baca). */
export const WORDS_PER_PAGE: Record<number, number> = { 1: 24, 2: 38, 3: 56, 4: 76, 5: 100, 6: 130 }

/** Jumlah bab dan kata per bab yang diizinkan per kelas. */
export const BOOK_RULES: Record<number, { chapters: [number, number]; words: [number, number] }> = {
  1: { chapters: [3, 4], words: [40, 150] },
  2: { chapters: [3, 4], words: [90, 240] },
  3: { chapters: [5, 6], words: [150, 340] },
  4: { chapters: [5, 6], words: [210, 420] },
  5: { chapters: [6, 8], words: [280, 540] },
  6: { chapters: [6, 8], words: [340, 680] },
}

export const MIN_BOOKS_PER_GRADE = 3

export const wordCount = (s: string): number => s.split(/\s+/).filter(Boolean).length

export function bookWords(book: Book): number {
  return book.chapters.reduce((n, c) => n + wordCount(c.text), 0)
}

export type BookLength = 'short' | 'medium' | 'long'

/** Panjang buku untuk perpustakaan: menurut jumlah kata dan jumlah bab. */
export function bookLength(book: Book): BookLength {
  const w = bookWords(book)
  const per = book.chapters.length
  if (w <= 450 + per * 40) return 'short'
  if (w <= 1500 + per * 100) return 'medium'
  return 'long'
}

export const BOOK_LENGTH_LABEL: Record<BookLength, string> = { short: 'Short', medium: 'Medium', long: 'Long' }

/** Kalimat bab, berurutan, dengan nomor paragraf. Dipakai halaman, sorotan, dan klip suara. */
export type BookSentence = { text: string; paragraph: number }

export function chapterSentences(chapter: Pick<BookChapter, 'text'>): BookSentence[] {
  const out: BookSentence[] = []
  chapter.text.split(/\n{2,}/).forEach((para, paragraph) => {
    for (const s of splitSentences(para)) out.push({ text: s, paragraph })
  })
  return out
}

export type BookPage = { sentences: BookSentence[] }

/** Bagi kalimat bab menjadi halaman: sekitar `wordsPerPage` kata, kalimat tidak pernah terpotong. */
export function paginate(sentences: readonly BookSentence[], wordsPerPage: number): BookPage[] {
  const pages: BookPage[] = []
  let cur: BookSentence[] = []
  let words = 0
  for (const s of sentences) {
    const w = wordCount(s.text)
    if (cur.length > 0 && words + w > wordsPerPage * 1.15) {
      pages.push({ sentences: cur })
      cur = []
      words = 0
    }
    cur.push(s)
    words += w
  }
  if (cur.length > 0) pages.push({ sentences: cur })
  return pages
}

/** Klip suara pencerita: satu klip per kalimat (kalimat panjang dipecah, sama dengan penyaji di web). */
export function bookSpeechClips(book: Book): TtsClipRequest[] {
  const out: TtsClipRequest[] = []
  for (const ch of book.chapters) {
    for (const s of chapterSentences(ch)) {
      for (const t of splitClipText(s.text)) if (isClipText(t)) out.push({ text: t, style: 'narrator' })
    }
  }
  return out
}

export type BookProblem = { file: string; message: string }

export type BookLoad = { books: Book[]; errors: BookProblem[] }

const BANNED_CHARS = new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`)
const BANNED_WORDS = /\b(leverag\w*|seamless\w*|robust|delv\w*|unlock\w*|empower\w*|crucial|pivotal|holistic|tapestry|testament|utiliz\w*|utilis\w*)\b/i

/** Aturan isi yang tidak bisa dinyatakan di skema: jumlah bab per kelas, panjang, jawaban, teks terlarang. */
export function bookProblems(book: Book): string[] {
  const p: string[] = []
  const rules = BOOK_RULES[book.grade]!
  const [cMin, cMax] = rules.chapters
  if (book.chapters.length < cMin || book.chapters.length > cMax) p.push(`Kelas ${book.grade} butuh ${cMin} sampai ${cMax} bab, sekarang ${book.chapters.length}`)
  book.chapters.forEach((ch, i) => {
    const at = `bab ${i + 1}`
    if (ch.id !== `c${i + 1}`) p.push(`${at}: id harus c${i + 1}`)
    const w = wordCount(ch.text)
    if (w < rules.words[0] || w > rules.words[1]) p.push(`${at}: ${w} kata, kelas ${book.grade} butuh ${rules.words[0]} sampai ${rules.words[1]}`)
    for (const s of chapterSentences(ch)) {
      if (s.text.length > 260) p.push(`${at}: kalimat lebih dari 260 huruf: "${s.text.slice(0, 40)}"`)
      if (!isClipText(s.text)) p.push(`${at}: kalimat tidak layak dibacakan: "${s.text.slice(0, 40)}"`)
    }
    ch.questions.forEach((q, k) => {
      const qa = `${at} q${k + 1}`
      if (q.id !== `q${k + 1}`) p.push(`${qa}: id harus q${k + 1}`)
      if (q.answer >= q.options.length) p.push(`${qa}: answer di luar opsi`)
      const norm = q.options.map((o) => o.trim().toLowerCase())
      if (new Set(norm).size !== norm.length) p.push(`${qa}: opsi kembar`)
      if (/\b(all|none) of the above\b/i.test(q.options.join(' '))) p.push(`${qa}: pilihan "all/none of the above" tidak dipakai`)
    })
    const stems = ch.questions.map((q) => q.prompt.trim().toLowerCase())
    if (new Set(stems).size !== stems.length) p.push(`${at}: pertanyaan kembar`)
    const counts = [0, 0, 0, 0]
    for (const q of ch.questions) counts[q.answer] = (counts[q.answer] ?? 0) + 1
    if (counts.filter((c) => c > 0).length < 3) p.push(`${at}: letak jawaban benar kurang beragam`)
    if (Math.max(...counts) > Math.ceil(ch.questions.length * 0.5)) p.push(`${at}: lebih dari separuh jawaban benar di posisi yang sama`)
  })
  const all = [book.title, book.blurb, ...book.chapters.flatMap((c) => [c.title, c.text, ...c.questions.flatMap((q) => [q.prompt, q.why, ...q.options])])]
  for (const t of all) {
    if (BANNED_CHARS.test(t)) p.push('ada em dash atau en dash')
    const m = BANNED_WORDS.exec(t)
    if (m) p.push(`kata terlarang: ${m[0]}`)
  }
  return [...new Set(p)]
}

/** Muat semua buku dari content/books/<kelas>/<id>.json. Kesalahan dikembalikan, tidak dilempar. */
export function loadBooks(dir: string): BookLoad {
  const errors: BookProblem[] = []
  const books: Book[] = []
  const root = join(dir, 'books')
  if (!existsSync(root)) return { books, errors }
  const ids = new Set<string>()
  for (const g of readdirSync(root).sort()) {
    if (!/^[1-6]$/.test(g)) continue
    const folder = join(root, g)
    for (const name of readdirSync(folder).sort()) {
      if (!name.endsWith('.json')) continue
      const rel = `books/${g}/${name}`
      let raw: unknown
      try {
        raw = JSON.parse(readFileSync(join(folder, name), 'utf8'))
      } catch (e) {
        errors.push({ file: rel, message: `JSON tidak valid: ${(e as Error).message}` })
        continue
      }
      const parsed = bookSchema.safeParse(raw)
      if (!parsed.success) {
        errors.push({ file: rel, message: parsed.error.issues.slice(0, 6).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ') })
        continue
      }
      const book = parsed.data
      if (name !== `${book.id}.json`) errors.push({ file: rel, message: `Nama berkas harus ${book.id}.json` })
      if (String(book.grade) !== g) errors.push({ file: rel, message: `Buku kelas ${book.grade} ada di folder ${g}` })
      if (ids.has(book.id)) errors.push({ file: rel, message: `id buku kembar: ${book.id}` })
      ids.add(book.id)
      for (const m of bookProblems(book)) errors.push({ file: rel, message: m })
      books.push(book)
    }
  }
  return { books, errors }
}

/** Untuk content:check: setiap kelas minimal tiga buku, dan ada cerita serta nonfiksi. */
export function checkBooks(dir: string): BookProblem[] {
  const { books, errors } = loadBooks(dir)
  const out = [...errors]
  for (let g = 1; g <= 6; g++) {
    const here = books.filter((b) => b.grade === g)
    if (here.length < MIN_BOOKS_PER_GRADE) out.push({ file: `books/${g}`, message: `Kelas ${g} baru punya ${here.length} buku, minimal ${MIN_BOOKS_PER_GRADE}` })
    if (here.length > 0 && !here.some((b) => b.kind === 'story')) out.push({ file: `books/${g}`, message: `Kelas ${g} belum punya cerita` })
    if (here.length > 0 && !here.some((b) => b.kind === 'nonfiction')) out.push({ file: `books/${g}`, message: `Kelas ${g} belum punya buku nonfiksi` })
  }
  return out
}
