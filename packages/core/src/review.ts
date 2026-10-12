import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs'
import { addDays, jakartaDate, jakartaMidnight } from './time'

/**
 * Buku Koreksi: soal yang belum tepat atau dijawab dengan hint menjadi kartu FSRS.
 * Rating: belum tepat = Again, benar dengan hint = Hard, benar = Good,
 * benar cepat (di bawah separuh waktu wajar) = Easy.
 * Kartu tidak pernah jatuh tempo di hari yang sama: paling cepat besok (WIB).
 */

const scheduler = fsrs(generatorParameters({ enable_fuzz: false, enable_short_term: false, maximum_interval: 365 }))

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

export type CardState = {
  due: string // ISO timestamp
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: 'new' | 'learning' | 'review' | 'relearning'
  lastReview: string | null
}

const STATE_NAMES = ['new', 'learning', 'review', 'relearning'] as const

function toState(card: Card): CardState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_NAMES[card.state] ?? 'new',
    lastReview: card.last_review ? card.last_review.toISOString() : null,
  }
}

function fromState(s: CardState): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    learning_steps: s.learningSteps,
    reps: s.reps,
    lapses: s.lapses,
    state: STATE_NAMES.indexOf(s.state) as State,
    ...(s.lastReview ? { last_review: new Date(s.lastReview) } : {}),
  }
}

const RATING: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}

export function ratingFromOutcome(o: {
  correct: boolean
  hintsUsed: number
  timeMs?: number
  expectedMs?: number
}): ReviewRating {
  if (!o.correct) return 'again'
  if (o.hintsUsed > 0) return 'hard'
  if (o.timeMs !== undefined && o.expectedMs !== undefined && o.timeMs < o.expectedMs / 2) return 'easy'
  return 'good'
}

export function newCard(now: Date = new Date()): CardState {
  return toState(createEmptyCard(now))
}

export function reviewCard(state: CardState, rating: ReviewRating, now: Date = new Date()): CardState {
  const { card } = scheduler.next(fromState(state), now, RATING[rating])
  const tomorrow = jakartaMidnight(addDays(jakartaDate(now), 1))
  if (card.due.getTime() < tomorrow.getTime()) card.due = tomorrow
  return toState(card)
}

/** Kartu jatuh tempo pada tanggal WIB tertentu (atau sebelumnya). */
export function isDue(state: CardState, date: string): boolean {
  return jakartaDate(new Date(state.due)) <= date
}

/** Kartu dianggap selesai dari Buku Koreksi setelah 3 kali benar berturut dan interval di atas 21 hari. */
export function isRetired(state: CardState): boolean {
  return state.state === 'review' && state.scheduledDays > 21 && state.lapses === 0
}
