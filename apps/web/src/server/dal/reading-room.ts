import 'server-only'
import { and, eq, gte, isNull, sql } from 'drizzle-orm'
import { createRng, jakartaDate, pickItems, TEST_BAND } from '@kira/core'
import { addDays, type IsoDate } from '@kira/core/time'
import { tables } from '@kira/db'
import {
  BOOK_GENRE_LABEL,
  BOOK_LENGTH_LABEL,
  bookLength,
  bookWords,
  chapterSentences,
  loadBooks,
  paginate,
  WORDS_PER_PAGE,
  type Book,
} from '@kira/content/books'
import { findContentDir } from '@kira/content/load'
import type {
  BookCardDTO,
  BookDetailDTO,
  QuizAnswerInput,
  QuizDTO,
  QuizResultDTO,
  ReaderDTO,
  ReadingLibraryDTO,
  ReadingSummaryDTO,
} from '@/lib/dto-reading'
import type { OrgContext, Tx } from '../db'
import { conflict, invalid, notFound } from '../errors'
import { grantXp, learnerShell, loadLearner, lockLearnerScope } from './learner-core'
import { awardReadingStars } from './kira-world'

/**
 * Ruang Baca: perpustakaan, pembaca, kemajuan, menit membaca, dan kuis bab. Buku dimuat dari content/books
 * sekali per proses. Soal kuis dipilih server dengan pemilih pusat (pickItems, soal yang pernah muncul
 * dihindari), kunci jawaban tetap di server sampai kuis dikumpulkan, dan XP masuk jalur Belajar sekali per bab.
 */

const { bookProgress, bookChapter, bookQuiz, readingDay } = tables

export const QUIZ_COUNT = 5
const XP_PER_CORRECT = 2
const XP_ALL_CORRECT = 3
const XP_BOOK_FINISHED = 10
/** Kuis yang belum dikumpulkan dipakai lagi selama masih baru. */
const OPEN_QUIZ_HOURS = 6

const g = globalThis as unknown as { __kiraBooks?: Map<string, Book> }

export function allBooks(): Map<string, Book> {
  if (!g.__kiraBooks) {
    const { books } = loadBooks(findContentDir())
    g.__kiraBooks = new Map(books.map((b) => [b.id, b]))
  }
  return g.__kiraBooks
}

export function bookById(id: string): Book | undefined {
  return allBooks().get(id)
}

/** Menit baca kira-kira menurut kelas buku. */
function minutesOf(book: Book): number {
  const wpm = 40 + book.grade * 15
  return Math.max(1, Math.ceil(bookWords(book) / wpm))
}

type ProgressRow = typeof bookProgress.$inferSelect

function cardOf(book: Book, progress: ProgressRow | undefined, doneChapters: number): BookCardDTO {
  const status: BookCardDTO['status'] = progress?.finishedAt ? 'finished' : progress || doneChapters > 0 ? 'reading' : 'new'
  return {
    id: book.id,
    title: book.title,
    grade: book.grade,
    kind: book.kind,
    genre: book.genre,
    genreLabel: BOOK_GENRE_LABEL[book.genre],
    length: bookLength(book),
    lengthLabel: BOOK_LENGTH_LABEL[bookLength(book)],
    chapterCount: book.chapters.length,
    minutes: minutesOf(book),
    blurb: book.blurb,
    cover: book.cover,
    status,
    chaptersDone: doneChapters,
    href: `/reading/${book.id}`,
  }
}

async function progressMap(tx: Tx, learnerId: string): Promise<Map<string, ProgressRow>> {
  const rows = await tx.select().from(bookProgress).where(eq(bookProgress.learnerId, learnerId))
  return new Map(rows.map((r) => [r.bookId, r]))
}

async function doneCounts(tx: Tx, learnerId: string): Promise<Map<string, Set<string>>> {
  const rows = await tx.select({ b: bookChapter.bookId, c: bookChapter.chapterId }).from(bookChapter).where(eq(bookChapter.learnerId, learnerId))
  const out = new Map<string, Set<string>>()
  for (const r of rows) {
    const set = out.get(r.b) ?? new Set<string>()
    set.add(r.c)
    out.set(r.b, set)
  }
  return out
}

async function secondsSince(tx: Tx, learnerId: string, from: IsoDate): Promise<number> {
  const [row] = await tx
    .select({ s: sql<number>`coalesce(sum(${readingDay.seconds}), 0)::int` })
    .from(readingDay)
    .where(and(eq(readingDay.learnerId, learnerId), gte(readingDay.date, from)))
  return row?.s ?? 0
}

function resumeTarget(book: Book, progress: ProgressRow | undefined, done: Set<string> | undefined): { chapterId: string; label: string } {
  if (progress && !progress.finishedAt && book.chapters.some((c) => c.id === progress.chapterId)) {
    const n = book.chapters.findIndex((c) => c.id === progress.chapterId) + 1
    return { chapterId: progress.chapterId, label: `Chapter ${n} of ${book.chapters.length}` }
  }
  const next = book.chapters.find((c) => !done?.has(c.id)) ?? book.chapters[0]!
  const n = book.chapters.indexOf(next) + 1
  return { chapterId: next.id, label: done && done.size > 0 && !progress?.finishedAt ? `Chapter ${n} of ${book.chapters.length}` : 'Start reading' }
}

export async function readingSummary(tx: Tx, learnerId: string, today: IsoDate = jakartaDate()): Promise<ReadingSummaryDTO> {
  const progress = [...(await progressMap(tx, learnerId)).values()]
  const todaySec = await secondsSince(tx, learnerId, today)
  const weekSec = await secondsSince(tx, learnerId, addDays(today, -6))
  const current = progress.filter((p) => !p.finishedAt).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
  return {
    minutesToday: Math.round(todaySec / 60),
    minutesWeek: Math.round(weekSec / 60),
    booksFinished: progress.filter((p) => p.finishedAt).length,
    reading: current ? (bookById(current.bookId)?.title ?? null) : null,
  }
}

export async function readingLibraryDTO(tx: Tx, learnerId: string): Promise<ReadingLibraryDTO> {
  const learner = await loadLearner(tx, learnerId)
  const progress = await progressMap(tx, learnerId)
  const done = await doneCounts(tx, learnerId)
  const books = [...allBooks().values()]
    .sort((a, b) => a.grade - b.grade || a.title.localeCompare(b.title))
    .map((b) => cardOf(b, progress.get(b.id), done.get(b.id)?.size ?? 0))
  const summary = await readingSummary(tx, learnerId)
  const last = [...progress.values()].filter((p) => !p.finishedAt).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
  const lastCard = last ? books.find((b) => b.id === last.bookId) : undefined
  const lastBook = last ? bookById(last.bookId) : undefined
  let continueBook: ReadingLibraryDTO['continueBook'] = null
  if (lastCard && lastBook) {
    const target = resumeTarget(lastBook, last, done.get(last!.bookId))
    continueBook = { ...lastCard, href: `/reading/${lastBook.id}/${target.chapterId}`, resumeLabel: target.label }
  }
  return {
    shell: await learnerShell(tx, learner),
    grade: learner.grade,
    books,
    continueBook,
    minutesToday: summary.minutesToday,
    minutesWeek: summary.minutesWeek,
    booksFinished: summary.booksFinished,
  }
}

export async function bookDetailDTO(tx: Tx, learnerId: string, bookId: string): Promise<BookDetailDTO> {
  const book = bookById(bookId)
  if (!book) throw notFound('That book is not on the shelf.')
  const learner = await loadLearner(tx, learnerId)
  const progress = (await progressMap(tx, learnerId)).get(book.id)
  const done = (await doneCounts(tx, learnerId)).get(book.id)
  const target = resumeTarget(book, progress, done)
  return {
    shell: await learnerShell(tx, learner),
    book: cardOf(book, progress, done?.size ?? 0),
    chapters: book.chapters.map((c) => ({
      id: c.id,
      title: c.title,
      done: done?.has(c.id) ?? false,
      current: !progress?.finishedAt && target.chapterId === c.id,
      href: `/reading/${book.id}/${c.id}`,
    })),
    resumeHref: `/reading/${book.id}/${target.chapterId}`,
    resumeLabel: progress?.finishedAt ? 'Read it again' : target.label,
  }
}

export async function readerDTO(tx: Tx, learnerId: string, bookId: string, chapterId: string): Promise<ReaderDTO> {
  const book = bookById(bookId)
  const chapter = book?.chapters.find((c) => c.id === chapterId)
  if (!book || !chapter) throw notFound('That chapter is not in this book.')
  const learner = await loadLearner(tx, learnerId)
  const progress = (await progressMap(tx, learnerId)).get(book.id)
  const done = (await doneCounts(tx, learnerId)).get(book.id)
  const sentences = chapterSentences(chapter).map((s, index) => ({ ...s, index }))
  const pages = paginate(sentences, WORDS_PER_PAGE[book.grade] ?? 56).map((p) => ({ sentences: p.sentences as typeof sentences }))
  const at = book.chapters.indexOf(chapter)
  const next = book.chapters[at + 1]
  const resume = progress && progress.chapterId === chapterId && !progress.finishedAt ? Math.min(progress.sentenceIdx, Math.max(0, sentences.length - 1)) : 0
  return {
    shell: await learnerShell(tx, learner),
    bookId: book.id,
    bookTitle: book.title,
    grade: book.grade,
    chapterId,
    chapterTitle: chapter.title,
    chapterNumber: at + 1,
    chapterCount: book.chapters.length,
    pages,
    sentenceCount: sentences.length,
    startSentence: resume,
    nextHref: next ? `/reading/${book.id}/${next.id}` : null,
    libraryHref: '/reading',
    bookHref: `/reading/${book.id}`,
    done: done?.has(chapterId) ?? false,
  }
}

/** Simpan tempat berhenti. Buku yang sudah selesai tetap selesai. */
export async function saveProgress(tx: Tx, ctx: OrgContext, learnerId: string, input: { bookId: string; chapterId: string; sentenceIdx: number }): Promise<void> {
  const book = bookById(input.bookId)
  const chapter = book?.chapters.find((c) => c.id === input.chapterId)
  if (!book || !chapter) throw notFound('That chapter is not in this book.')
  const max = Math.max(0, chapterSentences(chapter).length - 1)
  const sentenceIdx = Math.min(Math.max(0, input.sentenceIdx), max)
  await tx
    .insert(bookProgress)
    .values({ orgId: ctx.orgId, learnerId, bookId: book.id, chapterId: chapter.id, sentenceIdx })
    .onConflictDoUpdate({
      target: [bookProgress.learnerId, bookProgress.bookId],
      set: { chapterId: chapter.id, sentenceIdx, updatedAt: new Date() },
    })
}

/** Catat detik membaca. Paling banyak 60 detik per panggilan dan satu panggilan per 20 detik. */
export async function logReadingSeconds(tx: Tx, ctx: OrgContext, learnerId: string, seconds: number): Promise<void> {
  const add = Math.min(60, Math.max(1, Math.round(seconds)))
  await tx
    .insert(readingDay)
    .values({ orgId: ctx.orgId, learnerId, date: jakartaDate(), seconds: add, lastAt: new Date() })
    .onConflictDoUpdate({
      target: [readingDay.learnerId, readingDay.date],
      set: {
        seconds: sql`case when ${readingDay.lastAt} is null or ${readingDay.lastAt} < now() - interval '20 seconds' then least(${readingDay.seconds} + ${add}, 86400) else ${readingDay.seconds} end`,
        lastAt: sql`case when ${readingDay.lastAt} is null or ${readingDay.lastAt} < now() - interval '20 seconds' then now() else ${readingDay.lastAt} end`,
      },
    })
}

/**
 * Mulai kuis bab. Soal dipilih dengan pemilih pusat: yang belum pernah muncul di kuis bab ini diutamakan,
 * jadi mengulang kuis memberi soal baru lebih dulu. Kuis yang belum dikumpulkan dan masih baru dilanjutkan.
 */
export async function startChapterQuiz(tx: Tx, ctx: OrgContext, learnerId: string, bookId: string, chapterId: string): Promise<QuizDTO> {
  await lockLearnerScope(tx, 'reading', learnerId)
  const book = bookById(bookId)
  const chapter = book?.chapters.find((c) => c.id === chapterId)
  if (!book || !chapter) throw notFound('That chapter is not in this book.')
  const byId = new Map(chapter.questions.map((q) => [q.id, q]))
  const show = (id: string, ids: string[]): QuizDTO => ({
    quizId: id,
    questions: ids.flatMap((qid) => {
      const q = byId.get(qid)
      return q ? [{ id: q.id, prompt: q.prompt, options: q.options }] : []
    }),
  })

  const past = await tx
    .select()
    .from(bookQuiz)
    .where(and(eq(bookQuiz.learnerId, learnerId), eq(bookQuiz.bookId, bookId), eq(bookQuiz.chapterId, chapterId)))
  const open = past.find((p) => !p.submittedAt && Date.now() - p.createdAt.getTime() < OPEN_QUIZ_HOURS * 3_600_000)
  if (open) return show(open.id, open.questionIds)

  const lastAsked = new Map<string, number>()
  for (const p of past) for (const qid of p.questionIds) lastAsked.set(qid, Math.max(lastAsked.get(qid) ?? 0, p.createdAt.getTime()))
  const now = Date.now()
  const candidates = chapter.questions.map((q) => ({
    ref: q.id,
    difficulty: 3,
    ...(lastAsked.has(q.id) ? { seenDaysAgo: Math.floor((now - lastAsked.get(q.id)!) / 86_400_000) } : {}),
  }))
  // Soal yang paling lama tidak muncul lebih dulu: kurangi sedikit penalti supaya urutannya stabil menurut waktu.
  const picked = pickItems({ candidates, theta: 0, count: Math.min(QUIZ_COUNT, candidates.length), band: TEST_BAND, rng: createRng(`${learnerId}:${bookId}:${chapterId}:${now}`) })
  const ids = picked.map((p) => p.candidate.ref).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  const [row] = await tx.insert(bookQuiz).values({ orgId: ctx.orgId, learnerId, bookId, chapterId, questionIds: ids }).returning({ id: bookQuiz.id })
  return show(row!.id, ids)
}

/** Setelah bab selesai, tempat melanjutkan pindah ke awal bab berikutnya. */
async function advanceProgress(tx: Tx, ctx: OrgContext, learnerId: string, book: Book, chapterId: string): Promise<void> {
  const next = book.chapters[book.chapters.findIndex((c) => c.id === chapterId) + 1]
  const to = next?.id ?? chapterId
  await tx
    .insert(bookProgress)
    .values({ orgId: ctx.orgId, learnerId, bookId: book.id, chapterId: to, sentenceIdx: 0 })
    .onConflictDoUpdate({ target: [bookProgress.learnerId, bookProgress.bookId], set: { chapterId: to, sentenceIdx: 0, updatedAt: new Date() } })
}

async function maybeFinishBook(tx: Tx, ctx: OrgContext, learnerId: string, book: Book, chapterId: string): Promise<{ finished: boolean; xp: number }> {
  const done = (await doneCounts(tx, learnerId)).get(book.id)
  if (!done || done.size < book.chapters.length) return { finished: false, xp: 0 }
  const now = new Date()
  const claimed = await tx
    .update(bookProgress)
    .set({ finishedAt: now, updatedAt: now })
    .where(and(eq(bookProgress.learnerId, learnerId), eq(bookProgress.bookId, book.id), isNull(bookProgress.finishedAt)))
    .returning({ id: bookProgress.bookId })
  let first = claimed.length > 0
  if (!first) {
    const [row] = await tx.select({ id: bookProgress.bookId }).from(bookProgress).where(and(eq(bookProgress.learnerId, learnerId), eq(bookProgress.bookId, book.id))).limit(1)
    if (!row) {
      await tx.insert(bookProgress).values({ orgId: ctx.orgId, learnerId, bookId: book.id, chapterId, finishedAt: now })
      first = true
    }
  }
  if (first) await grantXp(tx, ctx, learnerId, XP_BOOK_FINISHED, 'reading-book', book.id, jakartaDate())
  return { finished: true, xp: first ? XP_BOOK_FINISHED : 0 }
}

/** Nilai kuis di server. XP hanya untuk kuis pertama sebuah bab; mengulang tidak menambah XP. */
export async function submitChapterQuiz(tx: Tx, ctx: OrgContext, learnerId: string, quizId: string, answers: QuizAnswerInput[]): Promise<QuizResultDTO> {
  // Kumpul ganda (klik dua kali, permintaan serentak) menunggu di sini lalu melihat kuis sudah dikumpulkan. Tanpa kunci, tiap
  // permintaan membaca "belum dikumpulkan" dan XP diberikan berkali-kali.
  await lockLearnerScope(tx, 'reading', learnerId)
  const [quiz] = await tx.select().from(bookQuiz).where(and(eq(bookQuiz.id, quizId), eq(bookQuiz.learnerId, learnerId))).limit(1)
  if (!quiz) throw notFound('That quiz was not found.')
  if (quiz.submittedAt) throw conflict('You already sent in this quiz.')
  const book = bookById(quiz.bookId)
  const chapter = book?.chapters.find((c) => c.id === quiz.chapterId)
  if (!book || !chapter) throw notFound('That chapter is not in this book.')
  const chosen = new Map<string, number>()
  for (const a of answers) {
    if (!quiz.questionIds.includes(a.questionId)) throw invalid('That answer does not belong to this quiz.')
    chosen.set(a.questionId, a.choice)
  }
  let correct = 0
  const review: QuizResultDTO['review'] = []
  for (const qid of quiz.questionIds) {
    const q = chapter.questions.find((x) => x.id === qid)
    if (!q) continue
    const choice = chosen.get(qid) ?? -1
    if (choice >= q.options.length) throw invalid('That answer is not one of the choices.')
    if (choice === q.answer) correct++
    review.push({ questionId: q.id, prompt: q.prompt, options: q.options, chosen: choice, answer: q.answer, why: q.why })
  }
  const total = review.length
  const [prior] = await tx
    .select()
    .from(bookChapter)
    .where(and(eq(bookChapter.learnerId, learnerId), eq(bookChapter.bookId, book.id), eq(bookChapter.chapterId, chapter.id)))
    .limit(1)
  const first = !prior || prior.quizCount === 0
  const xp = first ? correct * XP_PER_CORRECT + (correct === total && total > 0 ? XP_ALL_CORRECT : 0) : 0
  await tx.update(bookQuiz).set({ submittedAt: new Date(), correct }).where(eq(bookQuiz.id, quiz.id))
  await tx
    .insert(bookChapter)
    .values({ orgId: ctx.orgId, learnerId, bookId: book.id, chapterId: chapter.id, quizCount: 1, bestCorrect: correct, bestTotal: total, xp })
    .onConflictDoUpdate({
      target: [bookChapter.learnerId, bookChapter.bookId, bookChapter.chapterId],
      set: {
        quizCount: sql`${bookChapter.quizCount} + 1`,
        bestCorrect: sql`greatest(${bookChapter.bestCorrect}, ${correct})`,
        bestTotal: sql`greatest(${bookChapter.bestTotal}, ${total})`,
        xp: sql`${bookChapter.xp} + ${xp}`,
      },
    })
  await grantXp(tx, ctx, learnerId, xp, 'reading-quiz', `${book.id}:${chapter.id}`, jakartaDate())
  // Bintang Kira World untuk bab yang selesai (sekali per bab; ref buku dan bab mencegah ganda, jumlahnya menurun per hari).
  if (first) await awardReadingStars(tx, learnerId, `${book.id}:${chapter.id}`, jakartaDate())
  await advanceProgress(tx, ctx, learnerId, book, chapter.id)
  const fin = await maybeFinishBook(tx, ctx, learnerId, book, chapter.id)
  const next = book.chapters[book.chapters.indexOf(chapter) + 1]
  return { correct, total, xp, review, bookFinished: fin.finished, bookXp: fin.xp, nextHref: next ? `/reading/${book.id}/${next.id}` : null }
}

/** Selesaikan bab tanpa kuis (anak memilih melewatinya). Tidak ada XP. */
export async function markChapterRead(tx: Tx, ctx: OrgContext, learnerId: string, bookId: string, chapterId: string): Promise<{ bookFinished: boolean; nextHref: string | null }> {
  await lockLearnerScope(tx, 'reading', learnerId)
  const book = bookById(bookId)
  const chapter = book?.chapters.find((c) => c.id === chapterId)
  if (!book || !chapter) throw notFound('That chapter is not in this book.')
  await tx.insert(bookChapter).values({ orgId: ctx.orgId, learnerId, bookId, chapterId, quizCount: 0 }).onConflictDoNothing()
  await advanceProgress(tx, ctx, learnerId, book, chapter.id)
  const fin = await maybeFinishBook(tx, ctx, learnerId, book, chapter.id)
  const next = book.chapters[book.chapters.indexOf(chapter) + 1]
  return { bookFinished: fin.finished, nextHref: next ? `/reading/${book.id}/${next.id}` : null }
}
