import type { BookGenre, BookKind, BookLength, BookMotif, BookTint } from '@kira/content/books'
import type { LearnerShell } from './dto'

/** DTO Ruang Baca (teks learner en-GB). Kunci jawaban kuis tidak pernah ada di DTO sebelum kuis dikumpulkan. */

export type BookCardDTO = {
  id: string
  title: string
  grade: number
  kind: BookKind
  genre: BookGenre
  genreLabel: string
  length: BookLength
  lengthLabel: string
  chapterCount: number
  minutes: number
  blurb: string
  cover: { motif: BookMotif; tint: BookTint }
  status: 'new' | 'reading' | 'finished'
  chaptersDone: number
  href: string
}

export type ReadingLibraryDTO = {
  shell: LearnerShell
  grade: number
  books: BookCardDTO[]
  continueBook: (BookCardDTO & { resumeLabel: string }) | null
  minutesToday: number
  minutesWeek: number
  booksFinished: number
}

export type BookChapterRowDTO = { id: string; title: string; done: boolean; current: boolean; href: string }

export type BookDetailDTO = {
  shell: LearnerShell
  book: BookCardDTO
  chapters: BookChapterRowDTO[]
  resumeHref: string
  resumeLabel: string
}

export type ReaderPageDTO = { sentences: { text: string; paragraph: number; index: number }[] }

export type ReaderDTO = {
  shell: LearnerShell
  bookId: string
  bookTitle: string
  grade: number
  chapterId: string
  chapterTitle: string
  chapterNumber: number
  chapterCount: number
  pages: ReaderPageDTO[]
  sentenceCount: number
  startSentence: number
  nextHref: string | null
  libraryHref: string
  bookHref: string
  done: boolean
}

export type QuizQuestionDTO = { id: string; prompt: string; options: string[] }

export type QuizDTO = { quizId: string; questions: QuizQuestionDTO[] }

export type QuizAnswerInput = { questionId: string; choice: number }

export type QuizResultDTO = {
  correct: number
  total: number
  xp: number
  review: { questionId: string; prompt: string; options: string[]; chosen: number; answer: number; why: string }[]
  bookFinished: boolean
  bookXp: number
  nextHref: string | null
}

export type ReadingSummaryDTO = {
  minutesToday: number
  minutesWeek: number
  booksFinished: number
  reading: string | null
}
